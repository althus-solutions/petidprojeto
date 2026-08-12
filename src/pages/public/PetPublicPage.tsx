import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  LocationConsentModal,
  type LocationModalPhase,
} from '@/components/public/LocationConsentModal'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
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
  const navigate = useNavigate()
  const qrPayload = rawPayload ? decodeURIComponent(rawPayload) : null

  const [step, setStep] = useState<PetPublicStep>('loading')
  const [pet, setPet] = useState<PetPublicoQr | null>(null)
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [photoIndex, setPhotoIndex] = useState(0)
  const [photoWarning, setPhotoWarning] = useState<string | null>(null)
  const [config, setConfig] = useState<PaginaQrConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aceitouTermos, setAceitouTermos] = useState(false)
  const [locModalOpen, setLocModalOpen] = useState(false)
  const [locPhase, setLocPhase] = useState<LocationModalPhase>('ask')
  const [locError, setLocError] = useState<string | null>(null)
  const [comLocalizacao, setComLocalizacao] = useState(false)
  const [tutorNotificado, setTutorNotificado] = useState(false)
  const [tutorTelefoneWhatsapp, setTutorTelefoneWhatsapp] = useState<
    string | null
  >(null)
  const [leituraId, setLeituraId] = useState<string | null>(null)

  function chatPath(leitura?: string | null) {
    if (!qrPayload) return '/login'
    const base = `/pet/${encodeURIComponent(qrPayload)}/chat`
    return leitura ? `${base}?leitura=${encodeURIComponent(leitura)}` : base
  }

  const loadPhotos = useCallback(async (petData: PetPublicoQr) => {
    const paths = resolvePetFotoPaths(petData)
    if (paths.length === 0) {
      setPhotoUrls([])
      setPhotoIndex(0)
      setPhotoWarning(
        petData.tem_foto
          ? 'As fotos deste pet não puderam ser carregadas.'
          : null,
      )
      return
    }

    const urls = await getPetPhotoUrls(paths)
    setPhotoUrls(urls)
    setPhotoIndex(0)
    setPhotoWarning(
      urls.length === 0
        ? 'Foto cadastrada, mas o acesso à imagem falhou. No Supabase, rode a migration 041_storage_pet_foto_publica_reforco.sql (SQL Editor).'
        : null,
    )
  }, [])

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
        await loadPhotos(petData)
        if (cancelled) return

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
  }, [loadPhotos, qrPayload])

  const finalizarResgate = useCallback(
    async (opts: {
      latitude?: number
      longitude?: number
      enderecoTexto?: string | null
      comGps: boolean
    }) => {
      if (!qrPayload || !config) return
      if (pet?.ocorrencia_aberta !== true) {
        setLocError('Este animal não está perdido.')
        return
      }

      setLocPhase('submitting')
      setLocError(null)
      setError(null)

      try {
        const resultado = await registrarLeituraQr({
          qrPayload,
          consentimentoLocalizacao: opts.comGps,
          latitude: opts.comGps ? opts.latitude : undefined,
          longitude: opts.comGps ? opts.longitude : undefined,
          enderecoTexto: opts.comGps ? (opts.enderecoTexto ?? null) : null,
          versaoTermos: config.versao_termos_consentimento,
        })

        setComLocalizacao(Boolean(resultado.com_localizacao))
        setTutorNotificado(Boolean(resultado.notificado))
        setTutorTelefoneWhatsapp(resultado.tutor_telefone_whatsapp ?? null)
        setLeituraId(resultado.leitura_id ?? null)
        setLocModalOpen(false)

        // Chat + ocorrência/notificação já disparam no backend ao registrar a leitura
        if (resultado.leitura_id && qrPayload) {
          navigate(chatPath(resultado.leitura_id), { replace: true })
          return
        }
        setStep('done')
      } catch (err) {
        setLocError(
          mapQrErrorMessage(
            err instanceof Error
              ? err.message
              : 'Não foi possível notificar o tutor.',
          ),
        )
        setLocPhase('ask')
      }
    },
    [config, navigate, pet?.ocorrencia_aberta, qrPayload],
  )

  async function handleShareLocation() {
    setLocPhase('requesting')
    setLocError(null)
    try {
      const position = await getGeolocation()
      const latitude = position.coords.latitude
      const longitude = position.coords.longitude
      let enderecoTexto: string | null = null
      try {
        const rev = await reverseGeocode(latitude, longitude)
        enderecoTexto = rev?.label ?? null
      } catch {
        enderecoTexto = null
      }
      await finalizarResgate({
        latitude,
        longitude,
        enderecoTexto,
        comGps: true,
      })
    } catch {
      setLocPhase('denied')
    }
  }

  async function handleSkipLocation() {
    await finalizarResgate({ comGps: false })
  }

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
                Tutor: {pet.tutor_nome ?? 'cadastrado na MyPetID'}
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
            Entrar na MyPetID →
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
            `Olá! Encontrei ${pet.nome} pela tag MyPetID e confirmei o resgate.`,
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

          {(pet.tem_tutor || pet.tutor_nome) && qrPayload && (
            <ButtonLink
              to={chatPath(leituraId)}
              variant="primary"
              className="w-full py-[14px] text-[15px]"
            >
              Abrir chat com o tutor
            </ButtonLink>
          )}

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
                <div className="aspect-[4/5] overflow-hidden rounded-2xl border-[3px] border-white bg-gradient-to-b from-brand-50 to-brand-100/80 shadow-card">
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
                  </>
                )}
              </>
            ) : (
              <div className="mx-auto flex aspect-[4/5] w-full max-w-[340px] flex-col items-center justify-center gap-3 rounded-2xl border-[3px] border-white bg-brand-100 px-4 text-brand-500 shadow-card">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 14.5c-3.5 0-6.5 2.2-6.5 5.2 0 1.1.9 1.8 2 1.6 1.4-.3 2.9-.5 4.5-.5s3.1.2 4.5.5c1.1.2 2-.5 2-1.6 0-3-3-5.2-6.5-5.2z" />
                  <circle cx="6" cy="9" r="2.2" />
                  <circle cx="18" cy="9" r="2.2" />
                  <circle cx="9.5" cy="5.5" r="2" />
                  <circle cx="14.5" cy="5.5" r="2" />
                </svg>
                {photoWarning && (
                  <p className="text-[12px] font-semibold leading-relaxed text-brand-700">
                    {photoWarning}
                  </p>
                )}
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
                {pet.tutor_nome ?? 'Tutor cadastrado na MyPetID'}
              </p>
              <p className="mt-1 text-[12px] text-gray-500">
                Após confirmar o resgate, você fala com o tutor pelo chat da
                MyPetID.
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

          {/* Único checkbox da tela: termos. Localização só no modal após Confirmar. */}
          <label className="flex cursor-pointer items-start gap-2.5 rounded-[14px] bg-brand-50 px-4 py-3.5">
            <input
              type="checkbox"
              className="mt-0.5 accent-brand-500"
              checked={aceitouTermos}
              onChange={(e) => setAceitouTermos(e.target.checked)}
              disabled={locModalOpen}
            />
            <span className="text-[13px] leading-relaxed text-gray-700">
              Aceito os termos e condições da MyPetID para confirmar este
              resgate. *
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
            disabled={!aceitouTermos || locModalOpen}
            onClick={() => {
              setLocError(null)
              setLocPhase('ask')
              setLocModalOpen(true)
            }}
          >
            Confirmar Resgate
          </Button>
        </div>
      </Card>

      {locModalOpen && (
        <LocationConsentModal
          petName={pet.nome}
          phase={locPhase}
          error={locError}
          onShare={() => void handleShareLocation()}
          onSkip={() => void handleSkipLocation()}
          onClose={() => {
            if (locPhase === 'requesting' || locPhase === 'submitting') return
            setLocModalOpen(false)
            setLocPhase('ask')
            setLocError(null)
          }}
        />
      )}
    </section>
  )
}
