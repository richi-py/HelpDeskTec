from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


class NodoPila:
    def __init__(self, dato: Dict[str, Any], siguiente: Optional['NodoPila'] = None):
        self.dato = dato
        self.siguiente = siguiente


class PilaHistorial:

    def __init__(self, ticket_id: str):
        self.ticket_id = str(ticket_id)
        self.tope: Optional[NodoPila] = None
        self._longitud: int = 0

    def esta_vacia(self) -> bool:
        return self.tope is None

    def push(self, evento: Dict[str, Any]) -> None:
        if "fecha" not in evento or not evento["fecha"]:
            evento["fecha"] = datetime.now(timezone.utc).isoformat()
        nuevo_nodo = NodoPila(dato=evento, siguiente=self.tope)
        self.tope = nuevo_nodo
        self._longitud += 1

    def pop(self) -> Optional[Dict[str, Any]]:
        if self.esta_vacia():
            return None
        nodo_extraido = self.tope
        self.tope = self.tope.siguiente
        self._longitud -= 1
        return nodo_extraido.dato

    def peek(self) -> Optional[Dict[str, Any]]:
        return self.tope.dato if self.tope else None

    def tamano(self) -> int:
        return self._longitud

    def obtener_historial_cronologico_inverso(self) -> List[Dict[str, Any]]:

        resultado = []
        actual = self.tope
        while actual:
            resultado.append(actual.dato)
            actual = actual.siguiente
        return resultado

    def obtener_historial_cronologico(self) -> List[Dict[str, Any]]:

        inverso = self.obtener_historial_cronologico_inverso()
        return list(reversed(inverso))

    def deshacer_ultimo_estado(self) -> Optional[Dict[str, Any]]:

        if self.tamano() <= 1:
            # No se puede deshacer el estado inicial de creación
            return None
        ultimo_evento = self.pop()
        estado_previo = self.peek()
        return {
            "evento_deshecho": ultimo_evento,
            "estado_restaurado": estado_previo.get("estado") if estado_previo else "pendiente",
            "detalles_previos": estado_previo,
        }
