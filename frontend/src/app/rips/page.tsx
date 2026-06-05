'use client'
import { useEffect, useState } from 'react'
import { facturasAPI, mensajeError } from '@/lib/api'
import { PageHeader, Badge, Button, EmptyState } from '@/components/ui'
import toast from 'react-hot-toast'
import {
  FileJson, CheckCircle, AlertCircle, Download, Eye, X,
  ShieldCheck, FileText, RefreshCw,
} from 'lucide-react'
import clsx from 'clsx'

interface Factura {
  id: string
  numero_factus: string | null
  cufe: string | null
  cuv: string | null
  estado: string
  total: string
  tiene_rips: boolean
  creado_en: string
  consulta_info?: {
    paciente?: string
    fecha?: string
    cups?: string
    diagnostico?: string
  }
}

const ESTADO_BADGE: Record<string, string> = {
  validada: 'success', enviada: 'info', error: 'danger',
  anulada: 'default', borrador: 'warning',
}

export default function RipsPage() {
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [loading, setLoading]   = useState(true)
  const [ripsJson, setRipsJson] = useState<unknown | null>(null)
  const [ripsFactura, setRipsFactura] = useState<Factura | null>(null)
  const [cargandoRips, setCargandoRips] = useState(false)

  const cargar = async () => {
    setLoading(true)
    try {
      const { data } = await facturasAPI.list({ page_size: 200 })
      setFacturas(data.results || data)
    } catch (err) { toast.error(mensajeError(err)) }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const verRips = async (factura: Factura) => {
    setRipsFactura(factura)
    setCargandoRips(true)
    setRipsJson(null)
    try {
      const { data } = await facturasAPI.rips(factura.id)
      setRipsJson(data)
    } catch (err) {
      toast.error(mensajeError(err))
      setRipsFactura(null)
    } finally { setCargandoRips(false) }
  }

  const descargarRips = (factura: Factura, json: unknown) => {
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `RIPS_${factura.numero_factus || factura.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const conRips    = facturas.filter(f => f.tiene_rips).length
  const validadas  = facturas.filter(f => f.estado === 'validada').length

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="RIPS"
        description="Registro Individual de Prestación de Servicios — soporte de la factura electrónica (Res. 948/2026)"
        action={<Button variant="secondary" onClick={cargar}><RefreshCw className="w-4 h-4" />Actualizar</Button>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Facturas con RIPS', valor: conRips,        icon: FileJson,    color: 'text-halu-600',    bg: 'bg-halu-50' },
          { label: 'Validadas DIAN',    valor: validadas,      icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Total facturas',    valor: facturas.length, icon: FileText,   color: 'text-slate-600',   bg: 'bg-slate-100' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl p-5 border border-slate-100">
            <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center mb-3', k.bg)}>
              <k.icon className={clsx('w-5 h-5', k.color)} />
            </div>
            <p className="text-3xl font-bold text-slate-900">{k.valor}</p>
            <p className="text-sm text-slate-500 mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Banner normativo */}
      <div className="bg-gradient-to-br from-halu-900 to-halu-700 rounded-2xl p-5 text-white mb-6 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-teal-300 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold">RIPS como soporte de la Factura Electrónica de Venta</p>
          <p className="text-xs text-halu-200 mt-1">
            Cada factura del sector salud genera su RIPS en formato JSON (Resolución 948 de 2026).
            El CUV confirma la validación ante el MinSalud. Aquí puedes consultarlo y descargarlo.
          </p>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-slate-100 animate-pulse rounded-xl" />)}
          </div>
        ) : facturas.length === 0 ? (
          <EmptyState
            title="Aún no hay facturas"
            description="Cuando emitas facturas del sector salud, su RIPS aparecerá aquí para consulta y descarga."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                <th className="px-5 py-3 font-medium">Factura</th>
                <th className="px-5 py-3 font-medium">Paciente</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">CUV</th>
                <th className="px-5 py-3 font-medium">RIPS</th>
                <th className="px-5 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {facturas.map(f => (
                <tr key={f.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-800">{f.numero_factus || '—'}</p>
                    <p className="text-xs text-slate-400">{new Date(f.creado_en).toLocaleDateString('es-CO')}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{f.consulta_info?.paciente || '—'}</td>
                  <td className="px-5 py-3">
                    <Badge variant={(ESTADO_BADGE[f.estado] || 'default') as any} className="capitalize">{f.estado}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    {f.cuv
                      ? <span className="text-xs font-mono text-slate-500" title={f.cuv}>{f.cuv.slice(0, 10)}…</span>
                      : <span className="text-xs text-slate-300">Sin CUV</span>}
                  </td>
                  <td className="px-5 py-3">
                    {f.tiene_rips
                      ? <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium"><CheckCircle className="w-3.5 h-3.5" />Generado</span>
                      : <span className="inline-flex items-center gap-1 text-slate-400 text-xs"><AlertCircle className="w-3.5 h-3.5" />Pendiente</span>}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => verRips(f)}
                        disabled={!f.tiene_rips}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-halu-600 hover:bg-halu-50 disabled:text-slate-300 disabled:hover:bg-transparent transition-all"
                        title="Ver RIPS">
                        <Eye className="w-3.5 h-3.5" />Ver
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal visor RIPS */}
      {ripsFactura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileJson className="w-5 h-5 text-halu-600" />
                <div>
                  <p className="font-semibold text-slate-900">RIPS · {ripsFactura.numero_factus || 'Factura'}</p>
                  <p className="text-xs text-slate-400">{ripsFactura.consulta_info?.paciente}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {ripsJson != null && (
                  <Button variant="secondary" onClick={() => descargarRips(ripsFactura, ripsJson)} className="px-3 py-1.5 text-xs">
                    <Download className="w-3.5 h-3.5" />Descargar JSON
                  </Button>
                )}
                <button onClick={() => { setRipsFactura(null); setRipsJson(null) }}
                  className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-auto">
              {cargandoRips ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-4 border-halu-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <pre className="text-xs bg-slate-900 text-slate-100 rounded-xl p-4 overflow-auto leading-relaxed">
                  {JSON.stringify(ripsJson, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
