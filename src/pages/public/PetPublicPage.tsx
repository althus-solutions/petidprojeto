import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  buildWhatsAppUrl,
  fetchPaginaQrConfig,
  fetchPetByQrPayload,
  getGeolocation,
  getPetPhotoUrl,
  mapQrErrorMessage,
  registrarLeituraQr,
} from '@/lib/qr-read'
import type {
  PaginaQrConfig,
  PetPublicStep,
  PetPublicoQr,
} from '@/types/qr-read'

function PawMark() {
  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-gradient-to-br from-brand-vivid to-brand-500">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 14.5c-3.5 0-6.5 2.2-6.5 5.2 0 1.1.9 1.8 2 1.6 1.4-.3 2.9-.5 4.5-.5s3.1.2 4.5.5c1.1.2 2-.5 2-1.6 0-3-3-5.2-6.5-5.2z"
          fill="white"
        />
        <circle cx="6" cy="9" r="2.2" fill="white" />
        <circle cx="18" cy="9" r="2.2" fill="white" />
        <circle cx="9.5" cy="5.5" r="2" fill="white" />
        <circle cx="14.5" cy="5.5" r="2" fill="white" />
      </svg>
    </span>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-surface-border py-2.5 text-[13.5px] last:border-b-0">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-semibold text-brand-dark">{value}</span>
    </div>
  )
}

