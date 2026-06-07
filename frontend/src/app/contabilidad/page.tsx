'use client'
import { useState, useEffect } from 'react'
import api, { mensajeError } from '@/lib/api'
import { PageHeader, Button, Badge, EmptyState, Card } from '@/components/ui'
import {
  Plus, X, ChevronDown, ChevronRight, CheckCircle,
  TrendingUp, TrendingDown, Calculator,
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const COP = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0)

const INPUT = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/20 bg-white'

const TABS = [
  { id: 'cuentas', label: 'Plan de cuentas' },
  { id: 'asientos', label: 'Asientos contables' },
  { id: 'presupuesto', label: 'Presupuesto' },
] as const
type Tab = typeof TABS[number]['id']

interface CuentaContable {
  id: string
  codigo: string
  nombre: string
  tipo: string
  tipo_display: string
  naturaleza: string
  naturaleza_display: string
  cuenta_padre?: string
}

interface AsientoContable {
  id: string
  numero: string
  tipo: string
  tipo_display: string
  fecha: string
  descripcion: string
  referencia: string
  estado: string
  estado_display: string
  total_debito?: number
  total_credito?: number
  lineas?: LineaAsiento[]
}

interface LineaAsiento {
  id: string
  cuenta_codigo: string
  cuenta_nombre: string
  descripcion: string
  debito: number
  credito: number
}

interface Presupuesto {
  id: string
  ano: number
  nombre: string
  total_ingresos_presupuestados: number
  total_gastos_presupuestados: number
  estado: string
  estado_display: string
}

const TIPO_CUENTA_GROUPS = ['Activo', 'Pasivo', 'Patrimonio', 'Ingreso', 'Gasto', 'Costo']
const TIPO_COLOR: Record<string, string> = {
  Activo: 'bg-emerald-100 text-emerald-700',
  Pasivo: 'bg-red-100 text-red-700',
  Patrimonio: 'bg-purple-100 text-purple-700',
  Ingreso: 'bg-blue-100 text-blue-700',
  Gasto: 'bg-amber-100 text-amber-700',
  Costo: 'bg-orange-100 text-orange-700',
}

function asientoEstadoBadge(e: string): 'success' | 'warning' | 'default' {
  if (e === 'aprobado') return 'success'
  if (e === 'borrador') return 'warning'
  return 'default'
}

function presupuestoEstadoBadge(e: string): 'success' | 'warning' | 'default' {
  if (e === 'aprobado') return 'success'
  if (e === 'borrador') return 'warning'
  return 'default'
}

