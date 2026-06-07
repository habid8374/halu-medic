'use client'
import { useState, useEffect } from 'react'
import api, { mensajeError } from '@/lib/api'
import { PageHeader, Button, Badge, EmptyState, Card } from '@/components/ui'
import { Plus, X, Wrench, Monitor, AlertTriangle, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const INPUT = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/20 bg-white'

interface EquipoBiomedico {
  id: string
  codigo_inventario: string
  nombre: string
  marca: string
  modelo: string
  serial: string
  tipo: string
  servicio: string
  ubicacion: string
  estado: string
  estado_display: string
  proximo_mantenimiento: string
  frecuencia_mant_preventivo_meses: number
}

interface OrdenMantenimiento {
  id: string
  numero_orden: string
  equipo_nombre: string
  tipo: string
  tipo_display: string
  estado: string
  estado_display: string
  descripcion_falla: string
  tecnico: string
  empresa_externa: string
  costo: number
  fecha_apertura: string
}

function estadoEquipoBadge(e: string): 'success' | 'warning' | 'danger' | 'default' {
  if (e === 'operativo') return 'success'
  if (e === 'mantenimiento') return 'warning'
  if (e === 'fuera_servicio') return 'danger'
  return 'default'
}

function estadoOTBadge(e: string): 'success' | 'warning' | 'danger' | 'default' {
  if (e === 'cerrada') return 'success'
  if (e === 'abierta' || e === 'en_proceso') return 'warning'
  return 'default'
}

function tipoOTBadge(t: string): 'info' | 'warning' | 'danger' | 'default' {
  if (t === 'preventivo') return 'info'
  if (t === 'correctivo') return 'danger'
  if (t === 'calibracion') return 'warning'
  return 'default'
}

export default function MantenimientoPage() {
  const [seccion, setSeccion] = useState<'equipos' | 'ordenes'>('equipos')
  const [equipos, setEquipos] = useState<EquipoBiomedico[]>([])
  const [ordenes, setOrdenes] = useState<OrdenMantenimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [showNuevoEquipo, setShowNuevoEquipo] = useState(false)
  const [showNuevaOT, setShowNuevaOT] = useState(false)
  const [completando, setCompletando] = useState<OrdenMantenimiento | null>(null)

  const cargar = async () => {
    setLoading(true)
    try {
      const [e, o] = await Promise.allSettled([
        api.get('/api/operaciones/equipos-biomedicos/'),
        api.get('/api/operaciones/mantenimiento/'),
      ])
      if (e.status === 'fulfilled') setEquipos(e.value.data.results ?? e.value.data)
      if (o.status === 'fulfilled') setOrdenes(o.value.data.results ?? o.value.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const hoy = new Date().toISOString().slice(0, 10)
  const vencidos = equipos.filter(eq => eq.proximo_mantenimiento && eq.proximo_mantenimiento < hoy)

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="Mantenimiento Biomédico"
        description="Inventario de equipos y órdenes de trabajo de mantenimiento"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowNuevoEquipo(true)}>
              <Plus className="w-4 h-4" /> Nuevo equipo
            </Button>
            <Button onClick={() => setShowNuevaOT(true)}>
              <Plus className="w-4 h-4" /> Nueva OT
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5 w-fit">
        {[
          { id: 'equipos', label: 'Inventario equipos' },
          { id: 'ordenes', label: 'Órdenes de mantenimiento' },
        ].map(s => (
          <button key={s.id} onClick={() => setSeccion(s.id as typeof seccion)}
            className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-all',
              seccion === s.id ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
            )}>
            {s.label}
          </button>
        ))}
      </div>

      {/* EQUIPOS */}
      {seccion === 'equipos' && (
        <>
          {vencidos.length > 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {vencidos.length} equipo(s) con mantenimiento vencido
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-36 bg-white rounded-xl border animate-pulse" />
            )) : equipos.length === 0 ? (
              <div className="col-span-3"><EmptyState title="Sin equipos" description="No hay equipos biomédicos registrados" /></div>
            ) : equipos.map(eq => {
              const vencido = eq.proximo_mantenimiento && eq.proximo_mantenimiento < hoy
              return (
                <div key={eq.id} className="bg-white rounded-xl border border-slate-100 p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm">{eq.nombre}</p>
                      <p className="text-xs text-slate-500">{eq.marca} {eq.modelo}</p>
                    </div>
                    <Badge variant={estadoEquipoBadge(eq.estado)}>{eq.estado_display || eq.estado}</Badge>
                  </div>
                  <div className="space-y-1 text-xs text-slate-500">
                    {eq.servicio && <p>Servicio: {eq.servicio}</p>}
                    {eq.serial && <p>Serial: {eq.serial}</p>}
                    {eq.proximo_mantenimiento && (
                      <p className={clsx('font-medium', vencido ? 'text-red-600' : 'text-slate-600')}>
                        Próx. mantenimiento: {new Date(eq.proximo_mantenimiento).toLocaleDateString('es-CO')}
                        {vencido && ' ⚠️ Vencido'}
                      </p>
                    )}
                  </div>
                  <div className="mt-3">
                    <Button variant="secondary" onClick={() => {}} className="w-full text-xs py-1.5">
                      <Wrench className="w-3.5 h-3.5" /> Solicitar OT
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ÓRDENES */}
      {seccion === 'ordenes' && (
        <div className="space-y-2">
          {loading ? Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-xl border animate-pulse" />
          )) : ordenes.length === 0 ? (
            <EmptyState title="Sin órdenes" description="No hay órdenes de mantenimiento" />
          ) : ordenes.map(ot => (
            <div key={ot.id} className="bg-white rounded-xl border border-slate-100 p-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-900 text-sm">OT #{ot.numero_orden}</span>
                  <Badge variant={tipoOTBadge(ot.tipo)}>{ot.tipo_display || ot.tipo}</Badge>
                  <Badge variant={estadoOTBadge(ot.estado)}>{ot.estado_display || ot.estado}</Badge>
                </div>
                <p className="text-xs text-slate-600 mt-0.5 font-medium">{ot.equipo_nombre}</p>
                {ot.descripcion_falla && <p className="text-xs text-slate-500 mt-0.5 truncate">{ot.descripcion_falla}</p>}
                <p className="text-xs text-slate-400">
                  {ot.tecnico || ot.empresa_externa || '—'}
                  {ot.costo > 0 && ` · $${ot.costo.toLocaleString('es-CO')}`}
                </p>
              </div>
              {(ot.estado === 'abierta' || ot.estado === 'en_proceso') && (
                <Button variant="secondary" onClick={() => setCompletando(ot)} className="text-xs py-1 flex-shrink-0">
                  <CheckCircle className="w-3.5 h-3.5" /> Completar
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {showNuevoEquipo && (
        <NuevoEquipoModal
          onClose={() => setShowNuevoEquipo(false)}
          onSaved={() => { setShowNuevoEquipo(false); cargar() }}
        />
      )}
      {showNuevaOT && (
        <NuevaOTModal
          equipos={equipos}
          onClose={() => setShowNuevaOT(false)}
          onSaved={() => { setShowNuevaOT(false); cargar() }}
        />
      )}
      {completando && (
        <CompletarOTModal
          ot={completando}
          onClose={() => setCompletando(null)}
          onSaved={() => { setCompletando(null); cargar() }}
        />
      )}
    </div>
  )
}

function NuevoEquipoModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    codigo_inventario: '', nombre: '', marca: '', modelo: '', serial: '',
    tipo: 'diagnostico', servicio: '', ubicacion: '', frecuencia_mant_preventivo_meses: '6',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const guardar = async () => {
    if (!form.nombre || !form.codigo_inventario) {
      toast.error('Código y nombre son requeridos'); return
    }
    setSaving(true)
    try {
      await api.post('/api/operaciones/equipos-biomedicos/', {
        ...form,
        frecuencia_mant_preventivo_meses: Number(form.frecuencia_mant_preventivo_meses),
      })
      toast.success('Equipo registrado')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <div><h2 className="font-bold text-slate-900">Nuevo equipo biomédico</h2></div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Código inventario *</label>
            <input value={form.codigo_inventario} onChange={set('codigo_inventario')} className={INPUT} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Nombre *</label>
            <input value={form.nombre} onChange={set('nombre')} className={INPUT} placeholder="Ej. Monitor multiparámetros" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Marca</label>
            <input value={form.marca} onChange={set('marca')} className={INPUT} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Modelo</label>
            <input value={form.modelo} onChange={set('modelo')} className={INPUT} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Serial</label>
            <input value={form.serial} onChange={set('serial')} className={INPUT} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Tipo</label>
            <select value={form.tipo} onChange={set('tipo')} className={INPUT}>
              <option value="diagnostico">Diagnóstico</option>
              <option value="terapeutico">Terapéutico</option>
              <option value="laboratorio">Laboratorio</option>
              <option value="rehabilitacion">Rehabilitación</option>
              <option value="infraestructura">Infraestructura</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Servicio</label>
            <input value={form.servicio} onChange={set('servicio')} className={INPUT} placeholder="Ej. UCI" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Ubicación</label>
            <input value={form.ubicacion} onChange={set('ubicacion')} className={INPUT} />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-slate-600 block mb-1">Frecuencia mantenimiento (meses)</label>
            <input type="number" min="1" value={form.frecuencia_mant_preventivo_meses} onChange={set('frecuencia_mant_preventivo_meses')} className={INPUT} />
          </div>
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Registrar equipo</Button>
        </div>
      </div>
    </div>
  )
}

function NuevaOTModal({ equipos, onClose, onSaved }: {
  equipos: EquipoBiomedico[]; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    equipo: '', tipo: 'correctivo', descripcion_falla: '', tecnico: '', empresa_externa: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const guardar = async () => {
    if (!form.equipo) { toast.error('Seleccione un equipo'); return }
    setSaving(true)
    try {
      await api.post('/api/operaciones/mantenimiento/', form)
      toast.success('Orden de trabajo creada')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <div><h2 className="font-bold text-slate-900">Nueva orden de trabajo</h2></div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Equipo *</label>
            <select value={form.equipo} onChange={set('equipo')} className={INPUT}>
              <option value="">Seleccionar equipo...</option>
              {equipos.map(eq => (
                <option key={eq.id} value={eq.id}>{eq.nombre} — {eq.marca} {eq.serial && `(${eq.serial})`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Tipo</label>
            <select value={form.tipo} onChange={set('tipo')} className={INPUT}>
              <option value="correctivo">Correctivo</option>
              <option value="preventivo">Preventivo</option>
              <option value="calibracion">Calibración</option>
              <option value="instalacion">Instalación</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Descripción de la falla / motivo</label>
            <textarea value={form.descripcion_falla} onChange={set('descripcion_falla')}
              className={INPUT + ' h-20 resize-none'} placeholder="Describa el problema o motivo del mantenimiento" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Técnico responsable</label>
              <input value={form.tecnico} onChange={set('tecnico')} className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Empresa externa</label>
              <input value={form.empresa_externa} onChange={set('empresa_externa')} className={INPUT} placeholder="Si aplica" />
            </div>
          </div>
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Crear OT</Button>
        </div>
      </div>
    </div>
  )
}

function CompletarOTModal({ ot, onClose, onSaved }: {
  ot: OrdenMantenimiento; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    actividades_realizadas: '', repuestos_utilizados: '', costo: '', equipo_operativo_post: true,
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const guardar = async () => {
    setSaving(true)
    try {
      await api.patch(`/api/operaciones/mantenimiento/${ot.id}/`, {
        ...form,
        costo: form.costo ? Number(form.costo) : 0,
        estado: 'cerrada',
      })
      toast.success('OT completada')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <div><h2 className="font-bold text-slate-900">Completar OT #{ot.numero_orden}</h2></div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Actividades realizadas</label>
            <textarea value={form.actividades_realizadas} onChange={set('actividades_realizadas')}
              className={INPUT + ' h-24 resize-none'} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Repuestos utilizados</label>
            <textarea value={form.repuestos_utilizados} onChange={set('repuestos_utilizados')}
              className={INPUT + ' h-16 resize-none'} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Costo (COP)</label>
            <input type="number" min="0" value={form.costo} onChange={set('costo')} className={INPUT} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={form.equipo_operativo_post}
              onChange={e => setForm(f => ({ ...f, equipo_operativo_post: e.target.checked }))}
              className="rounded" />
            Equipo operativo después del mantenimiento
          </label>
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Cerrar OT</Button>
        </div>
      </div>
    </div>
  )
}
