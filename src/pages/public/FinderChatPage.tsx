import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { ChatScreen } from '@/components/chat/ChatScreen'

export function FinderChatPage() {
  const { payload } = useParams<{ payload: string }>()
  const [params] = useSearchParams()
  const leituraId = params.get('leitura')

  if (!payload || payload.length < 8) {
    return <Navigate to="/login" replace />
  }

  return (
    <ChatScreen
      mode="finder"
      backTo={`/pet/${payload}`}
      backLabel="Voltar ao pet"
      qrPayload={payload}
      leituraId={leituraId}
      autoStart
    />
  )
}