export default function ContabilidadPage() {
  const [tab, setTab] = useState<Tab>('cuentas')
  const [cuentas, setCuentas] = useState<CuentaContable[]>([])
  const [asientos, setAsientos] = useState<AsientoContable[]>([])
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
  const [loading, setLoading] = useState(true)
  const [showNuevaCuenta, setShowNuevaCuenta] = useState(false)
  const [showNuevoAsiento, setShowNuevoAsiento] = useState(false)
  const [showNuevoPresupuesto, setShowNuevoPresupuesto] = useState(false)
  const [expandedAsiento, setExpandedAsiento] = useState<string | null>(null)

  const cargar = async () => {
    setLoading(true)
    try {
      const [c, a, p] = await Promise.allSettled([
        api.get('/api/contabilidad/cuentas/'),
        api.get('/api/contabilidad/asientos/'),
        api.get('/api/contabilidad/presupuestos/'),
      ])
      if (c.status === 'fulfilled') setCuentas(c.value.data.results ?? c.value.data)
      if (a.status === 'fulfilled') setAsientos(a.value.data.results ?? a.value.data)
      if (p.status === 'fulfilled') setPresupuestos(p.value.data.results ?? p.value.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const aprobarAsiento = async (id: string) => {
    try {
      await api.post(`/api/contabilidad/asientos/${id}/aprobar/`, {})
      toast.success('Asiento aprobado')
      cargar()
    } catch (e) { toast.error(mensajeError(e)) }
  }

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="Contabilidad"
        description="Plan de cuentas, asientos contables y presupuesto"
        action={
          tab === 'cuentas' ? <Button onClick={() => setShowNuevaCuenta(true)}><Plus className="w-4 h-4" /> Nueva cuenta</Button>
          : tab === 'asientos' ? <Button onClick={() => setShowNuevoAsiento(true)}><Plus className="w-4 h-4" /> Nuevo asiento</Button>
          : <Button onClick={() => setShowNuevoPresupuesto(true)}><Plus className="w-4 h-4" /> Nuevo presupuesto</Button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.id ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* PLAN DE CUENTAS */}
      {tab === 'cuentas' && (
        <div className="space-y-4">
          {loading ? Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-xl border animate-pulse" />
          )) : cuentas.length === 0 ? (
            <EmptyState title="Sin cuentas" description="No hay cuentas contables registradas" />
          ) : TIPO_CUENTA_GROUPS.map(tipo => {
            const grupo = cuentas.filter(c => (c.tipo_display || c.tipo)?.toLowerCase() === tipo.toLowerCase()
              || c.tipo === tipo.toLowerCase())
            if (grupo.length === 0) return null
            return (
              <div key={tipo}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded', TIPO_COLOR[tipo] || 'bg-slate-100 text-slate-600')}>
                    {tipo}
                  </span>
                  <span className="text-xs text-slate-400">{grupo.length} cuenta(s)</span>
                </div>
                <div className="space-y-1">
                  {grupo.map(c => (
                    <div key={c.id} className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-center gap-4">
                      <span className="font-mono text-sm text-slate-700 font-medium w-24 flex-shrink-0">{c.codigo}</span>
                      <span className="flex-1 text-sm text-slate-800">{c.nombre}</span>
                      <span className="text-xs text-slate-400">{c.naturaleza_display || c.naturaleza}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ASIENTOS */}
      {tab === 'asientos' && (
        <div className="space-y-2">
          {loading ? Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-white rounded-xl border animate-pulse" />
          )) : asientos.length === 0 ? (
            <EmptyState title="Sin asientos" description="No hay asientos contables registrados" />
          ) : asientos.map(a => (
            <div key={a.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <div className="p-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 text-sm">#{a.numero}</span>
                    <Badge variant={asientoEstadoBadge(a.estado)}>{a.estado_display || a.estado}</Badge>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{a.tipo_display || a.tipo}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">{a.descripcion}</p>
                  <div className="flex gap-3 text-xs text-slate-400">
                    <span>{a.fecha}</span>
                    {a.referencia && <span>Ref: {a.referencia}</span>}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {a.estado === 'borrador' && (
                    <Button variant="secondary" onClick={() => aprobarAsiento(a.id)} className="text-xs py-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Aprobar
                    </Button>
                  )}
                  {a.lineas && a.lineas.length > 0 && (
                    <button
                      onClick={() => setExpandedAsiento(expandedAsiento === a.id ? null : a.id)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-400"
                    >
                      {expandedAsiento === a.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
              {expandedAsiento === a.id && a.lineas && (
                <div className="border-t border-slate-100 px-4 pb-3">
                  <table className="w-full text-xs mt-2">
                    <thead>
                      <tr className="text-slate-500">
                        <th className="text-left pb-1">Cuenta</th>
                        <th className="text-right pb-1 w-28">Débito</th>
                        <th className="text-right pb-1 w-28">Crédito</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.lineas.map(l => (
                        <tr key={l.id} className="border-t border-slate-50">
                          <td className="py-1">{l.cuenta_codigo} – {l.cuenta_nombre}</td>
                          <td className="text-right py-1 text-emerald-700">{l.debito > 0 ? COP(l.debito) : '—'}</td>
                          <td className="text-right py-1 text-red-700">{l.credito > 0 ? COP(l.credito) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-slate-200 font-semibold">
                      <tr>
                        <td className="pt-1 text-slate-600">Total</td>
                        <td className="text-right pt-1 text-emerald-700">{COP(a.lineas.reduce((s, l) => s + l.debito, 0))}</td>
                        <td className="text-right pt-1 text-red-700">{COP(a.lineas.reduce((s, l) => s + l.credito, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* PRESUPUESTO */}
      {tab === 'presupuesto' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 bg-white rounded-xl border animate-pulse" />
          )) : presupuestos.length === 0 ? (
            <div className="col-span-3"><EmptyState title="Sin presupuestos" description="No hay presupuestos registrados" /></div>
          ) : presupuestos.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-slate-100 p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="font-bold text-slate-900 text-lg">{p.ano}</p>
                  <p className="text-sm text-slate-600">{p.nombre}</p>
                </div>
                <Badge variant={presupuestoEstadoBadge(p.estado)}>{p.estado_display || p.estado}</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span className="text-xs text-slate-500 flex-1">Ingresos presupuestados</span>
                  <span className="text-xs font-semibold text-emerald-700">{COP(p.total_ingresos_presupuestados)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                  <span className="text-xs text-slate-500 flex-1">Gastos presupuestados</span>
                  <span className="text-xs font-semibold text-red-700">{COP(p.total_gastos_presupuestados)}</span>
                </div>
                <div className="border-t border-slate-100 pt-2 flex items-center gap-2">
                  <Calculator className="w-3.5 h-3.5 text-halu-600 flex-shrink-0" />
                  <span className="text-xs text-slate-500 flex-1">Resultado estimado</span>
                  <span className={clsx('text-xs font-bold',
                    p.total_ingresos_presupuestados >= p.total_gastos_presupuestados ? 'text-emerald-700' : 'text-red-700'
                  )}>
                    {COP(p.total_ingresos_presupuestados - p.total_gastos_presupuestados)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNuevaCuenta && (
        <NuevaCuentaModal
          cuentas={cuentas}
          onClose={() => setShowNuevaCuenta(false)}
          onSaved={() => { setShowNuevaCuenta(false); cargar() }}
        />
      )}
      {showNuevoAsiento && (
        <NuevoAsientoModal
          onClose={() => setShowNuevoAsiento(false)}
          onSaved={() => { setShowNuevoAsiento(false); cargar() }}
        />
      )}
      {showNuevoPresupuesto && (
        <NuevoPresupuestoModal
          onClose={() => setShowNuevoPresupuesto(false)}
          onSaved={() => { setShowNuevoPresupuesto(false); cargar() }}
        />
      )}
    </div>
  )
}

function NuevaCuentaModal({ cuentas, onClose, onSaved }: {
  cuentas: CuentaContable[]; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    codigo: '', nombre: '', tipo: 'activo', naturaleza: 'debito', cuenta_padre: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const guardar = async () => {
    if (!form.codigo || !form.nombre) { toast.error('Código y nombre son requeridos'); return }
    setSaving(true)
    try {
      await api.post('/api/contabilidad/cuentas/', {
        ...form,
        cuenta_padre: form.cuenta_padre || null,
      })
      toast.success('Cuenta creada')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-5 border-b flex items-center justify-between">
          <div><h2 className="font-bold text-slate-900">Nueva cuenta contable</h2></div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Código *</label>
              <input value={form.codigo} onChange={set('codigo')} className={INPUT} placeholder="Ej. 1105" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 block mb-1">Nombre *</label>
              <input value={form.nombre} onChange={set('nombre')} className={INPUT} placeholder="Ej. Caja general" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Tipo</label>
              <select value={form.tipo} onChange={set('tipo')} className={INPUT}>
                <option value="activo">Activo</option>
                <option value="pasivo">Pasivo</option>
                <option value="patrimonio">Patrimonio</option>
                <option value="ingreso">Ingreso</option>
                <option value="gasto">Gasto</option>
                <option value="costo">Costo</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Naturaleza</label>
              <select value={form.naturaleza} onChange={set('naturaleza')} className={INPUT}>
                <option value="debito">Débito</option>
                <option value="credito">Crédito</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Cuenta padre (opcional)</label>
            <select value={form.cuenta_padre} onChange={set('cuenta_padre')} className={INPUT}>
              <option value="">Sin cuenta padre</option>
              {cuentas.map(c => (
                <option key={c.id} value={c.id}>{c.codigo} – {c.nombre}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Crear cuenta</Button>
        </div>
      </div>
    </div>
  )
}

function NuevoAsientoModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    tipo: 'diario', fecha: new Date().toISOString().slice(0, 10), descripcion: '', referencia: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const guardar = async () => {
    if (!form.descripcion) { toast.error('La descripción es requerida'); return }
    setSaving(true)
    try {
      await api.post('/api/contabilidad/asientos/', form)
      toast.success('Asiento creado')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-5 border-b flex items-center justify-between">
          <div><h2 className="font-bold text-slate-900">Nuevo asiento contable</h2></div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Tipo</label>
              <select value={form.tipo} onChange={set('tipo')} className={INPUT}>
                <option value="diario">Diario</option>
                <option value="apertura">Apertura</option>
                <option value="cierre">Cierre</option>
                <option value="ajuste">Ajuste</option>
                <option value="reclasificacion">Reclasificación</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Fecha *</label>
              <input type="date" value={form.fecha} onChange={set('fecha')} className={INPUT} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 block mb-1">Descripción *</label>
              <input value={form.descripcion} onChange={set('descripcion')} className={INPUT} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 block mb-1">Referencia</label>
              <input value={form.referencia} onChange={set('referencia')} className={INPUT} placeholder="Ej. Factura FV-001" />
            </div>
          </div>
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Crear asiento</Button>
        </div>
      </div>
    </div>
  )
}

function NuevoPresupuestoModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    ano: new Date().getFullYear().toString(),
    nombre: '', total_ingresos_presupuestados: '', total_gastos_presupuestados: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const guardar = async () => {
    if (!form.nombre || !form.ano) { toast.error('Año y nombre son requeridos'); return }
    setSaving(true)
    try {
      await api.post('/api/contabilidad/presupuestos/', {
        ...form,
        ano: Number(form.ano),
        total_ingresos_presupuestados: Number(form.total_ingresos_presupuestados || 0),
        total_gastos_presupuestados: Number(form.total_gastos_presupuestados || 0),
      })
      toast.success('Presupuesto creado')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-5 border-b flex items-center justify-between">
          <div><h2 className="font-bold text-slate-900">Nuevo presupuesto</h2></div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Año *</label>
              <input type="number" value={form.ano} onChange={set('ano')} className={INPUT} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 block mb-1">Nombre *</label>
              <input value={form.nombre} onChange={set('nombre')} className={INPUT} placeholder="Ej. Presupuesto Anual 2026" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Total ingresos (COP)</label>
              <input type="number" min="0" value={form.total_ingresos_presupuestados} onChange={set('total_ingresos_presupuestados')} className={INPUT} placeholder="0" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Total gastos (COP)</label>
              <input type="number" min="0" value={form.total_gastos_presupuestados} onChange={set('total_gastos_presupuestados')} className={INPUT} placeholder="0" />
            </div>
          </div>
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Crear presupuesto</Button>
        </div>
      </div>
    </div>
  )
}
