"""
Script para inicializar la base de datos de MongoDB Atlas con datos de prueba.
Detecta automáticamente el nodo PRIMARIO del clúster para garantizar la escritura.

Uso:
    cd API
    python seed_db.py
"""
import os
import sys
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from pymongo import MongoClient
from werkzeug.security import generate_password_hash

# Carga variables de entorno
from BackEnd.GlobalInfo.Keys import MONGO_URI, DB_NAME

def get_writable_client():
    print(f"[*] Conectando a MongoDB Atlas...")
    base_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=10000)
    
    # 1. Obtener información de réplica
    hello = base_client.admin.command('hello')
    is_writable = hello.get('isWritablePrimary', False) or hello.get('ismaster', False)
    primary_host = hello.get('primary')

    if is_writable:
        print("[+] Conectado directamente al nodo PRIMARIO.")
        return base_client
    
    if primary_host:
        print(f"[*] El nodo actual es secundario. El nodo PRIMARIO es: {primary_host}")
        # Reemplazar el host en la URI para apuntar al primario
        import re
        primary_uri = re.sub(r'@[^/]+/', f'@{primary_host}/', MONGO_URI)
        print(f"[*] Reconectando al nodo primario...")
        return MongoClient(primary_uri, serverSelectionTimeoutMS=10000)
    
    return base_client

