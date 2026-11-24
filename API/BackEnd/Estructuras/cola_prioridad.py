import time
from typing import Any, Dict, List, Optional


NIVELES_URGENCIA = {
    "critica": 4,
    "critico": 4,
    "alta": 3,
    "alto": 3,
    "media": 2,
    "medio": 2,
    "baja": 1,
    "bajo": 1,
}


class ElementoPrioridad:
    def __init__(self, prioridad: int, secuencia: int, ticket: Dict[str, Any]):
        self.prioridad = prioridad
        self.secuencia = secuencia  # Para desempate FIFO (menor secuencia = llegó antes)
        self.ticket = ticket

    def tiene_mayor_prioridad_que(self, otro: 'ElementoPrioridad') -> bool:
        if self.prioridad != otro.prioridad:
            return self.prioridad > otro.prioridad
        # En caso de empate en urgencia, atiende al que llegó primero
        return self.secuencia < otro.secuencia


class ColaPrioridadTickets:
    def __init__(self):
        self._heap: List[ElementoPrioridad] = []
        self._contador_secuencia: int = 0

    def esta_vacia(self) -> bool:
        return len(self._heap) == 0

    def tamano(self) -> int:
        return len(self._heap)

    def _padre(self, i: int) -> int:
        return (i - 1) // 2

    def _hijo_izq(self, i: int) -> int:
        return 2 * i + 1

    def _hijo_der(self, i: int) -> int:
        return 2 * i + 2

    def _flotar(self, indice: int) -> None:
        while indice > 0:
            padre_idx = self._padre(indice)
            if self._heap[indice].tiene_mayor_prioridad_que(self._heap[padre_idx]):
                self._heap[indice], self._heap[padre_idx] = self._heap[padre_idx], self._heap[indice]
                indice = padre_idx
            else:
                break

    def _hundir(self, indice: int) -> None:
        tam = len(self._heap)
        while True:
            izq = self._hijo_izq(indice)
            der = self._hijo_der(indice)
            mayor = indice

            if izq < tam and self._heap[izq].tiene_mayor_prioridad_que(self._heap[mayor]):
                mayor = izq
            if der < tam and self._heap[der].tiene_mayor_prioridad_que(self._heap[mayor]):
                mayor = der

            if mayor != indice:
                self._heap[indice], self._heap[mayor] = self._heap[mayor], self._heap[indice]
                indice = mayor
            else:
                break

    def encolar(self, ticket: Dict[str, Any]) -> None:

        urgencia_str = str(ticket.get("urgencia", "media")).lower().strip()
        nivel = NIVELES_URGENCIA.get(urgencia_str, 2)
        self._contador_secuencia += 1

        elemento = ElementoPrioridad(
            prioridad=nivel,
            secuencia=self._contador_secuencia,
            ticket=ticket,
        )
        self._heap.append(elemento)
        self._flotar(len(self._heap) - 1)

    def desencolar(self) -> Optional[Dict[str, Any]]:

        if self.esta_vacia():
            return None
        if len(self._heap) == 1:
            return self._heap.pop().ticket

        raiz = self._heap[0]
        self._heap[0] = self._heap.pop()
        self._hundir(0)
        return raiz.ticket

    def ver_frente(self) -> Optional[Dict[str, Any]]:

        return self._heap[0].ticket if not self.esta_vacia() else None

    def obtener_lista_ordenada(self) -> List[Dict[str, Any]]:

        # Clonamos el montículo para extraer sin mutar el original
        copia_heap = list(self._heap)
        cola_temporal = ColaPrioridadTickets()
        cola_temporal._heap = copia_heap

        resultado = []
        while not cola_temporal.esta_vacia():
            ticket = cola_temporal.desencolar()
            if ticket:
                resultado.append(ticket)
        return resultado

    def eliminar_por_id(self, ticket_id: str) -> bool:

        ticket_id_str = str(ticket_id)
        idx_a_eliminar = -1
        for i, elem in enumerate(self._heap):
            elem_id = str(elem.ticket.get("id") or elem.ticket.get("_id") or "")
            if elem_id == ticket_id_str:
                idx_a_eliminar = i
                break

        if idx_a_eliminar == -1:
            return False

        ultimo_elem = self._heap.pop()
        if idx_a_eliminar < len(self._heap):
            self._heap[idx_a_eliminar] = ultimo_elem
            self._flotar(idx_a_eliminar)
            self._hundir(idx_a_eliminar)
        return True

    def actualizar_ticket(self, ticket: Dict[str, Any]) -> None:
        """Actualiza un ticket existente en la cola."""
        t_id = str(ticket.get("id") or ticket.get("_id") or "")
        self.eliminar_por_id(t_id)
        if str(ticket.get("estado", "")).lower() not in ("resuelta", "resuelto"):
            self.encolar(ticket)
