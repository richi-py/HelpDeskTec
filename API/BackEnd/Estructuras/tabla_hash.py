from typing import Any, Dict, List, Optional, Tuple


class EntradaHash:
    def __init__(self, clave: str, valor: Dict[str, Any]):
        self.clave = str(clave)
        self.valor = valor


class TablaHashTickets:
    def __init__(self, capacidad_inicial: int = 31):
        self._capacidad: int = capacidad_inicial
        self._tamano: int = 0
        self._buckets: List[List[EntradaHash]] = [[] for _ in range(self._capacidad)]
        self._total_colisiones: int = 0

    def _hash(self, clave: str) -> int:
        hash_val = 0
        primo = 31
        for caracter in str(clave):
            hash_val = (hash_val * primo + ord(caracter)) % self._capacidad
        return hash_val

    @property
    def factor_carga(self) -> float:
        return round(self._tamano / self._capacidad, 3)

    def _redimensionar(self) -> None:
        vieja_capacidad = self._capacidad
        viejos_buckets = self._buckets

        self._capacidad = vieja_capacidad * 2 + 1  # Impar para mejor dispersión
        self._buckets = [[] for _ in range(self._capacidad)]
        self._tamano = 0
        self._total_colisiones = 0

        for bucket in viejos_buckets:
            for entrada in bucket:
                self.insertar(entrada.clave, entrada.valor)

    def insertar(self, clave: str, valor: Dict[str, Any]) -> None:
        if self.factor_carga > 0.75:
            self._redimensionar()

        indice = self._hash(clave)
        bucket = self._buckets[indice]

        # Verificar si la clave ya existe (actualización)
        for entrada in bucket:
            if entrada.clave == str(clave):
                entrada.valor = valor
                return

        # Detección de colisión para métricas de clase
        if len(bucket) > 0:
            self._total_colisiones += 1

        bucket.append(EntradaHash(clave, valor))
        self._tamano += 1

    def buscar(self, clave: str) -> Optional[Dict[str, Any]]:
        indice = self._hash(clave)
        bucket = self._buckets[indice]

        for entrada in bucket:
            if entrada.clave == str(clave):
                return entrada.valor
        return None

    def eliminar(self, clave: str) -> bool:
        indice = self._hash(clave)
        bucket = self._buckets[indice]

        for i, entrada in enumerate(bucket):
            if entrada.clave == str(clave):
                bucket.pop(i)
                self._tamano -= 1
                return True
        return False

    def contiene(self, clave: str) -> bool:
        return self.buscar(clave) is not None

    def tamano(self) -> int:
        return self._tamano

    def obtener_todos(self) -> List[Dict[str, Any]]:
        elementos = []
        for bucket in self._buckets:
            for entrada in bucket:
                elementos.append(entrada.valor)
        return elementos

    def obtener_metricas(self) -> Dict[str, Any]:
        buckets_ocupados = sum(1 for b in self._buckets if len(b) > 0)
        longitud_maxima_bucket = max((len(b) for b in self._buckets), default=0)

        return {
            "tipo_estructura": "Tabla Hash con Encadenamiento (Separate Chaining)",
            "capacidad_total_buckets": self._capacidad,
            "elementos_almacenados": self._tamano,
            "factor_de_carga": self.factor_carga,
            "buckets_ocupados": buckets_ocupados,
            "buckets_vacios": self._capacidad - buckets_ocupados,
            "longitud_maxima_bucket": longitud_maxima_bucket,
            "total_colisiones_registradas": self._total_colisiones,
        }
