import type { AdocaoFilters as Filters } from '@/types/adocao'

interface AdocaoFiltersProps {
  value: Filters
  onChange: (next: Filters) => void
  onClear: () => void
  className?: string
}

const selectClass =
  'w-full rounded-[10px] border border-surface-border bg-white px-3 py-2 text-[13px] text-brand-dark outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

export function AdocaoFiltersPanel({
  value,
  onChange,
  onClear,
  className = '',
}: AdocaoFiltersProps) {
  function set<K extends keyof Filters>(key: K, v: Filters[K]) {
    onChange({ ...value, [key]: v })
  }

  return (
    <aside
      className={`rounded-[16px] border border-surface-border bg-white p-4 shadow-card ${className}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-[15px] font-extrabold text-brand-dark">
          Filtros
        </h2>
        <button
          type="button"
          onClick={onClear}
          className="text-[12px] font-semibold text-brand-500 hover:underline"
        >
          Limpar
        </button>
      </div>

      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
            Busca
          </span>
          <input
            className={selectClass}
            placeholder="Nome do animal"
            value={value.q ?? ''}
            onChange={(e) => set('q', e.target.value)}
          />
        </label>

        <FieldSelect
          label="Espécie"
          value={value.especie ?? ''}
          onChange={(v) => set('especie', v as Filters['especie'])}
          options={[
            ['', 'Todas'],
            ['cao', 'Cão'],
            ['gato', 'Gato'],
            ['outro', 'Outro'],
          ]}
        />
        <FieldSelect
          label="Sexo"
          value={value.sexo ?? ''}
          onChange={(v) => set('sexo', v as Filters['sexo'])}
          options={[
            ['', 'Todos'],
            ['macho', 'Macho'],
            ['femea', 'Fêmea'],
          ]}
        />
        <FieldSelect
          label="Porte"
          value={value.porte ?? ''}
          onChange={(v) => set('porte', v as Filters['porte'])}
          options={[
            ['', 'Todos'],
            ['pequeno', 'Pequeno'],
            ['medio', 'Médio'],
            ['grande', 'Grande'],
            ['gigante', 'Gigante'],
          ]}
        />
        <FieldSelect
          label="Idade"
          value={value.idade_faixa ?? ''}
          onChange={(v) => set('idade_faixa', v as Filters['idade_faixa'])}
          options={[
            ['', 'Todas'],
            ['filhote', 'Filhote'],
            ['jovem', 'Jovem'],
            ['adulto', 'Adulto'],
            ['idoso', 'Idoso'],
          ]}
        />
        <FieldSelect
          label="Castrado"
          value={value.castrado ?? ''}
          onChange={(v) => set('castrado', v as Filters['castrado'])}
          options={[
            ['', 'Indiferente'],
            ['sim', 'Sim'],
            ['nao', 'Não'],
          ]}
        />
        <FieldSelect
          label="Sociável com crianças"
          value={value.sociavel_criancas ?? ''}
          onChange={(v) =>
            set('sociavel_criancas', v as Filters['sociavel_criancas'])
          }
          options={[
            ['', 'Indiferente'],
            ['sim', 'Sim'],
            ['com_cautela', 'Com cautela'],
            ['nao', 'Não'],
          ]}
        />
        <FieldSelect
          label="Status"
          value={value.status ?? ''}
          onChange={(v) => set('status', v as Filters['status'])}
          options={[
            ['', 'Abertos'],
            ['disponivel', 'Disponível'],
            ['em_processo', 'Em processo'],
          ]}
        />
        <label className="block space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
            Cidade / região
          </span>
          <input
            className={selectClass}
            placeholder="Ex.: São Paulo"
            value={value.cidade ?? ''}
            onChange={(e) => set('cidade', e.target.value)}
          />
        </label>
      </div>
    </aside>
  )
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: [string, string][]
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <select
        className={selectClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(([v, l]) => (
          <option key={v || 'all'} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  )
}
