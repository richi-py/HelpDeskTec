// Selecciona (o crea) la base de datos en Atlas
db = db.getSiblingDB("helpdesk_db");

// =========================================================
// 1. COLECCIÓN: usuarios
// =========================================================
db.createCollection("usuarios", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["nombre", "correo", "password_hash", "rol", "activo", "created_at"],
      properties: {
        nombre: { bsonType: "string" },
        correo: { bsonType: "string" },
        password_hash: { bsonType: "string" },
        rol: { enum: ["usuario", "tecnico", "admin"] },
        area: { bsonType: ["string", "null"] },
        telefono: { bsonType: ["string", "null"] },
        avatar_url: { bsonType: ["string", "null"] },
        activo: { bsonType: "bool" },
        created_at: { bsonType: "date" }
      }
    }
  }
});

db.usuarios.createIndex({ correo: 1 }, { unique: true });

// =========================================================
// 2. COLECCIÓN: incidencias
// =========================================================
db.createCollection("incidencias", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "codigo", "usuario_id", "usuario_nombre", "tipo",
        "urgencia", "estado", "titulo", "descripcion", "created_at"
      ],
      properties: {
        codigo: { bsonType: "string" },
        usuario_id: { bsonType: "objectId" },
        usuario_nombre: { bsonType: "string" },
        tecnico_id: { bsonType: ["objectId", "null"] },
        tecnico_nombre: { bsonType: ["string", "null"] },
        tipo: { enum: ["hardware", "software", "red", "otro"] },
        urgencia: { enum: ["baja", "media", "alta"] },
        estado: { enum: ["pendiente", "asignada", "en_proceso", "resuelta"] },
        titulo: { bsonType: "string" },
        descripcion: { bsonType: "string" },
        solucion: { bsonType: ["string", "null"] },
        imagenes: { bsonType: "array" },
        historial: { bsonType: "array" },
        comentarios: { bsonType: "array" },
        created_at: { bsonType: "date" },
        assigned_at: { bsonType: ["date", "null"] },
        started_at: { bsonType: ["date", "null"] },
        resolved_at: { bsonType: ["date", "null"] },
        updated_at: { bsonType: "date" }
      }
    }
  }
});

db.incidencias.createIndex({ codigo: 1 }, { unique: true });
db.incidencias.createIndex({ tecnico_id: 1, estado: 1 });
db.incidencias.createIndex({ usuario_id: 1, created_at: -1 });

// =========================================================
// 3. COLECCIÓN: notificaciones
// =========================================================
db.createCollection("notificaciones", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["usuario_id", "mensaje", "tipo", "leida", "created_at"],
      properties: {
        usuario_id: { bsonType: "objectId" },
        incidencia_id: { bsonType: ["objectId", "null"] },
        codigo: { bsonType: ["string", "null"] },
        mensaje: { bsonType: "string" },
        tipo: { enum: ["cambio_estado", "comentario", "resuelta", "soporte"] },
        leida: { bsonType: "bool" },
        created_at: { bsonType: "date" }
      }
    }
  }
});

db.notificaciones.createIndex({ usuario_id: 1, leida: 1, created_at: -1 });

// =========================================================
// 4. COLECCIÓN: contadores (secuencia para códigos INC-0001)
// =========================================================
db.createCollection("contadores");

// =========================================================
// 5. DATOS INICIALES ENLAZADOS (SEED)
// =========================================================
const ahora = new Date();
const hace = (horas) => new Date(ahora.getTime() - horas * 60 * 60 * 1000);

const adanId = new ObjectId();
const carlosId = new ObjectId();
const mariaId = new ObjectId();

// Password por defecto: "123456" (generado con werkzeug.security para login directo en Flask)
const hashTemporal = "scrypt:32768:8:1$uZvoXfK5v1KBlOAZ$3c9ca275d4d167f10d2ab66373213e4c9020db6018b07904f3e5921351f56f02246bc693bd74865ec41453fbf933a0b089c768f849a2a89b0b517e9e0ad769d9";

db.usuarios.insertMany([
  {
    _id: adanId,
    nombre: "Adán Velasco",
    correo: "adan@empresa.com",
    password_hash: hashTemporal,
    rol: "usuario",
    area: "Administración",
    telefono: "5551112233",
    avatar_url: null,
    activo: true,
    created_at: hace(72)
  },
  {
    _id: carlosId,
    nombre: "Carlos López",
    correo: "carlos@empresa.com",
    password_hash: hashTemporal,
    rol: "tecnico",
    area: "Soporte Técnico",
    telefono: "5554445566",
    avatar_url: null,
    activo: true,
    created_at: hace(120)
  },
  {
    _id: mariaId,
    nombre: "María González",
    correo: "maria@empresa.com",
    password_hash: hashTemporal,
    rol: "tecnico",
    area: "Mesa de Ayuda",
    telefono: "5557778899",
    avatar_url: null,
    activo: true,
    created_at: hace(120)
  }
]);

