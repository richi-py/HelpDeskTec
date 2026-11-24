import os
import uuid
import base64
import gridfs
from io import BytesIO
from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId
from flask import Response
from flask_jwt_extended import create_access_token
from pymongo import MongoClient, ReturnDocument
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from BackEnd.GlobalInfo.Keys import CLOUDINARY_URL, DB_NAME, MONGO_URI
from BackEnd.GlobalInfo.ResponseMessages import error_response, success_response
from BackEnd.Estructuras.gestor_estructuras import gestor_estructuras

try:
    import cloudinary.uploader
except ImportError:
    cloudinary = None

def _conectar_mongo():
    uri = MONGO_URI
    if "readPreference" not in uri:
        sep = "&" if "?" in uri else "?"
        uri = f"{uri}{sep}readPreference=primaryPreferred"

    try:
        base_client = MongoClient(
            uri,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=10000,
            retryWrites=True,
        )
        hello = base_client.admin.command("hello")
        is_writable = hello.get("isWritablePrimary", False) or hello.get("ismaster", False)
        primary_host = hello.get("primary")

        if is_writable or not primary_host:
            return base_client, base_client[DB_NAME]

        # Si el nodo actual es secundario, apuntar de inmediato al primario
        import re
        primary_uri = re.sub(r'@[^/]+/', f'@{primary_host}/', uri)
        primary_client = MongoClient(
            primary_uri,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=10000,
            retryWrites=True,
        )
        return primary_client, primary_client[DB_NAME]
    except Exception as e:
        fallback = MongoClient(uri, serverSelectionTimeoutMS=5000)
        return fallback, fallback[DB_NAME]


client, db = _conectar_mongo()
gestor_estructuras.inicializar_desde_mongo(db)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ESTADOS_VALIDOS = {"pendiente", "asignada", "en_proceso", "resuelta"}


def serializar_doc(doc):
    """Convierte ObjectId y datetime de MongoDB a JSON válido."""
    if isinstance(doc, list):
        return [serializar_doc(item) for item in doc]
    if isinstance(doc, dict):
        nuevo = {}
        for clave, valor in doc.items():
            if clave == "_id":
                nuevo["id"] = str(valor)
            elif isinstance(valor, ObjectId):
                nuevo[clave] = str(valor)
            elif isinstance(valor, datetime):
                nuevo[clave] = valor.isoformat()
            elif isinstance(valor, (dict, list)):
                nuevo[clave] = serializar_doc(valor)
            else:
                nuevo[clave] = valor
        return nuevo
    return doc


def _parse_object_id(valor):
    try:
        return ObjectId(valor)
    except (InvalidId, TypeError):
        return None


