import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'

export function PrivacyPolicyPage() {
  return (
    <section className="mx-auto max-w-[720px] space-y-6 py-2">
      <div>
        <p className="text-[12.5px] font-bold uppercase tracking-wide text-brand-500">
          MyPetID
        </p>
        <h1 className="mt-1 font-display text-[27px] font-extrabold text-brand-dark">
          Política de Privacidade
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Página provisória — o texto completo será publicado antes do
          lançamento.
        </p>
      </div>

      <Card className="space-y-4 p-8 text-sm leading-relaxed text-gray-600">
        <p>
          Ao cadastrar um pet, você autoriza o uso das fotos e características
          informadas para identificação e matching automático na plataforma,
          com o objetivo de facilitar o reencontro de animais perdidos.
        </p>
        <p>
          Os dados são tratados conforme a LGPD. Consentimentos são registrados
          com data/hora e contexto. Você pode solicitar exclusão ou revisão dos
          dados pelos canais de suporte da plataforma.
        </p>
        <p>
          Fotos e atributos do animal podem ser processados por modelos de
          análise visual para gerar embeddings usados apenas no fluxo de
          matching, sujeito às políticas de retenção do sistema.
        </p>
      </Card>

      <p className="text-sm text-gray-500">
        <Link to="/login" className="font-semibold text-brand-500 hover:underline">
          Voltar ao login
        </Link>
      </p>
    </section>
  )
}