export function PetPublicPage() {
  const { payload: rawPayload } = useParams<{ payload: string }>()
  const qrPayload = rawPayload ? decodeURIComponent(rawPayload) : null

  const [step, setStep] = useState<PetPublicStep>('loading')
  const [pet, setPet] = useState<PetPublicoQr | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [config, setConfig] = useState<PaginaQrConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [comLocalizacao, setComLocalizacao] = useState(false)
  const [tutorNotificado, setTutorNotificado] = useState(false)
  const [aceitouTermos, setAceitouTermos] = useState(false)
  const [tutorTelefoneWhatsapp, setTutorTelefoneWhatsapp] = useState<
    string | null
  >(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!qrPayload) {
        setError('Link da tag inválido.')
        setStep('error')
        return
      }

      setStep('loading')
      setError(null)

      try {
        const [petData, pageConfig] = await Promise.all([
          fetchPetByQrPayload(qrPayload),
          fetchPaginaQrConfig(),
        ])

        if (cancelled) return

        setPet(petData)
        setConfig(pageConfig)

        if (petData.foto_path) {
          const url = await getPetPhotoUrl(petData.foto_path)
          if (!cancelled) setPhotoUrl(url)
        }

        setStep('profile')
      } catch (err) {
        if (cancelled) return
        setError(
          mapQrErrorMessage(
            err instanceof Error ? err.message : 'Não foi possível carregar o pet.',
          ),
        )
        setStep('error')
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [qrPayload])

  const enviarConfirmacao = useCallback(
    async (consentiuLocalizacao: boolean) => {
      if (!qrPayload || !config) return

      setSubmitting(true)
      setError(null)

      try {
        let latitude: number | undefined
        let longitude: number | undefined

        if (consentiuLocalizacao) {
          const position = await getGeolocation()
          latitude = position.coords.latitude
          longitude = position.coords.longitude
        }

        const resultado = await registrarLeituraQr({
          qrPayload,
          consentimentoLocalizacao: consentiuLocalizacao,
          latitude,
          longitude,
          versaoTermos: config.versao_termos_consentimento,
        })

        setComLocalizacao(consentiuLocalizacao)
        setTutorNotificado(Boolean(resultado.notificado))
        setTutorTelefoneWhatsapp(resultado.tutor_telefone_whatsapp ?? null)
        setStep('done')
      } catch (err) {
        setError(
          mapQrErrorMessage(
            err instanceof Error
              ? err.message
              : 'Não foi possível notificar o tutor.',
          ),
        )
      } finally {
        setSubmitting(false)
      }
    },
    [config, qrPayload],
  )

  if (step === 'loading') {
    return (
      <section className="mx-auto max-w-[480px] py-16 text-center">
        <p className="text-sm text-gray-500">Carregando perfil do animal…</p>
      </section>
    )
  }

  if (step === 'error' || !pet || !config) {
    return (
      <section className="mx-auto max-w-[480px]">
        <Card className="space-y-4 px-8 py-10 text-center">
          <PawMark />
          <h1 className="font-display text-xl font-extrabold text-brand-dark">
            Não encontramos este animal
          </h1>
          <p className="text-[13.5px] leading-relaxed text-gray-500">
            {error ?? 'Tag inválida ou pet removido.'}
          </p>
          <Link
            to="/login"
            className="inline-flex font-bold text-brand-500 hover:underline"
          >
            Entrar como órgão / ONG →
          </Link>
        </Card>
      </section>
    )
  }

  if (step === 'done') {
    const whatsappUrl =
      tutorNotificado && tutorTelefoneWhatsapp
        ? buildWhatsAppUrl(
            tutorTelefoneWhatsapp,
            `Olá! Encontrei ${pet.nome} pela tag PetID e confirmei o resgate.`,
          )
        : null

    return (
      <section className="mx-auto max-w-[480px]">
        <Card className="space-y-4 px-8 py-11 text-center">
          <span
            className={[
              'mx-auto flex h-16 w-16 items-center justify-center rounded-full',
              tutorNotificado ? 'bg-[#E7F8EF]' : 'bg-brand-50',
            ].join(' ')}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke={tutorNotificado ? '#1F9D55' : '#6C4FE0'}
              strokeWidth="2.2"
              aria-hidden
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
          <h1 className="font-display text-xl font-extrabold text-brand-dark">
            {tutorNotificado ? 'Tutor foi notificado' : 'Resgate registrado'}
          </h1>
          <p className="text-[13.5px] leading-relaxed text-gray-500">
            Registramos o resgate de <strong>{pet.nome}</strong>
            {comLocalizacao
              ? ' com a localização aproximada que você compartilhou.'
              : ' sem localização.'}{' '}
            {tutorNotificado
              ? 'O tutor receberá a notificação pela plataforma.'
              : 'O tutor só é avisado se houver uma ocorrência de perda aberta na plataforma.'}
          </p>

          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-[26px] py-[13px] text-sm font-bold text-white shadow-btn-primary transition-[transform,box-shadow,background-color] duration-150 hover:-translate-y-0.5 hover:bg-[#1EBE57]"
            >
              Conversar diretamente com o tutor
            </a>
          ) : tutorNotificado ? (
            <p className="text-[12.5px] leading-relaxed text-gray-400">
              Este tutor ainda não cadastrou telefone para WhatsApp. O contato
              segue pela notificação da plataforma.
            </p>
          ) : null}

          <Link to="/login" className="inline-flex font-bold text-brand-500 hover:underline">
            Voltar ao início
          </Link>
        </Card>
      </section>
    )
  }

  const details = [
    pet.especie && { label: 'Espécie', value: pet.especie },
    pet.raca && { label: 'Raça', value: pet.raca },
    pet.porte && { label: 'Porte', value: pet.porte },
    pet.cor && { label: 'Cor', value: pet.cor },
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <section className="mx-auto max-w-[480px]">
      <Card className="overflow-hidden p-0 shadow-soft">
        <div className="bg-gradient-to-b from-brand-50 to-white px-7 pb-6 pt-8 text-center">
          <div className="mb-4 flex justify-center">
            <PawMark />
          </div>
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={pet.nome}
              className="mx-auto h-36 w-36 rounded-full border-[3px] border-white object-cover shadow-card"
            />
          ) : (
            <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full border-[3px] border-white bg-brand-100 text-brand-500 shadow-card">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 14.5c-3.5 0-6.5 2.2-6.5 5.2 0 1.1.9 1.8 2 1.6 1.4-.3 2.9-.5 4.5-.5s3.1.2 4.5.5c1.1.2 2-.5 2-1.6 0-3-3-5.2-6.5-5.2z" />
                <circle cx="6" cy="9" r="2.2" />
                <circle cx="18" cy="9" r="2.2" />
                <circle cx="9.5" cy="5.5" r="2" />
                <circle cx="14.5" cy="5.5" r="2" />
              </svg>
            </div>
          )}
          <h1 className="mt-5 font-display text-[26px] font-extrabold text-brand-dark">
            {pet.nome}
          </h1>
          <p className="mt-1.5 text-[13.5px] text-gray-500">{config.titulo}</p>
        </div>

        <div className="space-y-5 px-7 py-6">
          {(pet.tem_tutor || pet.tutor_nome) && (
            <div className="rounded-[14px] bg-brand-50 px-4 py-3.5 text-center">
              <p className="text-[12px] font-bold uppercase tracking-wide text-brand-500">
                Possui tutor
              </p>
              <p className="mt-1 font-display text-[15px] font-extrabold text-brand-dark">
                {pet.tutor_nome ?? 'Tutor cadastrado na PetID'}
              </p>
              <p className="mt-1 text-[12px] text-gray-500">
                Após confirmar o resgate, você poderá conversar com o tutor pelo
                WhatsApp, se ele tiver telefone cadastrado.
              </p>
            </div>
          )}

          {details.length > 0 && (
            <div>
              {details.map((item) => (
                <DetailRow key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
          )}

          {pet.caracteristicas && (
            <p className="rounded-[14px] bg-[#fbfaff] px-4 py-3 text-[13px] leading-relaxed text-gray-600">
              {pet.caracteristicas}
            </p>
          )}

          <p className="text-center text-[13px] leading-relaxed text-gray-500">
            {config.instrucao}
          </p>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-[14px] bg-brand-50 px-4 py-3.5">
            <input
              type="checkbox"
              className="mt-0.5 accent-brand-500"
              checked={aceitouTermos}
              onChange={(e) => setAceitouTermos(e.target.checked)}
              disabled={submitting}
            />
            <span className="text-[13px] leading-relaxed text-gray-700">
              Aceito os termos e condições e compartilhar minha localização
              aproximada para ajudar no reencontro.
            </span>
          </label>

          {error && (
            <p className="rounded-[14px] bg-brand-50 px-4 py-3 text-sm text-brand-700">
              {error}
            </p>
          )}

          <Button
            type="button"
            variant="primary"
            className="w-full py-[15px] text-[15px]"
            disabled={!aceitouTermos || submitting}
            onClick={() => void enviarConfirmacao(true)}
          >
            {submitting ? 'Enviando…' : 'Confirmar Resgate'}
          </Button>
        </div>
      </Card>
    </section>
  )
}
