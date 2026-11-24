from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from bson import ObjectId

from BackEnd.Estructuras.cola_prioridad import ColaPrioridadTickets
from BackEnd.Estructuras.pila import PilaHistorial
from BackEnd.Estructuras.tabla_hash import TablaHashTickets


class GestorEstructuras:

    def __init__(self):
        self.tabla_hash = TablaHashTickets(capacidad_inicial=31)
        self.cola_prioridad = ColaPrioridadTickets()
        # Mapea ticket_id -> PilaHistorial individual
        self.pilas_historial: Dict[str, PilaHistorial] = {}
        self._inicializado = False

    def inicializar_desde_mongo(self, db) -> None:

        try:
            incidencias = list(db.incidencias.find({}))
            for inc in incidencias:
                t_id = str(inc.get("_id"))
                codigo = str(inc.get("codigo", ""))
                estado = str(inc.get("estado", "pendiente")).lower()

                # 1. Almacenar en Tabla Hash bajo dos llaves (ID y Código) para búsqueda O(1)
                self.tabla_hash.insertar(t_id, inc)
                if codigo:
                    self.tabla_hash.insertar(codigo, inc)

                # 2. Inicializar Pila de Historial individual
                pila = PilaHistorial(ticket_id=t_id)
                historial_existente = inc.get("historial", [])
                if isinstance(historial_existente, list):
                    for evento in historial_existente:
                        pila.push(evento)
                else:
                    pila.push({"estado": estado, "fecha": inc.get("created_at")})
                self.pilas_historial[t_id] = pila

                # 3. Si el ticket no está resuelto, agregarlo a la Cola de Prioridad
                if estado in ("pendiente", "asignada", "en_proceso"):
                    self.cola_prioridad.encolar(inc)

            self._inicializado = True
            print(f"[Estructuras] Inicializadas exitosamente con {len(incidencias)} tickets desde MongoDB Atlas.")
        except Exception as e:
            print(f"[Estructuras] Error cargando datos iniciales: {e}")

    def registrar_nuevo_ticket(self, ticket: Dict[str, Any]) -> None:

        t_id = str(ticket.get("id") or ticket.get("_id") or "")
        codigo = str(ticket.get("codigo", ""))

        # 1. Tabla Hash
        self.tabla_hash.insertar(t_id, ticket)
        if codigo:
            self.tabla_hash.insertar(codigo, ticket)

        # 2. Pila de Historial
        pila = PilaHistorial(ticket_id=t_id)
        evento_inicial = {
            "estado": ticket.get("estado", "pendiente"),
            "por_id": str(ticket.get("usuario_id", "")),
            "por_nombre": ticket.get("usuario_nombre", "Usuario"),
            "por_rol": "Usuario",
            "accion": "Creación de ticket",
            "fecha": ticket.get("created_at") or datetime.now(timezone.utc).isoformat(),
        }
        pila.push(evento_inicial)
        self.pilas_historial[t_id] = pila

        # 3. Cola de Prioridad (tickets nuevos ingresan a la cola)
        self.cola_prioridad.encolar(ticket)

    def registrar_cambio_estado(
        self,
        ticket_id: str,
        ticket_actualizado: Dict[str, Any],
        evento_historial: Dict[str, Any]
    ) -> None:

        t_id = str(ticket_id)
        codigo = str(ticket_actualizado.get("codigo", ""))
        nuevo_estado = str(ticket_actualizado.get("estado", "")).lower()

        # 1. Actualizar en Tabla Hash O(1)
        self.tabla_hash.insertar(t_id, ticket_actualizado)
        if codigo:
            self.tabla_hash.insertar(codigo, ticket_actualizado)

        # 2. Apilar el cambio en la Pila de Historial
        pila = self.pilas_historial.get(t_id)
        if not pila:
            pila = PilaHistorial(ticket_id=t_id)
            self.pilas_historial[t_id] = pila
        pila.push(evento_historial)

        # 3. Actualizar Cola de Prioridad
        if nuevo_estado in ("resuelta", "resuelto"):
            self.cola_prioridad.eliminar_por_id(t_id)
        else:
            self.cola_prioridad.actualizar_ticket(ticket_actualizado)

    def deshacer_ultimo_cambio(self, ticket_id: str, db) -> Optional[Dict[str, Any]]:

        t_id = str(ticket_id)
        pila = self.pilas_historial.get(t_id)
        if not pila or pila.tamano() <= 1:
            return None

        resultado_deshacer = pila.deshacer_ultimo_estado()
        if not resultado_deshacer:
            return None

        estado_anterior = resultado_deshacer["estado_restaurado"]
        ahora = datetime.now(timezone.utc)

        # Sincronizar en MongoDB Atlas
        try:
            oid = ObjectId(t_id) if ObjectId.is_valid(t_id) else None
            filtro = {"_id": oid} if oid else {"id": t_id}

            actualizacion = {
                "$set": {"estado": estado_anterior, "updated_at": ahora},
                "$pop": {"historial": 1},  # Retira el último elemento del arreglo en Mongo
            }
            db.incidencias.update_one(filtro, actualizacion)
            doc_actualizado = db.incidencias.find_one(filtro)

            if doc_actualizado:
                # Sincronizar en Tabla Hash y Cola de Prioridad
                self.tabla_hash.insertar(t_id, doc_actualizado)
                codigo = str(doc_actualizado.get("codigo", ""))
                if codigo:
                    self.tabla_hash.insertar(codigo, doc_actualizado)

                if estado_anterior in ("resuelta", "resuelto"):
                    self.cola_prioridad.eliminar_por_id(t_id)
                else:
                    self.cola_prioridad.actualizar_ticket(doc_actualizado)

            return {
                "ok": True,
                "ticket_id": t_id,
                "estado_anterior_restaurado": estado_anterior,
                "evento_deshecho": resultado_deshacer["evento_deshecho"],
                "pila_tamano_restante": pila.tamano(),
            }
        except Exception as e:
            print(f"[Estructuras] Error al deshacer acción: {e}")
            return None

    def buscar_por_clave(self, clave: str) -> Optional[Dict[str, Any]]:

        return self.tabla_hash.buscar(clave)

    def obtener_cola_prioridad(self) -> List[Dict[str, Any]]:
        return self.cola_prioridad.obtener_lista_ordenada()

    def desencolar_siguiente(self) -> Optional[Dict[str, Any]]:
        return self.cola_prioridad.desencolar()

    def obtener_metricas_completas(self) -> Dict[str, Any]:

        metricas_hash = self.tabla_hash.obtener_metricas()
        total_pilas = len(self.pilas_historial)
        total_eventos_apilados = sum(p.tamano() for p in self.pilas_historial.values())

        return {
            "resumen_academico": {
                "materia": "Estructura de Datos",
                "lenguaje": "Python 3",
                "estructuras_integradas": ["Pila (Stack)", "Cola de Prioridad (Priority Queue)", "Tabla Hash (Hash Map)"],
            },
            "pila_historial": {
                "principio": "LIFO (Last In, First Out)",
                "complejidad_operaciones": "Push O(1), Pop O(1), Peek O(1)",
                "pilas_activas": total_pilas,
                "total_eventos_registrados": total_eventos_apilados,
                "soporte_undo": True,
            },
            "cola_prioridad": {
                "principio": "Max-Heap con Desempate FIFO",
                "complejidad_operaciones": "Encolar O(log n), Desencolar O(log n), Peek O(1)",
                "tickets_en_cola": self.cola_prioridad.tamano(),
                "niveles_urgencia": {"critica": 4, "alta": 3, "media": 2, "baja": 1},
                "siguiente_ticket": self.cola_prioridad.ver_frente(),
            },
            "tabla_hash": metricas_hash,
        }


# Instancia global compartida en memoria
gestor_estructuras = GestorEstructuras()
