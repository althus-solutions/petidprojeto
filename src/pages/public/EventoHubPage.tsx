import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'

export function EventoHubPage() {
  return (
    <section className="mx-auto max-w-[720px] space-y-8">
      <div className="text-center">
        <p className="text-[12px] font-bold uppercase tracking-wide text-brand-500">
          Evento MyPetID
        </p>
        <h1 className="mt-1 font-display text-[26px] font-extrabold text-brand-dark sm:text-[28px]">
          Cadastro no evento
        </h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-gray-500">
          Escolha o seu perfil. Vamos coletar seus dados para contato e
          acompanhamento após o evento — sem criar conta agora.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/evento/tutor"
          className="group block rounded-card border border-surface-border bg-white p-7 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft"
        >
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-brand-50 text-brand-500">
            <PawIcon />
          </span>
          <h2 className="font-display text-[16.5px] font-extrabold text-brand-dark">
            Sou tutor
          </h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-gray-500">
            Tenho ou cuido de pets e quero usar a plataforma (tag, reencontro,
            alertas).
          </p>
          <p className="mt-4 text-[13px] font-bold text-brand-500 group-hover:underline">
            Continuar como tutor →
          </p>
        </Link>

        <Link
          to="/evento/parceiro"
          className="group block rounded-card border border-surface-border bg-white p-7 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft"
        >
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-brand-50 text-brand-500">
            <BuildingIcon />
          </span>
          <h2 className="font-display text-[16.5px] font-extrabold text-brand-dark">
            Sou ONG, prefeitura ou negócio
          </h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-gray-500">
            Represento ONG, prefeitura, clínica, pet shop ou outro parceiro
            interessado na plataforma.
          </p>
          <p className="mt-4 text-[13px] font-bold text-brand-500 group-hover:underline">
            Continuar como parceiro →
          </p>
        </Link>
      </div>

      <Card className="p-5 text-center text-[13px] text-gray-500">
        Já tem conta?{' '}
        <Link to="/login" className="font-bold text-brand-500 hover:underline">
          Entrar
        </Link>
        {' · '}
        <Link to="/cadastro" className="font-bold text-brand-500 hover:underline">
          Criar conta completa
        </Link>
      </Card>
    </section>
  )
}

function PawIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 14.5c-3.5 0-6.5 2.2-6.5 5.2 0 1.1.9 1.8 2 1.6 1.4-.3 2.9-.5 4.5-.5s3.1.2 4.5.5c1.1.2 2-.5 2-1.6 0-3-3-5.2-6.5-5.2z" />
      <circle cx="6" cy="9" r="2.2" />
      <circle cx="18" cy="9" r="2.2" />
      <circle cx="9.5" cy="5.5" r="2" />
      <circle cx="14.5" cy="5.5" r="2" />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M4 21V9l8-6 8 6v12" />
      <path d="M9 21v-6h6v6" />
    </svg>
  )
}
