import clsx from 'clsx'

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <div className={clsx(
      'border-4 border-halu-200 border-t-halu-600 rounded-full animate-spin',
      size === 'sm' && 'w-4 h-4 border-2',
      size === 'md' && 'w-7 h-7',
      size === 'lg' && 'w-10 h-10',
      className
    )} />
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────
type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'

const badgeStyles: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger:  'bg-red-100 text-red-600',
  info:    'bg-halu-100 text-halu-700',
  purple:  'bg-purple-100 text-purple-700',
}

export function Badge({ children, variant = 'default', className }: {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
      badgeStyles[variant], className
    )}>
      {children}
    </span>
  )
}

// ── EmptyState ────────────────────────────────────────────────────────────────
export function EmptyState({ title, description, action }: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <h3 className="font-semibold text-slate-800 text-base">{title}</h3>
      {description && <p className="text-slate-500 text-sm mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

// ── PageHeader ────────────────────────────────────────────────────────────────
export function PageHeader({ title, description, action }: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{title}</h1>
        {description && <p className="text-slate-500 text-sm mt-0.5">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

// ── Input ─────────────────────────────────────────────────────────────────────
export function Input({ label, error, className, ...props }: {
  label?: string
  error?: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <input
        className={clsx(
          'w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all',
          'focus:outline-none focus:ring-2',
          error
            ? 'border-red-300 focus:ring-red-200 focus:border-red-400 bg-red-50'
            : 'border-slate-200 focus:ring-halu-500/20 focus:border-halu-400 bg-slate-50',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ── Select ────────────────────────────────────────────────────────────────────
export function Select({ label, error, children, className, ...props }: {
  label?: string
  error?: string
  children: React.ReactNode
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <select
        className={clsx(
          'w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all appearance-none',
          'focus:outline-none focus:ring-2 bg-slate-50',
          error
            ? 'border-red-300 focus:ring-red-200 focus:border-red-400'
            : 'border-slate-200 focus:ring-halu-500/20 focus:border-halu-400',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ── Button ────────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

const btnStyles: Record<BtnVariant, string> = {
  primary:   'bg-halu-600 hover:bg-halu-700 text-white focus:ring-halu-500/30',
  secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 focus:ring-slate-200',
  danger:    'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500/30',
  ghost:     'hover:bg-slate-100 text-slate-600 focus:ring-slate-200',
}

export function Button({ children, variant = 'primary', loading, className, ...props }: {
  children: React.ReactNode
  variant?: BtnVariant
  loading?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      disabled={loading || props.disabled}
      className={clsx(
        'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium',
        'transition-all focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed',
        btnStyles[variant], className
      )}
      {...props}
    >
      {loading && <Spinner size="sm" className="border-white/30 border-t-white" />}
      {children}
    </button>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, className, padding = true }: {
  children: React.ReactNode
  className?: string
  padding?: boolean
}) {
  return (
    <div className={clsx(
      'bg-white rounded-2xl border border-slate-100',
      padding && 'p-6',
      className
    )}>
      {children}
    </div>
  )
}

// ── SearchBar ─────────────────────────────────────────────────────────────────
export function SearchBar({ value, onChange, placeholder = 'Buscar...', className }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={clsx('relative', className)}>
      <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
        fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm
          bg-white focus:outline-none focus:ring-2 focus:ring-halu-500/20 focus:border-halu-400
          placeholder:text-slate-400 transition-all"
      />
    </div>
  )
}

export { CupsAutocomplete } from './CupsAutocomplete'
export { Cie10Autocomplete } from './Cie10Autocomplete'
export { default as BuscadorPacienteIngreso } from './BuscadorPacienteIngreso'
export type { PacienteResumen, IngresoResumen } from './BuscadorPacienteIngreso'