def _siguiente_codigo():
    contador = db.contadores.find_one_and_update(
        {"_id": "incidencias"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"INC-{contador['seq']:04d}"


# =========================================================
# AUTENTICACIÓN Y PERFIL
# =========================================================

def registrar_usuario(data):
    nombre = (data.get("nombre") or "").strip()
    correo = (data.get("correo") or "").strip().lower()
    password = data.get("password") or ""

    if not nombre or not correo or not password:
        return error_response("MISSING_FIELDS", 400)

    if db.usuarios.find_one({"correo": correo}):
        return error_response("EMAIL_EXISTS", 409)

    usuario = {
        "nombre": nombre,
        "correo": correo,
        "password_hash": generate_password_hash(password),
        "rol": data.get("rol", "usuario"),
        "area": data.get("area"),
        "telefono": data.get("telefono"),
        "avatar_url": data.get("avatar_url"),
        "activo": True,
        "created_at": datetime.now(timezone.utc),
    }

    res = db.usuarios.insert_one(usuario)
    usuario["_id"] = res.inserted_id
    usuario.pop("password_hash", None)
    return success_response(serializar_doc(usuario), 201)


def autenticar_usuario(data):
    correo = (data.get("correo") or "").strip().lower()
    password = data.get("password") or ""

    if not correo or not password:
        return error_response("MISSING_FIELDS", 400)

    usuario = db.usuarios.find_one({"correo": correo, "activo": True})
    if not usuario or not check_password_hash(usuario["password_hash"], password):
        return error_response("INVALID_CREDENTIALS", 401)

    token = create_access_token(
        identity=str(usuario["_id"]),
        additional_claims={"rol": usuario["rol"], "nombre": usuario["nombre"]},
    )

    usuario_limpio = serializar_doc(usuario)
    usuario_limpio.pop("password_hash", None)
    return success_response({"access_token": token, "usuario": usuario_limpio}, 200)


def _obtener_usuario_default(rol_preferido="tecnico"):
    """Retorna un usuario de prueba para modo desarrollo si no se envía token."""
    return db.usuarios.find_one({"rol": rol_preferido}) or db.usuarios.find_one()


def obtener_perfil(user_id_str):
    if not user_id_str:
        usuario = _obtener_usuario_default("tecnico")
        if usuario:
            usuario_limpio = serializar_doc(usuario)
            usuario_limpio.pop("password_hash", None)
            return success_response(usuario_limpio, 200)
        return error_response("USER_NOT_FOUND", 404)

    user_id = _parse_object_id(user_id_str)
    if not user_id:
        return error_response("USER_NOT_FOUND", 404)

    usuario = db.usuarios.find_one({"_id": user_id}, {"password_hash": 0})
    if not usuario:
        return error_response("USER_NOT_FOUND", 404)

    return success_response(serializar_doc(usuario), 200)


# =========================================================
# INCIDENCIAS
# =========================================================

def obtener_resumen(user_id_str, rol):
    if not user_id_str:
        usuario = _obtener_usuario_default(rol or "tecnico")
        if usuario:
            user_id = usuario["_id"]
            rol = usuario.get("rol", "tecnico")
        else:
            return error_response("USER_NOT_FOUND", 404)
    else:
        user_id = _parse_object_id(user_id_str)
        if not user_id:
            return error_response("USER_NOT_FOUND", 404)

    if not rol:
        u_doc = db.usuarios.find_one({"_id": user_id})
        rol = u_doc.get("rol", "usuario") if u_doc else "usuario"

    if rol == "tecnico":
        filtro = {"$or": [{"tecnico_id": {"$in": [user_id, str(user_id)]}}, {"estado": "pendiente"}]}
    else:
        filtro = {"usuario_id": {"$in": [user_id, str(user_id)]}}

    pipeline = [
        {"$match": filtro},
        {"$group": {"_id": "$estado", "total": {"$sum": 1}}},
    ]
    conteos = {item["_id"]: item["total"] for item in db.incidencias.aggregate(pipeline)}

    return success_response(
        {
            "pendientes": conteos.get("pendiente", 0),
            "asignadas": conteos.get("asignada", 0),
            "en_proceso": conteos.get("en_proceso", 0),
            "resueltas": conteos.get("resuelta", 0),
        },
        200,
    )


def listar_incidencias(user_id_str, rol, estado=None):
    if not user_id_str:
        usuario = _obtener_usuario_default(rol or "tecnico")
        if usuario:
            user_id = usuario["_id"]
            rol = usuario.get("rol", "tecnico")
        else:
            return error_response("USER_NOT_FOUND", 404)
    else:
        user_id = _parse_object_id(user_id_str)
        if not user_id:
            return error_response("USER_NOT_FOUND", 404)

    # Si no se envió rol o no viene en claims, buscar en BD para evitar filtro vacío
    if not rol:
        u_doc = db.usuarios.find_one({"_id": user_id})
        rol = u_doc.get("rol", "usuario") if u_doc else "usuario"

    filtro = {}
    if rol == "usuario":
        # Un usuario normal SOLO debe ver sus propias incidencias
        filtro["usuario_id"] = {"$in": [user_id, str(user_id)]}
    elif rol == "tecnico":
        if estado != "pendiente":
            filtro["$or"] = [
                {"tecnico_id": {"$in": [user_id, str(user_id)]}},
                {"estado": "pendiente"},
            ]

    if estado:
        if estado not in ESTADOS_VALIDOS:
            return error_response("INVALID_STATE", 400)
        filtro["estado"] = estado

    docs = list(db.incidencias.find(filtro).sort("created_at", -1))
    return success_response(serializar_doc(docs), 200)


def crear_incidencia(user_id_str, nombre_usuario, data):
    user_id = _parse_object_id(user_id_str)
    if not user_id:
        return error_response("USER_NOT_FOUND", 404)

    titulo = (data.get("titulo") or "").strip()
    descripcion = (data.get("descripcion") or "").strip()
    if not titulo or not descripcion:
        return error_response("MISSING_FIELDS", 400)

    ahora = datetime.now(timezone.utc)
    doc = {
        "codigo": _siguiente_codigo(),
        "usuario_id": user_id,
        "usuario_nombre": nombre_usuario or "Usuario",
        "tecnico_id": None,
        "tecnico_nombre": None,
        "tipo": data.get("tipo", "hardware"),
        "urgencia": data.get("urgencia", "media"),
        "estado": "pendiente",
        "titulo": titulo,
        "descripcion": descripcion,
        "solucion": None,
        "imagenes": [],
        "historial": [
            {
                "estado": "creada",
                "por_id": user_id,
                "por_nombre": nombre_usuario or "Usuario",
                "por_rol": "Usuario",
                "fecha": ahora,
            }
        ],
        "comentarios": [],
        "created_at": ahora,
        "assigned_at": None,
        "started_at": None,
        "resolved_at": None,
        "updated_at": ahora,
    }

    res = db.incidencias.insert_one(doc)
    doc["_id"] = res.inserted_id
    doc_serializado = serializar_doc(doc)

    # Registrar en las 3 Estructuras de Datos en memoria
    gestor_estructuras.registrar_nuevo_ticket(doc_serializado)

    return success_response(doc_serializado, 201)


def obtener_incidencia_por_id(inc_id_str):
    # 1. Búsqueda rápida O(1) en la Tabla Hash en memoria
    ticket_hash = gestor_estructuras.buscar_por_clave(inc_id_str)
    if ticket_hash:
        return success_response(serializar_doc(ticket_hash), 200)

    # 2. Respaldo en MongoDB Atlas si aún no estuviera en memoria
    inc_id = _parse_object_id(inc_id_str)
    if not inc_id:
        return error_response("TICKET_NOT_FOUND", 404)

    doc = db.incidencias.find_one({"_id": inc_id})
    if not doc:
        return error_response("TICKET_NOT_FOUND", 404)

    doc_serializado = serializar_doc(doc)
    gestor_estructuras.tabla_hash.insertar(inc_id_str, doc_serializado)
    return success_response(doc_serializado, 200)


def cambiar_estado_incidencia(inc_id_str, user_id_str, nombre_usuario, data):
    inc_id = _parse_object_id(inc_id_str)
    if not inc_id:
        return error_response("TICKET_NOT_FOUND", 404)

    tecnico_id = _parse_object_id(user_id_str) if user_id_str else None
    if not tecnico_id:
        usuario = _obtener_usuario_default("tecnico")
        if usuario:
            tecnico_id = usuario["_id"]
            nombre_usuario = nombre_usuario or usuario.get("nombre", "Técnico")
        else:
            tecnico_id = ObjectId()
            nombre_usuario = nombre_usuario or "Técnico"

    nuevo_estado = data.get("estado")
    if nuevo_estado not in ESTADOS_VALIDOS:
        return error_response("INVALID_STATE", 400)

    ahora = datetime.now(timezone.utc)
    campos_set = {"estado": nuevo_estado, "updated_at": ahora}

    if nuevo_estado in ("asignada", "en_proceso"):
        campos_set.update(
            {
                "tecnico_id": tecnico_id,
                "tecnico_nombre": nombre_usuario or "Técnico",
            }
        )
        if nuevo_estado == "asignada":
            campos_set["assigned_at"] = ahora
        elif nuevo_estado == "en_proceso":
            campos_set["started_at"] = ahora
    elif nuevo_estado == "resuelta":
        campos_set.update(
            {
                "resolved_at": ahora,
                "solucion": data.get("solucion", ""),
            }
        )
        # Asegurar técnico si no estaba asignado antes
        campos_set.setdefault("tecnico_id", tecnico_id)
        campos_set.setdefault("tecnico_nombre", nombre_usuario or "Técnico")

    incidencia = db.incidencias.find_one_and_update(
        {"_id": inc_id},
        {
            "$set": campos_set,
            "$push": {
                "historial": {
                    "estado": nuevo_estado,
                    "por_id": tecnico_id,
                    "por_nombre": nombre_usuario or "Técnico",
                    "por_rol": "Técnico",
                    "fecha": ahora,
                }
            },
        },
        return_document=ReturnDocument.AFTER,
    )

    if not incidencia:
        return error_response("TICKET_NOT_FOUND", 404)

    # Sincronizar en Estructuras de Datos (Pila, Cola de Prioridad, Tabla Hash)
    doc_serializado = serializar_doc(incidencia)
    evento_historial = {
        "estado": nuevo_estado,
        "por_id": str(tecnico_id),
        "por_nombre": nombre_usuario or "Técnico",
        "por_rol": "Técnico",
        "fecha": ahora.isoformat(),
        "solucion": data.get("solucion") if nuevo_estado == "resuelta" else None,
    }
    gestor_estructuras.registrar_cambio_estado(str(inc_id), doc_serializado, evento_historial)

    usuario_id = incidencia.get("usuario_id")
    if usuario_id:
        db.notificaciones.insert_one(
            {
                "usuario_id": usuario_id,
                "incidencia_id": incidencia["_id"],
                "codigo": incidencia.get("codigo", ""),
                "mensaje": f"Tu incidencia #{incidencia.get('codigo', '')} cambió a {nuevo_estado}.",
                "tipo": "resuelta" if nuevo_estado == "resuelta" else "cambio_estado",
                "leida": False,
                "created_at": ahora,
            }
        )

    return success_response({"ok": True, "incidencia": serializar_doc(incidencia)}, 200)


def agregar_comentario(inc_id_str, user_id_str, nombre_usuario, rol, data):
    inc_id = _parse_object_id(inc_id_str)
    autor_id = _parse_object_id(user_id_str)
    if not inc_id or not autor_id:
        return error_response("TICKET_NOT_FOUND", 404)

    mensaje = (data.get("mensaje") or "").strip()
    if not mensaje:
        return error_response("MISSING_FIELDS", 400)

    ahora = datetime.now(timezone.utc)
    incidencia = db.incidencias.find_one_and_update(
        {"_id": inc_id},
        {
            "$set": {"updated_at": ahora},
            "$push": {
                "comentarios": {
                    "autor_id": autor_id,
                    "autor_nombre": nombre_usuario or "Usuario",
                    "autor_rol": rol or "usuario",
                    "mensaje": mensaje,
                    "created_at": ahora,
                }
            },
        },
        return_document=ReturnDocument.AFTER,
    )

    if not incidencia:
        return error_response("TICKET_NOT_FOUND", 404)

    db.notificaciones.insert_one(
        {
            "usuario_id": incidencia["usuario_id"],
            "incidencia_id": incidencia["_id"],
            "codigo": incidencia["codigo"],
            "mensaje": f"Se agregó un comentario en #{incidencia['codigo']}.",
            "tipo": "comentario",
            "leida": False,
            "created_at": ahora,
        }
    )

    return success_response(serializar_doc(incidencia), 200)


def subir_imagen_incidencia(inc_id_str, user_id_str, archivo, tipo, host_url):
    inc_id = _parse_object_id(inc_id_str)
    if not inc_id:
        return error_response("TICKET_NOT_FOUND", 404)

    subida_por_id = _parse_object_id(user_id_str) if user_id_str else None
    if not subida_por_id:
        usuario = _obtener_usuario_default("tecnico" if tipo == "solucion" else "usuario")
        subida_por_id = usuario["_id"] if usuario else ObjectId()

    if not archivo:
        return error_response("IMAGE_REQUIRED", 400)

    ahora = datetime.now(timezone.utc)
    public_id = None

    if CLOUDINARY_URL and cloudinary is not None:
        subida = cloudinary.uploader.upload(archivo, folder="helpdesk_tickets")
        url_imagen = subida["secure_url"]
        public_id = subida["public_id"]
    else:
        # Almacenamiento directo en MongoDB Atlas (Base64 Data URI)
        contenido = archivo.read()
        content_type = getattr(archivo, "content_type", None) or "image/jpeg"

        # Optimización y conversión a JPEG para que ocupe muy poco espacio en Atlas
        try:
            from PIL import Image
            img = Image.open(BytesIO(contenido))
            max_size = 1200
            if img.width > max_size or img.height > max_size:
                img.thumbnail((max_size, max_size))
            buf = BytesIO()
            img.convert("RGB").save(buf, format="JPEG", quality=80, optimize=True)
            contenido = buf.getvalue()
            content_type = "image/jpeg"
        except Exception:
            pass

        b64_str = base64.b64encode(contenido).decode("utf-8")
        url_imagen = f"data:{content_type};base64,{b64_str}"

    res = db.incidencias.update_one(
        {"_id": inc_id},
        {
            "$set": {"updated_at": ahora},
            "$push": {
                "imagenes": {
                    "url": url_imagen,
                    "public_id": public_id,
                    "subida_por_id": subida_por_id,
                    "tipo": tipo or "reporte",
                    "created_at": ahora,
                }
            },
        },
    )

    if res.matched_count == 0:
        return error_response("TICKET_NOT_FOUND", 404)

    return success_response({"url": url_imagen}, 201)


def obtener_imagen_gridfs(file_id_str):
    try:
        oid = ObjectId(file_id_str)
        fs = gridfs.GridFS(db)
        if not fs.exists(oid):
            return error_response("IMAGE_NOT_FOUND", 404)
        grid_out = fs.get(oid)
        response = Response(grid_out.read(), mimetype=grid_out.content_type or "image/jpeg")
        response.headers["Cache-Control"] = "public, max-age=31536000"
        response.headers["Access-Control-Allow-Origin"] = "*"
        return response
    except Exception:
        return error_response("INVALID_IMAGE_ID", 400)


# =========================================================
# NOTIFICACIONES
# =========================================================

def listar_notificaciones(user_id_str):
    user_id = _parse_object_id(user_id_str)
    if not user_id:
        return error_response("USER_NOT_FOUND", 404)

    docs = list(
        db.notificaciones.find({"usuario_id": user_id})
        .sort("created_at", -1)
        .limit(30)
    )
    return success_response(serializar_doc(docs), 200)


def marcar_notificacion_leida(notif_id_str, user_id_str):
    notif_id = _parse_object_id(notif_id_str)
    user_id = _parse_object_id(user_id_str)
    if not notif_id or not user_id:
        return error_response("NOTIFICATION_NOT_FOUND", 404)

    res = db.notificaciones.update_one(
        {"_id": notif_id, "usuario_id": user_id},
        {"$set": {"leida": True}},
    )
    if res.matched_count == 0:
        return error_response("NOTIFICATION_NOT_FOUND", 404)

    return success_response({"ok": True}, 200)


# =========================================================
# ESTRUCTURAS DE DATOS (PILA, COLA DE PRIORIDAD, TABLA HASH)
# =========================================================

def deshacer_accion_incidencia(inc_id_str):
    """
    Uso de la PILA (LIFO):
    Desapila (pop) la última modificación y restaura el estado anterior inmediato.
    """
    resultado = gestor_estructuras.deshacer_ultimo_cambio(inc_id_str, db)
    if not resultado:
        return error_response("NO_UNDO_AVAILABLE", 400)
    return success_response(serializar_doc(resultado), 200)


def obtener_cola_prioridad():
    """
    Uso de la COLA DE PRIORIDAD (Max-Heap):
    Devuelve los tickets pendientes ordenados por criticidad de mayor a menor.
    """
    tickets = gestor_estructuras.obtener_cola_prioridad()
    return success_response(serializar_doc(tickets), 200)


def desencolar_siguiente_ticket():
    """
    Uso de la COLA DE PRIORIDAD:
    Extrae el ticket más urgente de la cima del montículo para asignación técnica.
    """
    ticket = gestor_estructuras.desencolar_siguiente()
    if not ticket:
        return error_response("NO_PENDING_TICKETS", 404)
    return success_response(serializar_doc(ticket), 200)


def buscar_ticket_en_hash(clave):
    """
    Uso de la TABLA HASH (Hash Map):
    Búsqueda directa en memoria en tiempo O(1) por Folio (INC-XXXX) o ID.
    """
    ticket = gestor_estructuras.buscar_por_clave(clave)
    if not ticket:
        return error_response("TICKET_NOT_FOUND_IN_HASH", 404)
    return success_response(serializar_doc(ticket), 200)


def obtener_metricas_estructuras():
    """
    Devuelve el reporte completo y detallado de las 3 estructuras de datos
    para defensa académica del proyecto.
    """
    reporte = gestor_estructuras.obtener_metricas_completas()
    return success_response(serializar_doc(reporte), 200)

