import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PetForm } from '@/components/pets/PetForm'
import { TutorBackLink } from '@/components/tutor/TutorBackLink'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'
import { fetchCamposFormularioPet } from '@/lib/configuracoes'
import { createAnimal } from '@/lib/pets'
import type { CampoFormularioPet, PetFormValues } from '@/types/pet'

export function PetNewPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [campos, setCampos] = useState<CampoFormularioPet[]>([])
  const [loadingCampos, setLoadingCampos] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchCamposFormularioPet()
      .then(setCampos)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Erro ao carregar formulário'),
      )
      .finally(() => setLoadingCampos(false))
  }, [])

  async function handleSubmit(values: PetFormValues) {
    if (!user?.tutor?.id) {
      throw new Error('Perfil de tutor não encontrado')
    }

    const animal = await createAnimal(user.tutor.id, values)
    navigate(`/tutor/pets/${animal.id}`, { replace: true })
  }

  return (
    <section className="mx-auto max-w-[620px] space-y-6">
      <TutorBackLink to="/tutor">Voltar para meus pets</TutorBackLink>

      <div>
        <h1 className="font-display text-[25px] font-extrabold text-brand-dark">
          Cadastrar pet
        </h1>
        <p className="mt-1.5 text-sm text-gray-500">
          Cadastre o pet com fotos. Em seguida você solicita a tag e gera o QR
          Code + NFC.
        </p>
      </div>

      {loadingCampos && <p className="text-sm text-gray-500">Carregando formulário…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loadingCampos && campos.length > 0 && (
        <Card className="p-8 sm:px-10">
          <PetForm
            campos={campos}
            onSubmit={handleSubmit}
            submitLabel="Cadastrar pet"
          />
        </Card>
      )}
    </section>
  )
}
