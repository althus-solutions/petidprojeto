import { Link, useNavigate } from 'react-router-dom'
import { AdocaoForm } from '@/components/adocao/AdocaoForm'

export function TutorAdocaoNovoPage() {
  const navigate = useNavigate()

  return (
    <div>
      <div className="mb-3">
        <Link
          to="/tutor/adocao"
          className="text-[13px] font-bold text-brand-500 hover:underline"
        >
          ← Voltar à galeria
        </Link>
      </div>
      <AdocaoForm
        onSuccess={(listagem) => {
          navigate(`/tutor/adocao/${listagem.id}`, { replace: true })
        }}
      />
    </div>
  )
}
