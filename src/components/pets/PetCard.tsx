import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { PawIcon } from '@/components/ui/PawIcon'
import { getPetPhotoSignedUrl } from '@/lib/pets'
import type { Animal } from '@/types/pet'

interface PetCardProps {
  animal: Animal
}

export function PetCard({ animal }: PetCardProps) {
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!animal.foto_url) return
    void getPetPhotoSignedUrl(animal.foto_url).then(setFotoUrl)
  }, [animal.foto_url])

  return (
    <Link
      to={`/tutor/pets/${animal.id}`}
      className="flex items-center gap-4 rounded-card border border-surface-border bg-white p-5 shadow-card transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-soft"
    >
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-50 text-brand-500">
        {fotoUrl ? (
          <img src={fotoUrl} alt={animal.nome} className="h-full w-full object-cover" />
        ) : (
          <PawIcon className="h-7 w-7" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-bold text-brand-dark">{animal.nome}</h3>
        <p className="mt-0.5 text-[13px] text-gray-500">
          {[animal.especie, animal.raca, animal.porte].filter(Boolean).join(' · ') ||
            'Sem detalhes'}
        </p>
        <div className="mt-2">
          <Badge>QR ativo</Badge>
        </div>
        <p className="mt-1.5 text-[11.5px] text-gray-400">
          cadastrado em {new Date(animal.created_at).toLocaleDateString('pt-BR')}
        </p>
      </div>
    </Link>
  )
}
