import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PetCard } from '@/components/pets/PetCard'
import { Button, ButtonLink } from '@/components/ui/Button'
import { PawIcon } from '@/components/ui/PawIcon'
import { useAuth } from '@/contexts/AuthContext'
import { ensureTutorProfile } from '@/lib/auth'
import { listAnimaisByTutor } from '@/lib/pets'
import { supabase } from '@/lib/supabase'
import type { Animal } from '@/types/pet'

function NewPetCard() {
  return (
    <Link
      to="/tutor/pets/novo"
      className="flex flex-col items-center justify-center gap-2.5 rounded-card border-2 border-dashed border-surface-border bg-white p-8 text-sm font-bold text-gray-500 transition-colors hover:border-brand-500 hover:text-brand-500"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-500">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>
      Adicionar novo pet
    </Link>
  )
}

export function TutorDashboardPage() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [animais, setAnimais] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      if (!user) return

      try {
        let tutorId = user.tutor?.id

        if (!tutorId) {
          const {
            data: { user: authUser },
          } = await supabase.auth.getUser()

          if (authUser) {
            const profile = await ensureTutorProfile(authUser, {
              nome: String(authUser.user_metadata?.nome ?? authUser.email ?? 'Tutor'),
              telefone: authUser.user_metadata?.telefone
                ? String(authUser.user_metadata.telefone)
                : undefined,
            })
            tutorId = profile?.id
            await refreshUser()
          }
        }

        if (!tutorId) {
          setError('Perfil de tutor não encontrado. Faça o cadastro em /cadastro.')
          return
        }

        const lista = await listAnimaisByTutor(tutorId)
        setAnimais(lista)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar pets')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [user, refreshUser])

  return (
    <section className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[27px] font-extrabold text-brand-dark">
            Meus pets
          </h1>
          <p className="mt-1.5 text-sm text-gray-500">
            Cadastre animais, gere QR Codes e acompanhe ocorrências.
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => navigate('/tutor/pets/novo')}
        >
          + Novo pet
        </Button>
      </div>

      {loading && <p className="text-sm text-gray-500">Carregando…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && animais.length === 0 && (
        <div className="rounded-card border-2 border-dashed border-surface-border bg-white p-10 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-500">
            <PawIcon className="h-7 w-7" />
          </span>
          <p className="text-gray-500">Nenhum pet cadastrado ainda.</p>
          <ButtonLink to="/tutor/pets/novo" variant="primary" size="sm" className="mt-4">
            Cadastrar primeiro pet
          </ButtonLink>
        </div>
      )}

      {!loading && !error && animais.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2">
          {animais.map((animal) => (
            <PetCard key={animal.id} animal={animal} />
          ))}
          <NewPetCard />
        </div>
      )}
    </section>
  )
}
