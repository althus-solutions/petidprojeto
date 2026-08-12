import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  OcorrenciasMap,
  type TutorLocalizacaoAtual,
} from '@/components/ocorrencias/OcorrenciasMap'
import { TutorBackLink } from '@/components/tutor/TutorBackLink'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PawIcon } from '@/components/ui/PawIcon'
import { useAuth } from '@/contexts/AuthContext'
import {
  dismissAlertaOcorrencia,
  listAlertasPendentes,
} from '@/lib/ocorrencia-alertas'
import {
  listOcorrenciasAbertasTutor,
  mapReencontroError,
  registrarReencontroTutor,
} from '@/lib/ocorrencias'
import { getGeolocation } from '@/lib/geolocation'
import { getPetPhotoSignedUrl } from '@/lib/pets'
import { getTutorEndereco } from '@/lib/tutor-enderecos'
import type { OcorrenciaAbertaMapa } from '@/types/ocorrencia'
import type { TutorEndereco } from '@/types/tutor-endereco'

function OcorrenciaCard({
  item,
  selected,
  onSelect,
  confirmando,
  salvando,
  onPedirConfirmacao,
  onCancelarConfirmacao,
  onConfirmarReencontro,
}: {
  item: OcorrenciaAbertaMapa
  selected: boolean
  onSelect: () => void
  confirmando: boolean
  salvando: boolean
  onPedirConfirmacao: () => void
  onCancelarConfirmacao: () => void
  onConfirmarReencontro: () => void
}) {
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!item.animal_foto_path) return
    void getPetPhotoSignedUrl(item.animal_foto_path).then(setFotoUrl)
  }, [item.animal_foto_path])

  return (
    <article
      className={[
        'rounded-card border bg-white shadow-card transition-[box-shadow,border-color] duration-150',
        selected
          ? 'border-brand-500 ring-4 ring-brand-100'
          : 'border-surface-border',
      ].join(' ')}
    >
      <div className="flex gap-3 p-4 sm:gap-4 sm:p-5">
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-start gap-3 text-left sm:gap-4"
          aria-pressed={selected}
        >
          <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-50 text-brand-500 sm:h-20 sm:w-20">
            {fotoUrl ? (
              <img
                src={fotoUrl}
                alt={item.animal_nome}
                className="h-full w-full object-cover"
              />
            ) : (
              <PawIcon className="h-8 w-8" />
            )}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="font-display text-[17px] font-extrabold text-brand-dark sm:text-lg">
              {item.animal_nome}
            </h3>
            <p className="mt-1 text-[13px] leading-snug text-gray-500">
              {[item.animal_especie, item.endereco_aproximado]
                .filter(Boolean)
                .join(' · ') || 'Sem endereço informado'}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Badge>Aberta</Badge>
              <Badge variant={item.localizado ? 'success' : 'warning'}>
                {item.localizado ? 'Localizado' : 'Não localizado'}
              </Badge>
            </div>
            <p className="mt-2 text-[11.5px] text-gray-400">
              perdido em{' '}
              {new Date(item.data_perda + 'T12:00:00').toLocaleDateString(
                'pt-BR',
              )}
            </p>
          </div>
        </button>

        <div className="flex w-[118px] shrink-0 flex-col justify-center gap-2 sm:w-[132px]">
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="w-full !px-2 !py-2.5 text-[12px] sm:text-[13px]"
            disabled={salvando}
            onClick={onPedirConfirmacao}
          >
            Pet encontrado
          </Button>
          <ButtonLink
            to={`/tutor/pets/${item.animal_id}`}
            variant="outline"
            size="sm"
            className="w-full !px-2 !py-2.5 text-[12px] sm:text-[13px]"
          >
            Ver pet
          </ButtonLink>
        </div>
      </div>

      {confirmando && (
        <div className="border-t border-surface-border bg-brand-50/60 px-4 py-3.5 sm:px-5">
          <p className="text-[13px] leading-snug text-gray-600">
            Confirmar que <strong>{item.animal_nome}</strong> foi encontrado e
            encerrar esta ocorrência?
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="flex-1"
              disabled={salvando}
              onClick={onConfirmarReencontro}
            >
              {salvando ? 'Salvando…' : 'Sim, registrar'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="flex-1"
              disabled={salvando}
              onClick={onCancelarConfirmacao}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </article>
  )
}

export function TutorOcorrenciasPage() {
  const { user } = useAuth()
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaAbertaMapa[]>([])
  const [tutorEndereco, setTutorEndereco] = useState<TutorEndereco | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [alertaDismissed, setAlertaDismissed] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [tutorAtual, setTutorAtual] = useState<TutorLocalizacaoAtual | null>(
    null,
  )
  const [gpsStatus, setGpsStatus] = useState<
    'idle' | 'loading' | 'ok' | 'denied'
  >('idle')
  const [gpsError, setGpsError] = useState<string | null>(null)

  const alertaAtivo = useMemo(() => {
    if (alertaDismissed) return null
    return listAlertasPendentes(ocorrencias)[0] ?? null
  }, [alertaDismissed, ocorrencias])

  const load = useCallback(async () => {
    if (!user?.tutor?.id) {
      setError('Perfil de tutor não encontrado.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [lista, endereco] = await Promise.all([
        listOcorrenciasAbertasTutor(),
        getTutorEndereco(user.tutor.id).catch(() => null),
      ])
      setOcorrencias(lista)
      setTutorEndereco(endereco)

      setSelectedId((prev) => {
        if (prev && lista.some((o) => o.id === prev)) return prev
        const primeiroLocalizado = lista.find((o) => o.localizado)
        return primeiroLocalizado?.id ?? lista[0]?.id ?? null
      })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erro ao carregar ocorrências. Aplique a migration 016 se ainda não estiver no banco.',
      )
    } finally {
      setLoading(false)
    }
  }, [user?.tutor?.id])

  useEffect(() => {
    void load()
  }, [load])

  const atualizarLocalizacaoAtual = useCallback(async () => {
    setGpsStatus('loading')
    setGpsError(null)
    try {
      const pos = await getGeolocation()
      setTutorAtual({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      })
      setGpsStatus('ok')
    } catch (err) {
      setTutorAtual(null)
      setGpsStatus('denied')
      setGpsError(
        err instanceof Error
          ? err.message
          : 'Não foi possível obter sua localização atual.',
      )
    }
  }, [])

  useEffect(() => {
    void atualizarLocalizacaoAtual()
  }, [atualizarLocalizacaoAtual])

  function dismissAlerta() {
    if (alertaAtivo) {
      dismissAlertaOcorrencia(alertaAtivo)
      setSelectedId(alertaAtivo.id)
      // Avisa o layout para atualizar o badge da aba
      window.dispatchEvent(new Event('petid:ocorrencia-alerta'))
    }
    setAlertaDismissed(true)
  }

  async function confirmarReencontro(item: OcorrenciaAbertaMapa) {
    setSavingId(item.id)
    setActionError(null)
    setSucesso(null)
    try {
      dismissAlertaOcorrencia(item)
      const result = await registrarReencontroTutor({
        ocorrenciaId: item.id,
      })
      setConfirmId(null)
      setSucesso(
        `${result.animal_nome} foi marcado como encontrado. A ocorrência foi encerrada.`,
      )
      window.dispatchEvent(new Event('petid:ocorrencia-alerta'))
      await load()
    } catch (err) {
      setActionError(
        mapReencontroError(
          err instanceof Error ? err.message : 'Falha ao registrar reencontro.',
        ),
      )
    } finally {
      setSavingId(null)
    }
  }

  const showMap =
    ocorrencias.length > 0 ||
    Boolean(tutorEndereco) ||
    Boolean(tutorAtual)

  return (
    <section className="mx-auto max-w-[900px] space-y-6">
      <TutorBackLink to="/tutor">Voltar para meus pets</TutorBackLink>

      <div>
        <h1 className="font-display text-[25px] font-extrabold text-brand-dark">
          Ocorrências de perda
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-gray-500">
          Acompanhe leituras da tag no mapa. Quando o pet for encontrado,
          registre o reencontro para encerrar a ocorrência.
        </p>
      </div>

      {loading && <p className="text-sm text-gray-500">Carregando…</p>}
      {error && (
        <p className="rounded-[14px] bg-brand-50 px-4 py-3 text-sm text-brand-700">
          {error}
        </p>
      )}
      {actionError && (
        <p className="rounded-[14px] bg-brand-50 px-4 py-3 text-sm text-brand-700">
          {actionError}
        </p>
      )}
      {sucesso && (
        <p
          role="status"
          className="rounded-[14px] border border-[#A6F4C5] bg-[#ECFDF3] px-4 py-3 text-sm font-semibold text-[#027A48]"
        >
          {sucesso}
        </p>
      )}

      {!loading && !error && (
        <>
          {alertaAtivo && (
            <div
              role="alert"
              className="relative overflow-hidden rounded-[16px] border border-[#A6F4C5] bg-gradient-to-r from-[#ECFDF3] to-[#F3F1FC] px-5 py-4 shadow-soft"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#027A48]">
                    {alertaAtivo.localizado
                      ? 'Localização compartilhada'
                      : 'Tag lida'}
                  </p>
                  <p className="mt-1 font-display text-[17px] font-extrabold text-brand-dark">
                    {alertaAtivo.localizado
                      ? `${alertaAtivo.animal_nome} foi localizado!`
                      : `Alguém confirmou o resgate de ${alertaAtivo.animal_nome}`}
                  </p>
                  <p className="mt-1 max-w-lg text-[13.5px] text-gray-600">
                    {alertaAtivo.localizado
                      ? 'Alguém leu a tag e compartilhou a localização. O pin verde piscando no mapa marca o ponto — com o endereço quando disponível.'
                      : 'A leitura foi registrada sem localização. Peça para a pessoa compartilhar o GPS na próxima confirmação, ou fale pelo chat.'}
                  </p>
                  {alertaAtivo.ultima_leitura_endereco && (
                    <p className="mt-1.5 text-[13px] font-semibold text-brand-dark">
                      {alertaAtivo.ultima_leitura_endereco}
                    </p>
                  )}
                  {(alertaAtivo.ultima_interacao_em ||
                    alertaAtivo.ultima_leitura_em) && (
                    <p className="mt-1 text-[12px] text-gray-400">
                      {new Date(
                        alertaAtivo.ultima_interacao_em ??
                          alertaAtivo.ultima_leitura_em!,
                      ).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={dismissAlerta}
                >
                  {alertaAtivo.localizado ? 'Ver no mapa' : 'Entendi'}
                </Button>
              </div>
            </div>
          )}

          <div>
            <h2 className="mb-3 font-display text-base font-extrabold text-brand-dark">
              Ocorrências abertas
            </h2>
            {ocorrencias.length === 0 ? (
              <div className="rounded-card border-2 border-dashed border-surface-border bg-white p-10 text-center">
                <p className="text-gray-500">
                  Quando você abrir uma ocorrência pelo pet, ela aparece aqui.
                </p>
                <Link
                  to="/tutor"
                  className="mt-4 inline-flex text-[13.5px] font-bold text-brand-500 hover:underline"
                >
                  Ir para Meus pets →
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {ocorrencias.map((item) => (
                  <OcorrenciaCard
                    key={item.id}
                    item={item}
                    selected={selectedId === item.id}
                    onSelect={() => setSelectedId(item.id)}
                    confirmando={confirmId === item.id}
                    salvando={savingId === item.id}
                    onPedirConfirmacao={() => {
                      setConfirmId(item.id)
                      setSucesso(null)
                      setActionError(null)
                    }}
                    onCancelarConfirmacao={() => setConfirmId(null)}
                    onConfirmarReencontro={() => void confirmarReencontro(item)}
                  />
                ))}
              </div>
            )}
          </div>

          <Card className="overflow-hidden p-0 shadow-soft">
            {!showMap ? (
              <div className="px-6 py-12 text-center text-sm text-gray-500">
                Nenhuma ocorrência aberta. Abra uma pelo pet correspondente para
                habilitar notificações da tag.
              </div>
            ) : (
              <>
                <OcorrenciasMap
                  ocorrencias={ocorrencias}
                  selectedId={selectedId}
                  tutorEndereco={tutorEndereco}
                  tutorAtual={tutorAtual}
                />
                <div className="space-y-2.5 border-t border-surface-border px-4 py-3 sm:px-5">
                  <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-gray-600">
                    <li className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full bg-[#6c4fe0]"
                        aria-hidden
                      />
                      Residência (perfil)
                    </li>
                    <li className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full bg-[#0ea5e9]"
                        aria-hidden
                      />
                      Você agora (GPS)
                    </li>
                    <li className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full bg-[#12b76a]"
                        aria-hidden
                      />
                      Pet (leitura QR/NFC)
                    </li>
                  </ul>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={gpsStatus === 'loading'}
                      onClick={() => void atualizarLocalizacaoAtual()}
                    >
                      {gpsStatus === 'loading'
                        ? 'Localizando…'
                        : tutorAtual
                          ? 'Atualizar minha localização'
                          : 'Usar minha localização atual'}
                    </Button>
                    {gpsStatus === 'denied' && (
                      <p className="text-[12px] text-gray-500">
                        {gpsError ||
                          'Permita o GPS no navegador para ver onde você está.'}
                      </p>
                    )}
                    {!tutorEndereco && (
                      <p className="text-[12px] text-brand-600">
                        Cadastre a residência em{' '}
                        <Link
                          to="/tutor/perfil/editar"
                          className="font-semibold underline-offset-2 hover:underline"
                        >
                          Editar perfil
                        </Link>
                        .
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </Card>
        </>
      )}
    </section>
  )
}
