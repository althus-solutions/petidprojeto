import { useNavigate } from 'react-router-dom'
import { RescueForm } from '@/components/resgate/RescueForm'
import { TutorBackLink } from '@/components/tutor/TutorBackLink'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'

function LocationPinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z"
        fill="#6C4FE0"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#6C4FE0"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

export function OrgaoEncontreiPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const organizacaoId = user?.organizacao?.id

  return (
    <section className="mx-auto max-w-[560px] space-y-6">
      <TutorBackLink to="/orgao">Voltar ao painel</TutorBackLink>

      <div>
        <span className="mb-[14px] inline-flex items-center gap-2 rounded-full bg-brand-50 px-3.5 py-[7px] text-[13px] font-bold text-brand-500">
          <LocationPinIcon />
          Animal sem tag / QR Code
        </span>
        <h1 className="font-display text-[27px] font-extrabold text-brand-dark">
          Encontrei um animal
        </h1>
        <p className="mt-2.5 max-w-[480px] text-[14.5px] leading-relaxed text-gray-500">
          Use este formulário quando o animal <strong>não tiver tag</strong>{' '}
          (QR ou NFC). Envie foto e dados — a plataforma cruza com a base e, se
          houver correspondência, avisa o tutor.
        </p>
      </div>

      <ol className="space-y-2 rounded-[14px] border border-surface-border bg-white px-[18px] py-4 text-[13px] leading-relaxed text-gray-600">
        <li>
          <span className="font-bold text-brand-dark">1.</span> Preencha foto,
          porte e onde encontrou
        </li>
        <li>
          <span className="font-bold text-brand-dark">2.</span> (Opcional)
          Autorize a localização — o navegador pode pedir permissão
        </li>
        <li>
          <span className="font-bold text-brand-dark">3.</span> Registre — o
          matching decide se o tutor é notificado
        </li>
      </ol>

      <div className="flex items-center gap-2.5 rounded-[14px] border border-surface-border bg-white px-[18px] py-3.5 text-[13.5px] font-bold text-brand-500">
        <CheckIcon />
        Registro vinculado à sua organização
      </div>

      <Card className="px-[34px] py-[34px] sm:px-[38px]">
        <RescueForm
          organizacaoId={organizacaoId}
          onSuccess={() => navigate('/orgao', { replace: true })}
        />
      </Card>
    </section>
  )
}
