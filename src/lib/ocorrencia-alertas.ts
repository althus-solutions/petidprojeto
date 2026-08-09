import type { OcorrenciaAbertaMapa } from '@/types/ocorrencia'

/** Timestamp usado para o alerta/badge (qualquer leitura, com fallback GPS). */
export function alertaTimestamp(o: OcorrenciaAbertaMapa): string | null {
  return o.ultima_interacao_em ?? o.ultima_leitura_em ?? null
}

export function alertaStorageKey(o: OcorrenciaAbertaMapa): string {
  return `petid:mapa-alerta:${o.id}:${alertaTimestamp(o) ?? 'na'}`
}

export function isAlertaDismissed(o: OcorrenciaAbertaMapa): boolean {
  const ts = alertaTimestamp(o)
  if (!ts) return true
  try {
    return localStorage.getItem(alertaStorageKey(o)) === '1'
  } catch {
    return false
  }
}

/** Ocorrências com leitura nova ainda não vistas pelo tutor. */
export function listAlertasPendentes(
  ocorrencias: OcorrenciaAbertaMapa[],
): OcorrenciaAbertaMapa[] {
  return ocorrencias.filter((o) => alertaTimestamp(o) && !isAlertaDismissed(o))
}

export function countAlertasPendentes(
  ocorrencias: OcorrenciaAbertaMapa[],
): number {
  return listAlertasPendentes(ocorrencias).length
}

export function dismissAlertaOcorrencia(o: OcorrenciaAbertaMapa): void {
  if (!alertaTimestamp(o)) return
  try {
    localStorage.setItem(alertaStorageKey(o), '1')
  } catch {
    /* ignore */
  }
}
