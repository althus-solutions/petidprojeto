import { Navigate, useParams } from 'react-router-dom'

/**
 * Legado `/qr/:payload` → perfil público `/pet/:payload` (Modelo Híbrido).
 */
export function QrReadPage() {
  const { payload } = useParams<{ payload: string }>()
  if (!payload) return <Navigate to="/resgate" replace />
  return <Navigate to={`/pet/${encodeURIComponent(payload)}`} replace />
}
