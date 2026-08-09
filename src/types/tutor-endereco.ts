export interface TutorEndereco {
  id?: string
  cep: string | null
  logradouro: string
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string
  estado: string
  latitude: number
  longitude: number
}

export function formatTutorEnderecoLinha(e: TutorEndereco): string {
  const rua = [e.logradouro, e.numero].filter(Boolean).join(', ')
  const parts = [
    rua,
    e.complemento,
    e.bairro,
    e.cidade,
    e.estado?.toUpperCase(),
  ].filter(Boolean)
  return parts.join(' — ')
}
