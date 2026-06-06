'use client'
import { useEffect, useState, useCallback } from 'react'
import { facturasAPI, mensajeError } from '@/lib/api'
import api from '@/lib/api'
import { PageHeader, Badge, Button, EmptyState } from '@/components/ui'
import toast from 'react-hot-toast'
import {
  FileJson, CheckCircle, AlertCircle, Download, Eye, X,
  ShieldCheck, FileText, RefreshCw, Printer, FilePen,
  AlertTriangle, ChevronRight, Loader2, Plus,
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
  consulta_info?: { paciente?: string; fecha?: string; cups?: string; diagnostico?: string }
}

interface NotaAjuste {
  id: string
  factura: string
  factura_numero: string
  cuv_original: string
  motivo_tipo: string
  motivo_tipo_label: string
  motivo_detalle: string
  datos_originales: Record<string, unknown>
  datos_corregidos: Record<string, unknown>
  rips_ajuste_json: unknown
  estado: string
  estado_label: string
  cuv_ajuste: string
  creado_por_nombre: string
  creado_en: string
}

const ESTADO_BADGE: Record<string, string> = {
  validada: 'success', enviada: 'info', error: 'danger',
  anulada: 'default', borrador: 'warning',
}
const NA_ESTADO_COLOR: Record<string, string> = {
  borrador:  'bg-slate-100 text-slate-600',
  enviada:   'bg-blue-100 text-blue-700',
  aceptada:  'bg-green-100 text-green-700',
  rechazada: 'bg-red-100 text-red-600',
}
const MOTIVOS = [
  { value: 'diagnostico',    label: 'Diagnóstico incorrecto (CIE-10)' },
  { value: 'cups',           label: 'Código de procedimiento incorrecto (CUPS)' },
  { value: 'datos_paciente', label: 'Datos demográficos del paciente' },
  { value: 'fecha_servicio', label: 'Fecha de servicio incorrecta' },
  { value: 'tipo_usuario',   label: 'Tipo de usuario / régimen incorrecto' },
  { value: 'via_ingreso',    label: 'Vía de ingreso incorrecta' },
  { value: 'causa_externa',  label: 'Causa externa incorrecta' },
  { value: 'finalidad',      label: 'Finalidad de la consulta incorrecta' },
  { value: 'otro',           label: 'Otro error clínico' },
]

