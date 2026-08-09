import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PetForm } from '@/components/pets/PetForm'
import { TutorBackLink } from '@/components/tutor/TutorBackLink'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'
import { fetchCamposFormularioPet } from '@/lib/configuracoes'
import {
  animalToFormValues,
  getAnimalById,
  listAnimalFotos,
  updateAnimal,
} from '@/lib/pets'
import type { Animal, CampoFormularioPet, PetFormValues } from '@/types/pet'

export function PetEditPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [animal, setAnimal] = useState<Animal | null>(null)
  const [campos, setCampos] = useState<CampoFormularioPet[]>([])
  const [initialValues, setInitialValues] = useState<PetFormValues | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setError('Pet não informado')
      setLoading(false)
      return
    }

    async function load() {
      try {
        const [pet, camposForm] = await Promise.all([
          getAnimalById(id!),
          fetchCamposFormularioPet(),
        ])

        if (!pet) {
          setError('Pet não encontrado')
          return
        }
        if (user?.tutor?.id && pet.tutor_id !== user.tutor.id) {
          setError('Você não tem permissão para editar este pet')
          return
        }

        const fotos = await listAnimalFotos(pet.id)
        const values = await animalToFormValues(pet, fotos)

        setAnimal(pet)
        setCampos(camposForm)
        setInitialValues(values)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Erro ao carregar o pet',
        )
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [id, user?.tutor?.id])

  async function handleSubmit(values: PetFormValues) {
    if (!user?.tutor?.id || !animal) {
      throw new Error('Perfil de tutor não encontrado')
    }

    const updated = await updateAnimal(animal.id, user.tutor.id, values)
    navigate(`/tutor/pets/${updated.id}`, { replace: true })
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Carregando…</p>
  }

  if (error || !animal || !initialValues) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-red-600">{error ?? 'Pet não encontrado'}</p>
        <TutorBackLink to="/tutor">Voltar</TutorBackLink>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-[620px] space-y-6">
      <TutorBackLink to={`/tutor/pets/${animal.id}`}>
        Voltar para {animal.nome}
      </TutorBackLink>

      <div>
        <h1 className="font-display text-[25px] font-extrabold text-brand-dark">
          Editar {animal.nome}
        </h1>
        <p className="mt-1.5 text-sm text-gray-500">
          Atualize dados e fotos. O QR Code e o link da tag permanecem os
          mesmos — a etiqueta física continua válida.
        </p>
      </div>

      <Card className="p-8 sm:px-10">
        <PetForm
          mode="edit"
          campos={campos}
          initialValues={initialValues}
          onSubmit={handleSubmit}
          submitLabel="Salvar alterações"
        />
      </Card>
    </section>
  )
}
