import { Link } from 'react-router-dom'

export function AdminBreadcrumb({ current }: { current: string }) {
  return (
    <nav
      className="mb-[18px] flex flex-wrap items-center gap-1.5 text-[13.5px] text-gray-500"
      aria-label="Breadcrumb"
    >
      <Link to="/admin" className="font-bold text-brand-500 hover:opacity-80">
        Painel admin
      </Link>
      <span aria-hidden>/</span>
      <span className="text-gray-500">{current}</span>
    </nav>
  )
}
