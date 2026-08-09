import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ChatWidget } from '@/components/chat/ChatWidget'
import { reverseGeocode } from '@/lib/geocode'
import {
  buildWhatsAppUrl,
  fetchPaginaQrConfig,
  fetchPetByQrPayload,
  getGeolocation,
  getPetPhotoUrls,
  mapQrErrorMessage,
  registrarLeituraQr,
  resolvePetFotoPaths,
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
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [photoIndex, setPhotoIndex] = useState(0)
  const [config, setConfig] = useState<PaginaQrConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [comLocalizacao, setComLocalizacao] = useState(false)
  const [tutorNotificado, setTutorNotificado] = useState(false)
  const [aceitouTermos, setAceitouTermos] = useState(false)
  const [compartilharLocalizacao, setCompartilharLocalizacao] = useState(true)
  const [tutorTelefoneWhatsapp, setTutorTelefoneWhatsapp] = useState<
    string | null
  >(null)
  const [leituraId, setLeituraId] = useState<string | null>(null)
  const [chatAutoOpen, setChatAutoOpen] = useState(false)

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

        const paths = resolvePetFotoPaths(petData)
        if (paths.length > 0) {
          const urls = await getPetPhotoUrls(paths)
          if (!cancelled) {
            setPhotoUrls(urls)
            setPhotoIndex(0)
          }
        } else if (!cancelled) {
          setPhotoUrls([])
          setPhotoIndex(0)
        }

        // Resgate só quando há ocorrência de perda aberta
        setStep(petData.ocorrencia_aberta === true ? 'profile' : 'safe')
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
      if (pet?.ocorrencia_aberta !== true) {
        setError('Este animal não está perdido.')
        return
      }

      setSubmitting(true)
      setError(null)

      try {
        let latitude: number | undefined
        let longitude: number | undefined
        let enderecoTexto: string | null = null
        let usouLocalizacao = false

        if (consentiuLocalizacao) {
          try {
            const position = await getGeolocation()
            latitude = position.coords.latitude
            longitude = position.coords.longitude
            usouLocalizacao = true
            try {
              const rev = await reverseGeocode(latitude, longitude)
              enderecoTexto = rev?.label ?? null
            } catch {
              enderecoTexto = null
            }
          } catch {
            // Navegador negou GPS — confirma resgate sem localização
            usouLocalizacao = false
            latitude = undefined
            longitude = undefined
          }
        }

        const resultado = await registrarLeituraQr({
          qrPayload,
          consentimentoLocalizacao: usouLocalizacao,
          latitude,
          longitude,
          enderecoTexto,
          versaoTermos: config.versao_termos_consentimento,
        })

        setComLocalizacao(usouLocalizacao)
        setTutorNotificado(Boolean(resultado.notificado))
        setTutorTelefoneWhatsapp(resultado.tutor_telefone_whatsapp ?? null)
        setLeituraId(resultado.leitura_id ?? null)
        setChatAutoOpen(true)
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
    [config, pet?.ocorrencia_aberta, qrPayload],
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

  if (step === 'safe' && pet) {
    const capa = photoUrls[0]
    return (
      <section className="mx-auto max-w-[480px]">
        <Card className="space-y-5 px-8 py-10 text-center">
          {capa ? (
            <div className="mx-auto aspect-square w-full max-w-[220px] overflow-hidden rounded-2xl border-[3px] border-white bg-brand-100 shadow-card">
              <img
                src={capa}
                alt={pet.nome}
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="mx-auto flex justify-center">
              <PawMark />
            </div>
          )}
          <div>
            <h1 className="font-display text-xl font-extrabold text-brand-dark">
              {pet.nome}
            </h1>
            {(pet.tem_tutor || pet.tutor_nome) && (
              <p className="mt-1 text-[13px] text-gray-500">
                Tutor: {pet.tutor_nome ?? 'cadastrado na PetID'}
              </p>
            )}
          </div>
          <div className="rounded-[14px] bg-[#E7F8EF] px-4 py-4 text-[#1F9D55]">
            <p className="font-display text-[16px] font-extrabold">
              Este animal não está perdido
            </p>
            <p className="mt-2 text-[13.5px] leading-relaxed">
              Não há ocorrência de perda aberta para {pet.nome}. Se você
              encontrou este animal e acredita que ele precisa de ajuda, entre
              em contato com um órgão ou ONG da região.
            </p>
          </div>
          <Link
            to="/login"
            className="inline-flex font-bold text-brand-500 hover:underline"
          >
            Entrar na PetID →
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

          <p className="text-[13px] leading-relaxed text-gray-500">
            Use o ícone de chat no canto inferior para falar com o tutor pela
            PetID.
          </p>

          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-[26px] py-[13px] text-sm font-bold text-white shadow-btn-primary transition-[transform,box-shadow,background-color] duration-150 hover:-translate-y-0.5 hover:bg-[#1EBE57]"
            >
              Também pelo WhatsApp
            </a>
          ) : null}

          <Link to="/login" className="inline-flex font-bold text-brand-500 hover:underline">
            Voltar ao início
          </Link>
        </Card>

        {(pet.tem_tutor || pet.tutor_nome) && qrPayload && (
          <ChatWidget
            mode="finder"
            qrPayload={qrPayload}
            leituraId={leituraId}
            autoOpen={chatAutoOpen}
          />
        )}
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
        <div className="bg-gradient-to-b from-brand-50 to-white px-5 pb-6 pt-6 text-center sm:px-7">
          <div className="mb-4 flex justify-center">
            <PawMark />
          </div>

          <div className="relative mx-auto w-full max-w-[340px]">
            {photoUrls.length > 0 ? (
              <>
                <div className="overflow-hidden rounded-2xl border-[3px] border-white bg-gradient-to-b from-brand-50 to-brand-100/80 shadow-card aspect-[4/5]">
                  <img
                    src={photoUrls[photoIndex] ?? photoUrls[0]}
                    alt={`${pet.nome} — foto ${photoIndex + 1}`}
                    className="h-full w-full object-contain object-top"
                  />
                </div>

                {photoUrls.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Foto anterior"
                      className="absolute left-2 top-[42%] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-brand-dark shadow-md hover:bg-white"
                      onClick={() =>
                        setPhotoIndex((i) =>
                          i === 0 ? photoUrls.length - 1 : i - 1,
                        )
                      }
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                        <path d="M15 18l-6-6 6-6" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      aria-label="Próxima foto"
                      className="absolute right-2 top-[42%] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-brand-dark shadow-md hover:bg-white"
                      onClick={() =>
                        setPhotoIndex((i) =>
                          i === photoUrls.length - 1 ? 0 : i + 1,
                        )
                      }
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </button>
                    <p className="mt-2 text-center text-[12px] font-semibold text-brand-600">
                      {photoIndex + 1} / {photoUrls.length}
                    </p>
                    <div className="mt-2 flex justify-center gap-2 overflow-x-auto pb-0.5">
                      {photoUrls.map((url, i) => (
                        <button
                          key={`thumb-${i}-${url.slice(-24)}`}
                          type="button"
                          aria-label={`Ver foto ${i + 1}`}
                          aria-current={i === photoIndex}
                          onClick={() => setPhotoIndex(i)}
                          className={[
                            'h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-brand-50 transition-colors',
                            i === photoIndex
                              ? 'border-brand-500'
                              : 'border-white/80 opacity-80 hover:opacity-100',
                          ].join(' ')}
                        >
                          <img
                            src={url}
                            alt=""
                            className="h-full w-full object-cover object-top"
                          />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="mx-auto flex aspect-[4/5] w-full max-w-[340px] items-center justify-center rounded-2xl border-[3px] border-white bg-brand-100 text-brand-500 shadow-card">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 14.5c-3.5 0-6.5 2.2-6.5 5.2 0 1.1.9 1.8 2 1.6 1.4-.3 2.9-.5 4.5-.5s3.1.2 4.5.5c1.1.2 2-.5 2-1.6 0-3-3-5.2-6.5-5.2z" />
                  <circle cx="6" cy="9" r="2.2" />
                  <circle cx="18" cy="9" r="2.2" />
                  <circle cx="9.5" cy="5.5" r="2" />
                  <circle cx="14.5" cy="5.5" r="2" />
                </svg>
              </div>
            )}
          </div>

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
                Após confirmar o resgate, fale com o tutor pelo chat da PetID
                (ícone no canto inferior). WhatsApp fica disponível se houver
                telefone cadastrado.
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

          <div className="space-y-2.5">
            <label className="flex cursor-pointer items-start gap-2.5 rounded-[14px] bg-brand-50 px-4 py-3.5">
              <input
                type="checkbox"
                className="mt-0.5 accent-brand-500"
                checked={aceitouTermos}
                onChange={(e) => setAceitouTermos(e.target.checked)}
                disabled={submitting}
              />
              <span className="text-[13px] leading-relaxed text-gray-700">
                Aceito os termos e condições da PetID para confirmar este
                resgate. *
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-[14px] border border-surface-border bg-[#fbfaff] px-4 py-3.5">
              <input
                type="checkbox"
                className="mt-0.5 accent-brand-500"
                checked={compartilharLocalizacao}
                onChange={(e) => setCompartilharLocalizacao(e.target.checked)}
                disabled={submitting}
              />
              <span className="text-[13px] leading-relaxed text-gray-700">
                {config.texto_consentimento}{' '}
                <span className="text-gray-400">(opcional, mas ajuda muito)</span>
              </span>
            </label>
          </div>

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
            onClick={() => void enviarConfirmacao(compartilharLocalizacao)}
          >
            {submitting ? 'Enviando…' : 'Confirmar Resgate'}
          </Button>
        </div>
      </Card>

      {(pet.tem_tutor || pet.tutor_nome) && qrPayload && (
        <ChatWidget mode="finder" qrPayload={qrPayload} leituraId={leituraId} />
      )}
    </section>
  )
}