// ── Modal visor RIPS ──────────────────────────────────────────────────────────
function ModalRIPS({ factura, json, cargando, onClose }: {
  factura: Factura; json: unknown; cargando: boolean; onClose: () => void
}) {
  const descargar = () => {
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `RIPS_${factura.numero_factus || factura.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  const imprimir = () => {
    const ventana = window.open('', '_blank')
    if (!ventana) return
    ventana.document.write(`<pre style="font-family:monospace;font-size:12px;white-space:pre-wrap">${JSON.stringify(json, null, 2)}</pre>`)
    ventana.document.close()
    ventana.print()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileJson className="w-5 h-5 text-halu-600" />
            <div>
              <p className="font-semibold text-slate-900">RIPS · {factura.numero_factus || 'Factura'}</p>
              <p className="text-xs text-slate-400">{factura.consulta_info?.paciente}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {json != null && (
              <>
                <button
                  onClick={imprimir}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Reimprimir</span>
                </button>
                <button
                  onClick={descargar}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-halu-600 text-white rounded-lg hover:bg-halu-700"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Descargar JSON</span>
                </button>
              </>
            )}
            <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="p-5 overflow-auto flex-1">
          {cargando ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-halu-500" />
            </div>
          ) : (
            <pre className="text-xs bg-slate-900 text-slate-100 rounded-xl p-4 overflow-auto leading-relaxed">
              {JSON.stringify(json, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Modal nueva nota de ajuste ────────────────────────────────────────────────
function ModalNuevoAjuste({ facturas, onClose, onSaved }: {
  facturas: Factura[]; onClose: () => void; onSaved: () => void
}) {
  const [facturaId, setFacturaId]   = useState('')
  const [motivo, setMotivo]         = useState('diagnostico')
  const [detalle, setDetalle]       = useState('')
  const [originales, setOriginales] = useState('{}')
  const [corregidos, setCorregidos] = useState('{}')
  const [saving, setSaving]         = useState(false)

  const guardar = async () => {
    if (!facturaId || !detalle.trim()) {
      toast.error('Selecciona la factura y describe el motivo del ajuste')
      return
    }
    let dataOrig: Record<string, unknown> = {}
    let dataCor: Record<string, unknown> = {}
    try {
      dataOrig = JSON.parse(originales)
      dataCor  = JSON.parse(corregidos)
    } catch {
      toast.error('Los campos de datos deben ser JSON válido')
      return
    }
    setSaving(true)
    try {
      await api.post('/api/rips/notas-ajuste/', {
        factura: facturaId,
        motivo_tipo: motivo,
        motivo_detalle: detalle,
        datos_originales: dataOrig,
        datos_corregidos: dataCor,
      })
      toast.success('Nota de ajuste creada')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(mensajeError(err))
    } finally {
      setSaving(false)
    }
  }

  const facturasConRips = facturas.filter(f => f.tiene_rips && f.cuv)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FilePen className="w-5 h-5 text-amber-600" />
            <div>
              <p className="font-semibold text-slate-900">Nueva nota de ajuste RIPS</p>
              <p className="text-xs text-slate-400">Res. 948/2026 — corrección de datos clínicos</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-auto space-y-4">
          {/* Aviso normativo */}
          <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              La <strong>nota de ajuste</strong> corrige errores <strong>clínicos</strong> (diagnóstico, CUPS,
              datos del paciente) en un RIPS ya aceptado por el pagador. Para correcciones de
              valor económico use nota crédito/débito en la FEV. No modifica el monto cobrado.
            </p>
          </div>

          <div>
            <label className="label-xs">Factura a corregir *</label>
            {facturasConRips.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No hay facturas con RIPS validado disponibles.</p>
            ) : (
              <select className="input-base w-full" value={facturaId} onChange={e => setFacturaId(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {facturasConRips.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.numero_factus} · {f.consulta_info?.paciente || 'Sin paciente'} · CUV: {f.cuv?.slice(0, 12)}…
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="label-xs">Tipo de error *</label>
            <select className="input-base w-full" value={motivo} onChange={e => setMotivo(e.target.value)}>
              {MOTIVOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div>
            <label className="label-xs">Descripción del error y la corrección *</label>
            <textarea
              className="input-base w-full min-h-[80px] resize-none"
              placeholder="Describe qué estaba mal y qué dato correcto se debe reportar..."
              value={detalle}
              onChange={e => setDetalle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-xs">Datos incorrectos (JSON)</label>
              <textarea
                className="input-base w-full min-h-[80px] font-mono text-xs resize-none"
                placeholder={'{\n  "codigoDiagnostico": "J06.9"\n}'}
                value={originales}
                onChange={e => setOriginales(e.target.value)}
              />
              <p className="text-xs text-slate-400 mt-1">Campos con el valor erróneo</p>
            </div>
            <div>
              <label className="label-xs">Datos corregidos (JSON)</label>
              <textarea
                className="input-base w-full min-h-[80px] font-mono text-xs resize-none"
                placeholder={'{\n  "codigoDiagnostico": "J00"\n}'}
                value={corregidos}
                onChange={e => setCorregidos(e.target.value)}
              />
              <p className="text-xs text-slate-400 mt-1">Campos con el valor correcto</p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={saving || facturasConRips.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-500 text-white font-medium rounded-xl hover:bg-amber-600 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Crear nota de ajuste
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
type Tab = 'facturas' | 'notas_ajuste'

export default function RipsPage() {
  const [tab, setTab]             = useState<Tab>('facturas')
  const [facturas, setFacturas]   = useState<Factura[]>([])
  const [notas, setNotas]         = useState<NotaAjuste[]>([])
  const [loading, setLoading]     = useState(true)
  const [ripsJson, setRipsJson]   = useState<unknown | null>(null)
  const [ripsFactura, setRipsFactura] = useState<Factura | null>(null)
  const [cargandoRips, setCargandoRips] = useState(false)
  const [showNuevoAjuste, setShowNuevoAjuste] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [resF, resN] = await Promise.all([
        facturasAPI.list({ page_size: 200 }),
        api.get('/api/rips/notas-ajuste/'),
      ])
      setFacturas(resF.data.results || resF.data)
      setNotas(resN.data.results || resN.data)
    } catch (err) { toast.error(mensajeError(err)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

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

  const generarRipsAjuste = async (notaId: string) => {
    try {
      await api.post(`/api/rips/notas-ajuste/${notaId}/generar_rips/`)
      toast.success('RIPS de ajuste generado')
      cargar()
    } catch (err) { toast.error(mensajeError(err)) }
  }

  const conRips   = facturas.filter(f => f.tiene_rips).length
  const validadas = facturas.filter(f => f.estado === 'validada').length

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="RIPS"
        description="Registro Individual de Prestación de Servicios — Res. 948/2026"
        action={<Button variant="secondary" onClick={cargar}><RefreshCw className="w-4 h-4" />Actualizar</Button>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Facturas con RIPS', valor: conRips,        icon: FileJson,    color: 'text-halu-600',    bg: 'bg-halu-50' },
          { label: 'Validadas DIAN',    valor: validadas,      icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Total facturas',    valor: facturas.length, icon: FileText,   color: 'text-slate-600',   bg: 'bg-slate-100' },
          { label: 'Notas de ajuste',   valor: notas.length,   icon: FilePen,    color: 'text-amber-600',   bg: 'bg-amber-50' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl p-4 border border-slate-100">
            <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center mb-2', k.bg)}>
              <k.icon className={clsx('w-4 h-4', k.color)} />
            </div>
            <p className="text-2xl font-bold text-slate-900">{k.valor}</p>
            <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Banner normativo */}
      <div className="bg-gradient-to-br from-halu-900 to-halu-700 rounded-2xl p-4 text-white mb-6 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-teal-300 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold">RIPS como soporte de la Factura Electrónica de Venta</p>
          <p className="text-xs text-halu-200 mt-1">
            Cada factura del sector salud genera su RIPS en formato JSON (Res. 948/2026).
            El CUV confirma la validación ante el MinSalud. La <strong className="text-white">nota de ajuste</strong> corrige
            errores clínicos (diagnóstico, CUPS, datos del paciente) sin modificar valores de facturación.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-4 w-fit">
        {([
          { key: 'facturas',      label: 'Facturas RIPS',    icon: FileJson },
          { key: 'notas_ajuste',  label: 'Notas de ajuste',  icon: FilePen },
        ] as { key: Tab; label: string; icon: React.ElementType }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.key === 'notas_ajuste' && notas.length > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs px-1.5 rounded-full">{notas.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: Facturas RIPS ── */}
      {tab === 'facturas' && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-slate-100 animate-pulse rounded-xl" />)}
            </div>
          ) : facturas.length === 0 ? (
            <EmptyState title="Aún no hay facturas" description="Cuando emitas facturas del sector salud, su RIPS aparecerá aquí." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                    <th className="px-4 py-3 font-medium">Factura</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">Paciente</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium hidden lg:table-cell">CUV</th>
                    <th className="px-4 py-3 font-medium">RIPS</th>
                    <th className="px-4 py-3 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {facturas.map(f => (
                    <tr key={f.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{f.numero_factus || '—'}</p>
                        <p className="text-xs text-slate-400">{new Date(f.creado_en).toLocaleDateString('es-CO')}</p>
                        {/* Paciente visible en móvil bajo el número */}
                        <p className="text-xs text-slate-500 md:hidden mt-0.5">{f.consulta_info?.paciente || '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{f.consulta_info?.paciente || '—'}</td>
                      <td className="px-4 py-3">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        <Badge variant={(ESTADO_BADGE[f.estado] || 'default') as any} className="capitalize">{f.estado}</Badge>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {f.cuv
                          ? <span className="text-xs font-mono text-slate-500" title={f.cuv}>{f.cuv.slice(0, 10)}…</span>
                          : <span className="text-xs text-slate-300">Sin CUV</span>}
                      </td>
                      <td className="px-4 py-3">
                        {f.tiene_rips
                          ? <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium"><CheckCircle className="w-3.5 h-3.5" />Generado</span>
                          : <span className="inline-flex items-center gap-1 text-slate-400 text-xs"><AlertCircle className="w-3.5 h-3.5" />Pendiente</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          <button
                            onClick={() => verRips(f)}
                            disabled={!f.tiene_rips}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-halu-600 border border-halu-100 hover:bg-halu-50 disabled:text-slate-300 disabled:border-slate-100 disabled:hover:bg-transparent transition-all"
                            title="Ver RIPS">
                            <Eye className="w-3.5 h-3.5" /><span>Ver</span>
                          </button>
                          {f.tiene_rips && (
                            <button
                              onClick={() => verRips(f)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-600 border border-slate-100 hover:bg-slate-50 transition-all"
                              title="Reimprimir RIPS">
                              <Printer className="w-3.5 h-3.5" /><span className="hidden sm:inline">Reimprimir</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Notas de ajuste ── */}
      {tab === 'notas_ajuste' && (
        <div className="space-y-4">
          {/* Explicación + botón nueva nota */}
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                <FilePen className="w-4 h-4" /> Nota de ajuste RIPS
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Corrige errores clínicos (diagnóstico, CUPS, datos demográficos) en un RIPS ya aceptado
                por el pagador, sin modificar los valores facturados. Se transmite a MinSalud vía Factus
                con referencia al CUV del RIPS original.
              </p>
            </div>
            <button
              onClick={() => setShowNuevoAjuste(true)}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-xl hover:bg-amber-600"
            >
              <Plus className="w-4 h-4" />
              Nueva nota de ajuste
            </button>
          </div>

          {/* Lista de notas */}
          {loading ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            </div>
          ) : notas.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
              <FilePen className="w-12 h-12 mx-auto mb-3 text-slate-200" />
              <p className="text-slate-400">No hay notas de ajuste registradas</p>
              <p className="text-xs text-slate-300 mt-1">Crea una cuando detectes un error clínico en un RIPS ya validado</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 font-medium">Factura</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">Tipo de error</th>
                    <th className="px-4 py-3 font-medium hidden lg:table-cell">CUV original</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">Creado</th>
                    <th className="px-4 py-3 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {notas.map(n => (
                    <tr key={n.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{n.factura_numero || '—'}</p>
                        <p className="text-xs text-amber-600 md:hidden">{n.motivo_tipo_label}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden md:table-cell text-xs">{n.motivo_tipo_label}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {n.cuv_original
                          ? <span className="text-xs font-mono text-slate-500" title={n.cuv_original}>{n.cuv_original.slice(0, 12)}…</span>
                          : <span className="text-xs text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx('text-xs px-2 py-1 rounded-full font-medium', NA_ESTADO_COLOR[n.estado] || 'bg-slate-100 text-slate-600')}>
                          {n.estado_label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 hidden md:table-cell">
                        {new Date(n.creado_en).toLocaleDateString('es-CO')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {n.estado === 'borrador' && (
                            <button
                              onClick={() => generarRipsAjuste(n.id)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-amber-600 border border-amber-100 hover:bg-amber-50 transition-all"
                              title="Generar RIPS de ajuste"
                            >
                              <FileJson className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Generar RIPS</span>
                            </button>
                          )}
                          {n.rips_ajuste_json && (
                            <button
                              onClick={() => {
                                const blob = new Blob([JSON.stringify(n.rips_ajuste_json, null, 2)], { type: 'application/json' })
                                const url = URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = url
                                a.download = `RIPS_AJUSTE_${n.factura_numero || n.id}.json`
                                a.click()
                                URL.revokeObjectURL(url)
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-halu-600 border border-halu-100 hover:bg-halu-50 transition-all"
                              title="Descargar RIPS de ajuste"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Descargar</span>
                            </button>
                          )}
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal visor RIPS */}
      {ripsFactura && (
        <ModalRIPS
          factura={ripsFactura}
          json={ripsJson}
          cargando={cargandoRips}
          onClose={() => { setRipsFactura(null); setRipsJson(null) }}
        />
      )}

      {/* Modal nueva nota de ajuste */}
      {showNuevoAjuste && (
        <ModalNuevoAjuste
          facturas={facturas}
          onClose={() => setShowNuevoAjuste(false)}
          onSaved={cargar}
        />
      )}
    </div>
  )
}