def seed():
    client = get_writable_client()
    db = client[DB_NAME]
    
    print(f"[+] Conectado a la base de datos: {DB_NAME}")

    # 1. Limpiar colecciones anteriores para reiniciar limpio
    print("[*] Limpiando datos anteriores...")
    db.usuarios.delete_many({})
    db.incidencias.delete_many({})
    db.notificaciones.delete_many({})
    db.contadores.delete_many({})

    # 2. Crear índices
    print("[*] Creando índices...")
    db.usuarios.create_index([("correo", 1)], unique=True)
    db.incidencias.create_index([("codigo", 1)], unique=True)
    db.incidencias.create_index([("estado", 1), ("tecnico_id", 1)])
    db.incidencias.create_index([("usuario_id", 1)])
    db.notificaciones.create_index([("usuario_id", 1), ("leida", 1)])

    # 3. Datos iniciales
    ahora = datetime.now(timezone.utc)
    pw_hash = generate_password_hash("123456")

    # IDs referenciados
    adan_id = ObjectId()
    carlos_id = ObjectId()
    maria_id = ObjectId()

    usuarios = [
        {
            "_id": adan_id,
            "nombre": "Adán Velasco",
            "correo": "adan@empresa.com",
            "password_hash": pw_hash,
            "rol": "usuario",
            "area": "Administración",
            "telefono": "5551112233",
            "avatar_url": None,
            "activo": True,
            "created_at": ahora - timedelta(hours=72)
        },
        {
            "_id": carlos_id,
            "nombre": "Carlos López",
            "correo": "carlos@empresa.com",
            "password_hash": pw_hash,
            "rol": "tecnico",
            "area": "Soporte Técnico",
            "telefono": "5554445566",
            "avatar_url": None,
            "activo": True,
            "created_at": ahora - timedelta(hours=120)
        },
        {
            "_id": maria_id,
            "nombre": "María González",
            "correo": "maria@empresa.com",
            "password_hash": pw_hash,
            "rol": "tecnico",
            "area": "Mesa de Ayuda",
            "telefono": "5557778899",
            "avatar_url": None,
            "activo": True,
            "created_at": ahora - timedelta(hours=120)
        }
    ]
    db.usuarios.insert_many(usuarios)
    print(f"[+] Insertados {len(usuarios)} usuarios (contraseña: 123456)")

    # Incidencias
    inc_41_id = ObjectId()
    inc_42_id = ObjectId()
    inc_39_id = ObjectId()

    incidencias = [
        {
            "_id": inc_41_id,
            "codigo": "INC-0041",
            "usuario_id": adan_id,
            "usuario_nombre": "Adán Velasco",
            "tecnico_id": carlos_id,
            "tecnico_nombre": "Carlos López",
            "tipo": "hardware",
            "urgencia": "alta",
            "estado": "en_proceso",
            "titulo": "Fallo en Impresora Principal HP",
            "descripcion": "La impresora láser del área de recepción marca atasco de papel continuo y emite un pitido de error al intentar imprimir facturas.",
            "ubicacion": "Recepción - Planta Baja",
            "imagenes": [
                {
                    "url": "https://picsum.photos/800/600?random=1",
                    "public_id": "seed/impresora_1",
                    "uploaded_at": ahora - timedelta(hours=2)
                }
            ],
            "historial": [
                {
                    "estado_anterior": "pendiente",
                    "estado_nuevo": "asignada",
                    "cambiado_por_id": carlos_id,
                    "cambiado_por_nombre": "Carlos López",
                    "nota": "Incidencia asignada automáticamente al técnico de guardia.",
                    "fecha": ahora - timedelta(hours=1, minutes=45)
                },
                {
                    "estado_anterior": "asignada",
                    "estado_nuevo": "en_proceso",
                    "cambiado_por_id": carlos_id,
                    "cambiado_por_nombre": "Carlos López",
                    "nota": "Revisando rodillos y mecanismo de tracción de papel.",
                    "fecha": ahora - timedelta(hours=1)
                }
            ],
            "comentarios": [
                {
                    "_id": ObjectId(),
                    "autor_id": carlos_id,
                    "autor_nombre": "Carlos López",
                    "autor_rol": "tecnico",
                    "mensaje": "Se requiere cambiar el rodillo de goma. Ya solicité refacción al almacén.",
                    "fecha": ahora - timedelta(minutes=40)
                }
            ],
            "created_at": ahora - timedelta(hours=2),
            "updated_at": ahora - timedelta(minutes=40)
        },
        {
            "_id": inc_42_id,
            "codigo": "INC-0042",
            "usuario_id": adan_id,
            "usuario_nombre": "Adán Velasco",
            "tecnico_id": carlos_id,
            "tecnico_nombre": "Carlos López",
            "tipo": "red",
            "urgencia": "media",
            "estado": "asignada",
            "titulo": "Sin conexión a internet en Sala de Juntas B",
            "descripcion": "El cable de red de la mesa principal no da enlace y la red Wi-Fi no alcanza con buena señal.",
            "ubicacion": "Edificio A - Sala B",
            "imagenes": [],
            "historial": [
                {
                    "estado_anterior": "pendiente",
                    "estado_nuevo": "asignada",
                    "cambiado_por_id": carlos_id,
                    "cambiado_por_nombre": "Carlos López",
                    "nota": "Asignada para revisión de switch y punto de red.",
                    "fecha": ahora - timedelta(hours=4)
                }
            ],
            "comentarios": [],
            "created_at": ahora - timedelta(hours=5),
            "updated_at": ahora - timedelta(hours=4)
        },
        {
            "_id": inc_39_id,
            "codigo": "INC-0039",
            "usuario_id": adan_id,
            "usuario_nombre": "Adán Velasco",
            "tecnico_id": carlos_id,
            "tecnico_nombre": "Carlos López",
            "tipo": "software",
            "urgencia": "baja",
            "estado": "resuelta",
            "titulo": "Instalación y activación de paquetería Office",
            "descripcion": "Actualización de licencia caducada en equipo de escritorio.",
            "ubicacion": "Oficina 204",
            "imagenes": [],
            "historial": [
                {
                    "estado_anterior": "pendiente",
                    "estado_nuevo": "resuelta",
                    "cambiado_por_id": carlos_id,
                    "cambiado_por_nombre": "Carlos López",
                    "nota": "Licencia institucional renovada con éxito.",
                    "fecha": ahora - timedelta(hours=24)
                }
            ],
            "comentarios": [],
            "created_at": ahora - timedelta(hours=30),
            "updated_at": ahora - timedelta(hours=24)
        }
    ]
    db.incidencias.insert_many(incidencias)
    print(f"[+] Insertadas {len(incidencias)} incidencias con historial y comentarios.")

    # Notificaciones
    notificaciones = [
        {
            "usuario_id": carlos_id,
            "incidencia_id": inc_41_id,
            "codigo_incidencia": "INC-0041",
            "titulo": "Nueva incidencia asignada",
            "mensaje": "Tienes asignada la incidencia INC-0041: Fallo en Impresora Principal HP",
            "leida": False,
            "created_at": ahora - timedelta(hours=1, minutes=45)
        },
        {
            "usuario_id": adan_id,
            "incidencia_id": inc_41_id,
            "codigo_incidencia": "INC-0041",
            "titulo": "Incidencia en atención",
            "mensaje": "Carlos López comenzó a atender tu incidencia INC-0041.",
            "leida": True,
            "created_at": ahora - timedelta(hours=1)
        }
    ]
    db.notificaciones.insert_many(notificaciones)
    print(f"[+] Insertadas {len(notificaciones)} notificaciones.")

    # Contador
    db.contadores.update_one(
        {"_id": "incidencias_seq"},
        {"$set": {"seq": 42}},
        upsert=True
    )
    print("[+] Secuencia de incidencias inicializada en INC-0042.")
    print("\n[✔] ¡Base de datos poblada exitosamente en MongoDB Atlas!")

if __name__ == "__main__":
    seed()
