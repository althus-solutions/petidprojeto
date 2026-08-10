import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { InstallAppCard } from '@/components/pwa/InstallAppCard'
import { Button, ButtonLink } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import { getTutorPhotoSignedUrl } from '@/lib/tutor-perfil'

export function TutorPerfilMenuPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { status: pwaStatus, canPrompt, promptInstall } = usePwaInstall()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [showInstall, setShowInstall] = useState(false)

  const nome = user?.tutor?.nome?.trim() || 'Tutor'

  useEffect(() => {
    const path = user?.tutor?.foto_url
    if (!path) {
      setAvatarUrl(null)
      return
    }
    void getTutorPhotoSignedUrl(path).then(setAvatarUrl)
  }, [user?.tutor?.foto_url])

  async function handleBaixarApp() {
    if (pwaStatus === 'installed') {
      setShowInstall(true)
      return
    }
    if (canPrompt) {
      const ok = await promptInstall()
      if (ok) return
    }
    setShowInstall(true)
  }

  return (
    <section className="mx-auto flex max-w-md flex-col items-center pt-4">
      <div className="flex w-full flex-col items-center rounded-[22px] border border-surface-border bg-white px-6 py-8 shadow-card">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-brand-100 bg-brand-50 text-brand-500">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <ProfileIconLarge />
          )}
        </div>

        <h1 className="mt-4 text-center font-display text-[22px] font-extrabold text-brand-dark">
          {nome}
        </h1>
        {user?.email && (
          <p className="mt-1 text-center text-[13px] text-gray-500">
            {user.email}
          </p>
        )}

        <div className="mt-8 flex w-full flex-col gap-3">
          <ButtonLink
            to="/tutor/perfil/editar"
            variant="primary"
            className="w-full justify-center"
          >
            Editar Perfil
          </ButtonLink>

          <Button
            type="button"
            variant="outline"
            className="w-full justify-center"
            onClick={() => void handleBaixarApp()}
          >
            {pwaStatus === 'installed' ? 'App instalado' : 'Baixar app'}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full justify-center border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50"
            onClick={() => void signOut().then(() => navigate('/login'))}
          >
            Sair
          </Button>
        </div>
      </div>

      {showInstall && (
        <div id="baixar-app" className="mt-5 w-full">
          <InstallAppCard />
        </div>
      )}
    </section>
  )
}

function ProfileIconLarge() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 19.5c1.6-3.2 4-4.8 6.5-4.8s4.9 1.6 6.5 4.8" />
    </svg>
  )
}
