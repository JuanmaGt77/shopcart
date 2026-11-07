import { useEffect, useState } from 'react';

/** Segundos que faltan para `limite` (marca de tiempo local), actualizados cada segundo. */
export function useSegundosRestantes(limite: number): number {
  const calcular = () => Math.max(0, Math.round((limite - Date.now()) / 1000));
  const [segundos, setSegundos] = useState(calcular);
  const [limiteAnterior, setLimiteAnterior] = useState(limite);
  if (limite !== limiteAnterior) {
    setLimiteAnterior(limite);
    setSegundos(calcular());
  }

  useEffect(() => {
    const intervalo = setInterval(
      () => setSegundos(Math.max(0, Math.round((limite - Date.now()) / 1000))),
      1000,
    );
    return () => clearInterval(intervalo);
  }, [limite]);

  return segundos;
}

/** 754 -> "12:34" */
export function formatearMinutos(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
