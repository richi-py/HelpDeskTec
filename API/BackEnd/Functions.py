import os
import uuid
from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId
from flask_jwt_extended import create_access_token
from pymongo import MongoClient, ReturnDocument
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from BackEnd.GlobalInfo.Keys import CLOUDINARY_URL, DB_NAME, MONGO_URI
from BackEnd.GlobalInfo.ResponseMessages import error_response, success_response

try:
    import cloudinary.uploader
except ImportError:
    cloudinary = None

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

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


def obtener_perfil(user_id_str):
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
    user_id = _parse_object_id(user_id_str)
    if not user_id:
        return error_response("USER_NOT_FOUND", 404)

    filtro = {"tecnico_id": user_id} if rol == "tecnico" else {"usuario_id": user_id}
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
    user_id = _parse_object_id(user_id_str)
    if not user_id:
        return error_response("USER_NOT_FOUND", 404)

    filtro = {}
    if rol == "usuario":
        filtro["usuario_id"] = user_id
    elif rol == "tecnico" and estado != "pendiente":
        filtro["$or"] = [{"tecnico_id": user_id}, {"estado": "pendiente"}]

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
    return success_response(serializar_doc(doc), 201)


def obtener_incidencia_por_id(inc_id_str):
    inc_id = _parse_object_id(inc_id_str)
    if not inc_id:
        return error_response("TICKET_NOT_FOUND", 404)

    doc = db.incidencias.find_one({"_id": inc_id})
    if not doc:
        return error_response("TICKET_NOT_FOUND", 404)

    return success_response(serializar_doc(doc), 200)


def cambiar_estado_incidencia(inc_id_str, user_id_str, nombre_usuario, data):
    inc_id = _parse_object_id(inc_id_str)
    tecnico_id = _parse_object_id(user_id_str)
    if not inc_id or not tecnico_id:
        return error_response("TICKET_NOT_FOUND", 404)

    nuevo_estado = data.get("estado")
    if nuevo_estado not in ESTADOS_VALIDOS:
        return error_response("INVALID_STATE", 400)

    ahora = datetime.now(timezone.utc)
    campos_set = {"estado": nuevo_estado, "updated_at": ahora}

    if nuevo_estado == "asignada":
        campos_set.update(
            {
                "assigned_at": ahora,
                "tecnico_id": tecnico_id,
                "tecnico_nombre": nombre_usuario or "Técnico",
            }
        )
    elif nuevo_estado == "en_proceso":
        campos_set["started_at"] = ahora
    elif nuevo_estado == "resuelta":
        campos_set.update(
            {
                "resolved_at": ahora,
                "solucion": data.get("solucion", ""),
            }
        )

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

    db.notificaciones.insert_one(
        {
            "usuario_id": incidencia["usuario_id"],
            "incidencia_id": incidencia["_id"],
            "codigo": incidencia["codigo"],
            "mensaje": f"Tu incidencia #{incidencia['codigo']} cambió a {nuevo_estado}.",
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
    subida_por_id = _parse_object_id(user_id_str)
    if not inc_id or not subida_por_id:
        return error_response("TICKET_NOT_FOUND", 404)

    if not archivo:
        return error_response("IMAGE_REQUIRED", 400)

    ahora = datetime.now(timezone.utc)
    public_id = None

    if CLOUDINARY_URL and cloudinary is not None:
        subida = cloudinary.uploader.upload(archivo, folder="helpdesk_tickets")
        url_imagen = subida["secure_url"]
        public_id = subida["public_id"]
    else:
        ext = os.path.splitext(secure_filename(archivo.filename or ""))[1] or ".jpg"
        nombre_archivo = f"{uuid.uuid4().hex}{ext}"
        archivo.save(os.path.join(UPLOAD_DIR, nombre_archivo))
        url_imagen = f"{host_url}static/uploads/{nombre_archivo}"

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
