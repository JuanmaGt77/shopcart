import { env } from '../config/env.js';
import { logger } from '../compartido/logger.js';
import { inventarioServicio } from '../modulos/inventario/inventario.servicio.js';

export interface Job {
  detener: () => void;
  ejecutarAhora: () => Promise<void>;
}

/**
 * Cada pocos segundos libera las reservas de checkouts vencidos (15 minutos sin
 * pagar). Así "una reserva vencida libera la existencia sin intervención manual".
 * Si una ejecución todavía no termina, la siguiente se salta para no encimarse.
 * Además, SP_Pedidos_CrearPedido revisa el vencimiento al momento de pagar, así que
 * aunque el job se atrase unos segundos nadie puede pagar con una reserva vencida.
 */
export function iniciarJobReservas(cadaSegundos = env.JOB_RESERVAS_SEGUNDOS): Job {
  let ejecutando = false;

  const ejecutarAhora = async () => {
    if (ejecutando) return;
    ejecutando = true;
    try {
      const { checkouts, variantes } = await inventarioServicio.liberarReservasVencidas();
      if (checkouts.length > 0) {
        logger.info({ checkouts: checkouts.length, variantes: variantes.length }, 'Reservas vencidas liberadas');
      }
    } catch (error) {
      logger.error({ err: error }, 'No se pudieron liberar las reservas vencidas');
    } finally {
      ejecutando = false;
    }
  };

  const intervalo = setInterval(() => void ejecutarAhora(), cadaSegundos * 1000);
  intervalo.unref();

  return { detener: () => clearInterval(intervalo), ejecutarAhora };
}
