'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { usePacientes } from '@/hooks/usePacientes'
import { PacienteCard, PacienteCardSkeleton } from '@/components/pacientes/PacienteCard'
import { PageHeader, SearchBar, EmptyState, Button, Badge } from '@/components/ui'
import { UserPlus, ChevronLeft, ChevronRight } from 'lucide-react'

export default function PacientesPage() {
  const { usuario } = useAuth()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const { data, loading, page, setPage } = usePacientes(debouncedSearch)
  const totalPages = data ? Math.ceil(data.count / 25) : 0

  return (
    <div className="p-8 animate-fade-in">
      <PageHeader
        title="Pacientes"
        description={data ? `${data.count} pacientes registrados` : 'Gestión de pacientes'}
        action={
          usuario?.permisos.puede_gestionar_citas ? (
            <Link href="/pacientes/nuevo">
              <Button>
                <UserPlus className="w-4 h-4" />
                Nuevo paciente
              </Button>
            </Link>
          ) : undefined
        }
      />

      <div className="flex items-center gap-3 mb-6">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre, cédula o correo..."
          className="flex-1 max-w-md"
        />
        {debouncedSearch && (
          <Badge variant="info">
            Búsqueda: &ldquo;{debouncedSearch}&rdquo;
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <PacienteCardSkeleton key={i} />)
        ) : !data?.results.length ? (
          <EmptyState
            title={debouncedSearch ? 'Sin resultados' : 'No hay pacientes registrados'}
            description={
              debouncedSearch
                ? `No se encontró ningún paciente con "${debouncedSearch}"`
                : 'Registra el primer paciente para comenzar'
            }
            action={
              !debouncedSearch && usuario?.permisos.puede_gestionar_citas ? (
                <Link href="/pacientes/nuevo">
                  <Button><UserPlus className="w-4 h-4" />Registrar paciente</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          data.results.map(p => <PacienteCard key={p.id} paciente={p} />)
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-100">
          <p className="text-sm text-slate-500">
            Página {page} de {totalPages} · {data?.count} pacientes
          </p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const n = page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i
              if (n < 1 || n > totalPages) return null
              return (
                <button key={n} onClick={() => setPage(n)}
                  className={`w-9 h-9 rounded-xl text-sm font-medium transition-all ${n === page ? 'bg-halu-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {n}
                </button>
              )
            })}
            <Button variant="secondary" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
