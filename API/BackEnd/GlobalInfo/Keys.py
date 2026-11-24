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
    "mongodb://richiDB:richisRLDB@ac-sljytld-shard-00-00.vcqupu6.mongodb.net:27017,ac-sljytld-shard-00-01.vcqupu6.mongodb.net:27017,ac-sljytld-shard-00-02.vcqupu6.mongodb.net:27017/helpdesk_db?ssl=true&replicaSet=atlas-z450kw-shard-0&authSource=admin&retryWrites=true&w=majority",
)

DB_NAME = os.getenv("DB_NAME", "helpdesk_db")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "helpdesk-tec-secret-key-cambiala")
CLOUDINARY_URL = os.getenv("CLOUDINARY_URL", "")