const inc41Id = new ObjectId();
const inc42Id = new ObjectId();
const inc39Id = new ObjectId();

db.incidencias.insertMany([
  {
    _id: inc41Id,
    codigo: "INC-0041",
    usuario_id: adanId,
    usuario_nombre: "Adán Velasco",
    tecnico_id: carlosId,
    tecnico_nombre: "Carlos López",
    tipo: "red",
    urgencia: "alta",
    estado: "asignada",
    titulo: "Fallo de red en aula 12",
    descripcion: "Sin acceso a internet ni red local en los equipos de la fila B.",
    solucion: null,
    imagenes: [
      {
        url: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
        public_id: "sample",
        subida_por_id: adanId,
        tipo: "reporte",
        created_at: hace(2)
      }
    ],
    historial: [
      { estado: "creada", por_id: adanId, por_nombre: "Adán Velasco", por_rol: "Usuario", fecha: hace(2) },
      { estado: "asignada", por_id: mariaId, por_nombre: "María González", por_rol: "Técnico", fecha: hace(1) }
    ],
    comentarios: [],
    created_at: hace(2),
    assigned_at: hace(1),
    started_at: null,
    resolved_at: null,
    updated_at: hace(1)
  },
  {
    _id: inc42Id,
    codigo: "INC-0042",
    usuario_id: adanId,
    usuario_nombre: "Adán Velasco",
    tecnico_id: carlosId,
    tecnico_nombre: "Carlos López",
    tipo: "hardware",
    urgencia: "media",
    estado: "en_proceso",
    titulo: "Error en equipo de cómputo",
    descripcion: "La computadora no enciende, no muestra imagen en el monitor.",
    solucion: null,
    imagenes: [],
    historial: [
      { estado: "creada", por_id: adanId, por_nombre: "Adán Velasco", por_rol: "Usuario", fecha: hace(5) },
      { estado: "asignada", por_id: mariaId, por_nombre: "María González", por_rol: "Técnico", fecha: hace(3) },
      { estado: "en_proceso", por_id: carlosId, por_nombre: "Carlos López", por_rol: "Técnico", fecha: hace(2) }
    ],
    comentarios: [
      {
        autor_id: carlosId,
        autor_nombre: "Carlos López",
        autor_rol: "tecnico",
        mensaje: "Revisando cable de energía y fuente de poder.",
        created_at: hace(2)
      }
    ],
    created_at: hace(5),
    assigned_at: hace(3),
    started_at: hace(2),
    resolved_at: null,
    updated_at: hace(2)
  },
  {
    _id: inc39Id,
    codigo: "INC-0039",
    usuario_id: adanId,
    usuario_nombre: "Adán Velasco",
    tecnico_id: carlosId,
    tecnico_nombre: "Carlos López",
    tipo: "software",
    urgencia: "baja",
    estado: "resuelta",
    titulo: "Instalación de software",
    descripcion: "Se requiere licencia e instalación de paquetería de oficina.",
    solucion: "Se instaló la suite completa y se activó la licencia institucional.",
    imagenes: [],
    historial: [
      { estado: "creada", por_id: adanId, por_nombre: "Adán Velasco", por_rol: "Usuario", fecha: hace(26) },
      { estado: "asignada", por_id: mariaId, por_nombre: "María González", por_rol: "Técnico", fecha: hace(25) },
      { estado: "en_proceso", por_id: carlosId, por_nombre: "Carlos López", por_rol: "Técnico", fecha: hace(24.5) },
      { estado: "resuelta", por_id: carlosId, por_nombre: "Carlos López", por_rol: "Técnico", fecha: hace(24) }
    ],
    comentarios: [],
    created_at: hace(26),
    assigned_at: hace(25),
    started_at: hace(24.5),
    resolved_at: hace(24),
    updated_at: hace(24)
  }
]);

db.notificaciones.insertMany([
  {
    usuario_id: adanId,
    incidencia_id: inc42Id,
    codigo: "INC-0042",
    mensaje: "Tu incidencia #INC-0042 cambió a En proceso.",
    tipo: "cambio_estado",
    leida: false,
    created_at: hace(2)
  },
  {
    usuario_id: adanId,
    incidencia_id: inc39Id,
    codigo: "INC-0039",
    mensaje: "Tu incidencia #INC-0039 fue resuelta.",
    tipo: "resuelta",
    leida: true,
    created_at: hace(24)
  }
]);

db.contadores.insertOne({ _id: "incidencias", seq: 42 });