/**
 * Caché en memoria con tiempo de vida. Alcanza para una sola instancia de la API;
 * si se escalara a varias instancias, esto se movería a Redis.
 */
export class CacheTTL<V> {
  private readonly datos = new Map<string, { valor: V; expira: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maximo = 5000,
  ) {}

  obtener(clave: string): V | undefined {
    const entrada = this.datos.get(clave);
    if (!entrada) return undefined;
    if (entrada.expira <= Date.now()) {
      this.datos.delete(clave);
      return undefined;
    }
    return entrada.valor;
  }

  guardar(clave: string, valor: V): void {
    if (this.datos.size >= this.maximo) {
      const primera = this.datos.keys().next().value;
      if (primera !== undefined) this.datos.delete(primera);
    }
    this.datos.set(clave, { valor, expira: Date.now() + this.ttlMs });
  }

  eliminar(clave: string): void {
    this.datos.delete(clave);
  }

  limpiar(): void {
    this.datos.clear();
  }

  get tamano(): number {
    return this.datos.size;
  }
}
