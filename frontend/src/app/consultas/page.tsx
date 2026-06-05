'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useConsultas } from '@/hooks/useConsultas'
import { PageHeader, Button, Badge, EmptyState, SearchBar, Spinner } from '@/components/ui'
import { ClipboardPlus, ChevronRight, Receipt } from 'lucide-react'
import clsx from 'clsx'

const ESTADO_COLOR: Record<string, 'default' | 'success' | 'warning' | 'info' | 'danger'> = {
  abierta: 'warning', cerrada: 'info', facturada: 'success', anulada: 'danger'
}

export default function ConsultasPage() {
  const { usuario } = useAuth()
  const [search, setSearch] = useState('')
  const { data, loading } = useConsultas(search ? { search } : undefined)
  const consultas = data?.results ?? []

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="Consultas clínicas"
        description={`${data?.count ?? 0} consultas registradas`}
        action={
          usuario?.permisos.puede_editar_clinica ? (
            <Link href="/consultas/nueva">
              <Button><ClipboardPlus className="w-4 h-4" />Nueva consulta</Button>
            </Link>
          ) : undefined
        }
      />
      <div className="mb-5">
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar por paciente, CUPS o CIE-10..." className="max-w-md" />
      </div>
      <div className="space-y-2">
        {loading ? <Spinner size="lg" className="mx-auto mt-10" /> :
          consultas.length === 0 ? (
            <EmptyState title="Sin consultas" description="Las consultas clínicas registradas aparecerán aquí"
              action={usuario?.permisos.puede_editar_clinica ? (
                <Link href="/consultas/nueva"><Button><ClipboardPlus className="w-4 h-4" />Nueva consulta</Button></Link>
              ) : undefined} />
          ) : consultas.map(c => (
            <Link key={c.id} href={`/consultas/${c.id}`}
              className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 hover:border-halu-200 hover:shadow-sm transition-all group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate-900 text-sm">{c.paciente_nombre}</p>
                  <Badge variant={ESTADO_COLOR[c.estado] ?? 'default'}>{c.estado}</Badge>
                  <span className="font-mono text-xs text-slate-400">{c.cups_principal}</span>
                  <span className="text-xs text-slate-400">{c.diagnostico_principal}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                  <span>{new Date(c.fecha_atencion).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })}</span>
                  <span>Total: ${c.valor_total?.toLocaleString('es-CO')}</span>
                  {c.procedimientos?.length > 0 && <span>{c.procedimientos.length} procedimiento(s)</span>}
                </div>
              </div>
              {c.estado === 'cerrada' && usuario?.permisos.puede_facturar && (
                <div className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                  <Receipt className="w-3 h-3" />Facturar
                </div>
              )}
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-halu-400 flex-shrink-0" />
            </Link>
          ))
        }
      </div>
    </div>
  )
}
