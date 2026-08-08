import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { getGeolocation } from '@/lib/geolocation'
import {
  confirmarResgateAnonimo,
  createResgateAutenticado,
  fetchCaptchaResgateConfig,
  mapResgateError,
  solicitarUploadResgateAnonimo,
  uploadResgatePhoto,
} from '@/lib/resgate'
import type { CaptchaResgateConfig } from '@/types/resgate'
import { PORTES_ESTIMADOS } from '@/types/resgate'

interface RescueFormProps {
  organizacaoId?: string
  onSuccess?: () => void
}

function CameraIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#6C4FE0"
      strokeWidth="1.8"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M8 5l1.5-2h5L16 5" />
    </svg>
  )
}

function LocationNoteIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#6C4FE0"
      strokeWidth="1.8"
      className="mt-0.5 shrink-0"
      aria-hidden
    >
      <path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

export function RescueForm({ organizacaoId, onSuccess }: RescueFormProps) {
  const { user } = useAuth()
  const isAnonymous = !user
  const turnstileRef = useRef<TurnstileInstance>(null)

  const [config, setConfig] = useState<CaptchaResgateConfig | null>(null)
  const [foto, setFoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [porte, setPorte] = useState('')
  const [regiao, setRegiao] = useState('')
  const [descricao, setDescricao] = useState('')
  const [consentiuLocalizacao, setConsentiuLocalizacao] = useState(false)
  const [honeypot, setHoneypot] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    void fetchCaptchaResgateConfig().then(setConfig)
  }, [])

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  function handlePhotoChange(file: File | null) {
    setFoto(file)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(file ? URL.createObjectURL(file) : null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!foto) {
      setError('A foto do animal é obrigatória.')
      return
    }

    if (!porte) {
      setError('Selecione o porte estimado.')
      return
    }

    if (regiao.trim().length < 3) {
      setError('Informe a região aproximada (bairro ou cidade).')
      return
    }

    if (isAnonymous && config?.habilitado && !turnstileToken) {
      setError('Complete a verificação CAPTCHA antes de enviar.')
      return
    }

    setLoading(true)

    try {
      let latitude: number | undefined
      let longitude: number | undefined

      if (consentiuLocalizacao) {
        const position = await getGeolocation()
        latitude = position.coords.latitude
        longitude = position.coords.longitude
      }

      const versaoTermos = config?.versao_termos_consentimento ?? '1.0'

      if (isAnonymous) {
        const upload = await solicitarUploadResgateAnonimo({
          turnstileToken: turnstileToken!,
          honeypot,
        })

        await uploadResgatePhoto(upload.storage_path, foto)

        await confirmarResgateAnonimo({
          uploadTokenId: upload.upload_token_id,
          porteEstimado: porte,
          regiaoAproximada: regiao.trim(),
          descricao: descricao.trim() || undefined,
          consentimentoLocalizacao: consentiuLocalizacao,
          latitude,
          longitude,
          versaoTermos,
        })
      } else {
        await createResgateAutenticado({
          userId: user!.id,
          organizacaoId,
          foto,
          porteEstimado: porte,
          regiaoAproximada: regiao.trim(),
          descricao: descricao.trim() || undefined,
          consentimentoLocalizacao: consentiuLocalizacao,
          latitude,
          longitude,
        })
      }

      setDone(true)
      onSuccess?.()
    } catch (err) {
      setError(
        mapResgateError(
          err instanceof Error ? err.message : 'Erro ao registrar resgate.',
        ),
      )
      turnstileRef.current?.reset()
      setTurnstileToken(null)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-2.5 px-2.5 py-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E7F8EF]">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#1F9D55"
            strokeWidth="2.2"
            aria-hidden
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
        <h2 className="font-display text-base font-extrabold text-brand-dark">
          Registro enviado!
        </h2>
        <p className="text-[13.5px] leading-relaxed text-gray-500">
          Recebemos o resgate. A plataforma está cruzando as informações com os
          dados cadastrados. Se houver correspondência suficiente, o tutor será
          notificado automaticamente.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
      {!isAnonymous && (
        <p className="text-sm text-gray-500">
          Você está autenticado — o CAPTCHA não é necessário.
        </p>
      )}

      {/* Honeypot anti-bot */}
      <input
        type="text"
        name="website"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
      />

      <div className="space-y-2">
        <span className="text-[13.5px] font-bold text-brand-dark">
          Foto do animal *
        </span>
        <label className="block cursor-pointer rounded-[14px] border-[1.5px] border-dashed border-surface-border bg-brand-50 px-5 py-[26px] text-center transition-colors hover:bg-brand-100/60">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            className="sr-only"
            onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
          />
          {preview ? (
            <img
              src={preview}
              alt="Prévia da foto do animal"
              className="mx-auto mb-3 h-44 max-w-full rounded-[14px] border border-surface-border object-cover"
            />
          ) : (
            <span className="mx-auto mb-2.5 flex h-11 w-11 items-center justify-center rounded-full bg-white">
              <CameraIcon />
            </span>
          )}
          <strong className="block text-[13.5px] text-brand-dark">
            {preview ? 'Toque para trocar a foto' : 'Toque para adicionar uma foto'}
          </strong>
          <span className="mt-0.5 block text-xs text-gray-500">
            JPG ou PNG, até 5MB
          </span>
        </label>
      </div>

      <Textarea
        label="Descrição (opcional)"
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        rows={3}
        placeholder="Ex: cão pequeno, cor caramelo, muito dócil, encontrado perto da praça"
      />

      <Select
        label="Porte estimado *"
        required
        value={porte}
        onChange={(e) => setPorte(e.target.value)}
      >
        <option value="">Selecione...</option>
        {PORTES_ESTIMADOS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </Select>

      <Input
        label="Onde encontrou? *"
        type="text"
        required
        value={regiao}
        onChange={(e) => setRegiao(e.target.value)}
        placeholder="Ex: Av. Brasil, 2000 — Moema, São Paulo - SP"
      />

      <label className="flex cursor-pointer items-start gap-2.5 rounded-[14px] bg-brand-50 px-4 py-3.5">
        <input
          type="checkbox"
          className="mt-0.5 accent-brand-500"
          checked={consentiuLocalizacao}
          onChange={(e) => setConsentiuLocalizacao(e.target.checked)}
        />
        <span className="text-[13px] leading-relaxed text-gray-700">
          {config?.texto_consentimento ??
            'Autorizo compartilhar minha localização aproximada para ajudar no reencontro.'}
        </span>
      </label>

      <div className="flex items-start gap-2.5 rounded-[14px] bg-brand-50 px-4 py-3.5 text-[13px] leading-relaxed text-gray-700">
        <LocationNoteIcon />
        Só usamos a região aproximada — nunca compartilhamos seu contato ou dados
        pessoais.
      </div>

      {isAnonymous && config?.habilitado && (
        <div className="rounded-[10px] border-[1.5px] border-surface-border bg-[#fbfaff] px-4 py-3.5">
          <Turnstile
            ref={turnstileRef}
            siteKey={config.site_key}
            onSuccess={setTurnstileToken}
            onExpire={() => setTurnstileToken(null)}
            options={{ theme: 'light', size: 'normal' }}
          />
        </div>
      )}

      {error && (
        <p className="rounded-[14px] bg-brand-50 px-4 py-3 text-sm text-brand-700">
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={loading}
        className="w-full py-[15px] text-[15px]"
      >
        {loading ? 'Enviando…' : 'Registrar resgate'}
        {!loading && <ArrowRightIcon />}
      </Button>
    </form>
  )
}
