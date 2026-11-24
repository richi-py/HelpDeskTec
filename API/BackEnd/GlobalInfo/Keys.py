import os
from pathlib import Path
from dotenv import load_dotenv

# Carga .env ubicado en la carpeta API/ o en la raíz del proyecto
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

# Cadena de conexión a MongoDB Atlas (puedes definir MONGO_URI en tu .env o pegarla aquí)
MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb+srv://USUARIO:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority",
)

DB_NAME = os.getenv("DB_NAME", "helpdesk_db")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "helpdesk-tec-secret-key-cambiala")
CLOUDINARY_URL = os.getenv("CLOUDINARY_URL", "")
