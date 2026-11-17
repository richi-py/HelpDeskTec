import os
import sys
from datetime import timedelta

from flask import Flask, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager, get_jwt, get_jwt_identity, jwt_required

# Permite ejecutar Directions.py desde la raíz del proyecto o desde API/
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from BackEnd.GlobalInfo.Keys import JWT_SECRET_KEY
from BackEnd.Functions import (
    agregar_comentario,
    autenticar_usuario,
    cambiar_estado_incidencia,
    crear_incidencia,
    listar_incidencias,
    listar_notificaciones,
    marcar_notificacion_leida,
    obtener_incidencia_por_id,
    obtener_perfil,
    obtener_resumen,
    registrar_usuario,
    subir_imagen_incidencia,
)

app = Flask(__name__, static_folder="static")
app.config["JWT_SECRET_KEY"] = JWT_SECRET_KEY
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=7)

CORS(app)
JWTManager(app)


# =========================================================
# AUTH Y PERFIL
# =========================================================

@app.route("/api/auth/register", methods=["POST"])
def route_register():
    return registrar_usuario(request.get_json() or {})


@app.route("/api/auth/login", methods=["POST"])
def route_login():
    return autenticar_usuario(request.get_json() or {})


@app.route("/api/auth/perfil", methods=["GET"])
@jwt_required()
def route_perfil():
    return obtener_perfil(get_jwt_identity())


# =========================================================
# INCIDENCIAS
# =========================================================

@app.route("/api/incidencias/resumen", methods=["GET"])
@jwt_required()
def route_resumen():
    claims = get_jwt()
    return obtener_resumen(get_jwt_identity(), claims.get("rol"))


@app.route("/api/incidencias", methods=["GET"])
@jwt_required()
def route_listar_incidencias():
    claims = get_jwt()
    estado = request.args.get("estado")
    return listar_incidencias(get_jwt_identity(), claims.get("rol"), estado)


@app.route("/api/incidencias", methods=["POST"])
@jwt_required()
def route_crear_incidencia():
    claims = get_jwt()
    return crear_incidencia(
        get_jwt_identity(),
        claims.get("nombre"),
        request.get_json() or {},
    )


@app.route("/api/incidencias/<inc_id>", methods=["GET"])
@jwt_required()
def route_detalle_incidencia(inc_id):
    return obtener_incidencia_por_id(inc_id)


@app.route("/api/incidencias/<inc_id>/estado", methods=["PATCH"])
@jwt_required()
def route_cambiar_estado(inc_id):
    claims = get_jwt()
    return cambiar_estado_incidencia(
        inc_id,
        get_jwt_identity(),
        claims.get("nombre"),
        request.get_json() or {},
    )


@app.route("/api/incidencias/<inc_id>/comentarios", methods=["POST"])
@jwt_required()
def route_agregar_comentario(inc_id):
    claims = get_jwt()
    return agregar_comentario(
        inc_id,
        get_jwt_identity(),
        claims.get("nombre"),
        claims.get("rol"),
        request.get_json() or {},
    )


@app.route("/api/incidencias/<inc_id>/imagenes", methods=["POST"])
@jwt_required()
def route_subir_imagen(inc_id):
    archivo = request.files.get("imagen")
    tipo = request.form.get("tipo", "reporte")
    return subir_imagen_incidencia(
        inc_id,
        get_jwt_identity(),
        archivo,
        tipo,
        request.host_url,
    )


# =========================================================
# NOTIFICACIONES
# =========================================================

@app.route("/api/notificaciones", methods=["GET"])
@jwt_required()
def route_listar_notificaciones():
    return listar_notificaciones(get_jwt_identity())


@app.route("/api/notificaciones/<notif_id>/leida", methods=["PATCH"])
@jwt_required()
def route_marcar_notificacion(notif_id):
    return marcar_notificacion_leida(notif_id, get_jwt_identity())


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
