from flask import jsonify

MESSAGES = {
    "MISSING_FIELDS": "Faltan campos obligatorios.",
    "EMAIL_EXISTS": "El correo ya está registrado.",
    "INVALID_CREDENTIALS": "Correo o contraseña incorrectos.",
    "USER_NOT_FOUND": "Usuario no encontrado.",
    "TICKET_NOT_FOUND": "Incidencia no encontrada.",
    "INVALID_STATE": "Estado de incidencia no válido.",
    "IMAGE_REQUIRED": "No se envió ninguna imagen.",
    "NOTIFICATION_NOT_FOUND": "Notificación no encontrada.",
    "INTERNAL_ERROR": "Ocurrió un error interno en el servidor.",
}


def success_response(data, status_code=200):
    return jsonify(data), status_code


def error_response(message_key_or_text, status_code=400):
    message = MESSAGES.get(message_key_or_text, message_key_or_text)
    return jsonify({"error": message}), status_code
