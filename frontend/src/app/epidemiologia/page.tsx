'use client'
import { useState, useEffect } from 'react'
import api, { mensajeError } from '@/lib/api'
import { PageHeader, Button, Badge, EmptyState, Card } from '@/components/ui'
import { Plus, X, Activity, AlertTriangle, Bell, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const INPUT = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/20 bg-white'

interface NotificacionSIVIGILA {
  id: string
  paciente_nombre: string
  evento: string
  evento_display: string
  clasificacion: string
  clasificacion_display: string
  estado: string
  estado_display: string
  fecha_consulta: string
  fecha_inicio_sintomas: string
  hospitalizado: boolean
  fallecio: boolean
  municipio_residencia: string
}

interface Brote {
  id: string
  evento: string
  numero_casos: number
  estado: string
  estado_display: string
  medidas_control: string
  fecha_inicio: string
}

const EVENTOS_SIVIGILA = [
  { value: 'covid19', label: 'COVID-19' },
  { value: 'dengue', label: 'Dengue' },
  { value: 'malaria', label: 'Malaria' },
  { value: 'tb_pulmonar', label: 'Tuberculosis pulmonar' },
  { value: 'vih', label: 'VIH/SIDA' },
  { value: 'hepatitis_a', label: 'Hepatitis A' },
  { value: 'hepatitis_b', label: 'Hepatitis B' },
  { value: 'hepatitis_c', label: 'Hepatitis C' },
  { value: 'leptospirosis', label: 'Leptospirosis' },
  { value: 'leishmaniasis', label: 'Leishmaniasis' },
  { value: 'chagas', label: 'Enfermedad de Chagas' },
  { value: 'rabia', label: 'Rabia' },
  { value: 'varicela', label: 'Varicela' },
  { value: 'sarampion', label: 'Sarampión' },
  { value: 'rubeola', label: 'Rubéola' },
  { value: 'parotiditis', label: 'Parotiditis' },
  { value: 'meningitis', label: 'Meningitis' },
  { value: 'intoxicacion_alimentos', label: 'Intoxicación por alimentos' },
  { value: 'accidente_ofidico', label: 'Accidente ofídico' },
  { value: 'intento_suicidio', label: 'Intento de suicidio' },
]

function clasificacionBadge(c: string): 'warning' | 'danger' | 'default' {
  if (c === 'sospechosa') return 'warning'
  if (c === 'confirmada') return 'danger'
  return 'default'
}

function estadoBadge(e: string): 'success' | 'warning' | 'default' {
  if (e === 'notificada') return 'success'
  if (e === 'pendiente') return 'warning'
  return 'default'
}

function getSemanEpidemiologica(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const diff = now.getTime() - start.getTime()
  return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000))
}

export default function EpidemiologiaPage() {
  const [notificaciones, setNotificaciones] = useState<NotificacionSIVIGILA[]>([])
  const [brotes, setBrotes] = useState<Brote[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [tab, setTab] = useState<'notificaciones' | 'brotes'>('notificaciones')

  const cargar = async () => {
    setLoading(true)
    try {
      const [n, b] = await Promise.allSettled([
        api.get('/api/epidemiologia/notificaciones/'),
        api.get('/api/epidemiologia/brotes/'),
      ])
      if (n.status === 'fulfilled') setNotificaciones(n.value.data.results ?? n.value.data)
      if (b.status === 'fulfilled') setBrotes(b.value.data.results ?? b.value.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const notificarSIVIGILA = async (id: string) => {
    try {
      await api.post(`/api/epidemiologia/notificaciones/${id}/notificar/`, {})
      toast.success('Notificado a SIVIGILA')
      cargar()
    } catch (e) { toast.error(mensajeError(e)) }
  }

  const semanaActual = getSemanEpidemiologica()
  const inicioSemana = new Date()
  inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay())
  const inicioSemanaStr = inicioSemana.toISOString().slice(0, 10)

  const casosEstaSemana = notificaciones.filter(n => n.fecha_consulta >= inicioSemanaStr).length
  const notificadosSIVIGILA = notificaciones.filter(n => n.estado === 'notificada').length
  const brotesActivos = brotes.filter(b => b.estado === 'activo').length

  // Conteo por evento para el "gráfico"
  const conteoEventos = notificaciones.reduce<Record<string, number>>((acc, n) => {
    const label = n.evento_display || n.evento
    acc[label] = (acc[label] || 0) + 1
    return acc
  }, {})
  const maxConteo = Math.max(...Object.values(conteoEventos), 1)

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="Epidemiología / SIVIGILA"
        description="Notificación obligatoria de eventos en salud pública"
        action={
          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4" /> Nueva notificación
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {loading ? Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-white rounded-xl border animate-pulse" />
        )) : (
          <>
            <Card className="flex items-center gap-3">
              <div className="w-9 h-9 bg-halu-100 rounded-xl flex items-center justify-center"><Activity className="w-4 h-4 text-halu-600" /></div>
              <div><p className="text-2xl font-bold text-slate-900">{casosEstaSemana}</p><p className="text-xs text-slate-500">Casos esta semana</p></div>
            </Card>
            <Card className="flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center"><Send className="w-4 h-4 text-emerald-600" /></div>
              <div><p className="text-2xl font-bold text-emerald-700">{notificadosSIVIGILA}</p><p className="text-xs text-slate-500">Notificados SIVIGILA</p></div>
            </Card>
            <Card className="flex items-center gap-3">
              <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-red-600" /></div>
              <div><p className="text-2xl font-bold text-red-700">{brotesActivos}</p><p className="text-xs text-slate-500">Brotes activos</p></div>
            </Card>
            <Card className="flex items-center gap-3">
              <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center"><Bell className="w-4 h-4 text-purple-600" /></div>
              <div><p className="text-2xl font-bold text-purple-700">SE {semanaActual}</p><p className="text-xs text-slate-500">Semana epidemiológica</p></div>
            </Card>
          </>
        )}
      </div>

      {/* Resumen semanal por evento */}
      {!loading && Object.keys(conteoEventos).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 p-4 mb-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Distribución por evento</h3>
          <div className="space-y-2">
            {Object.entries(conteoEventos)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([evento, count]) => (
                <div key={evento} className="flex items-center gap-3">
                  <span className="text-xs text-slate-600 w-40 truncate flex-shrink-0">{evento}</span>
                  <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-halu-500 rounded-full transition-all"
                      style={{ width: `${(count / maxConteo) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 w-6 text-right">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5 w-fit">
        {[
          { id: 'notificaciones', label: 'Notificaciones' },
          { id: 'brotes', label: 'Brotes' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
            className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.id ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Notificaciones */}
      {tab === 'notificaciones' && (
        <div className="space-y-2">
          {loading ? Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-xl border animate-pulse" />
          )) : notificaciones.length === 0 ? (
            <EmptyState title="Sin notificaciones" description="No hay notificaciones SIVIGILA registradas" />
          ) : notificaciones.map(n => (
            <div key={n.id} className="bg-white rounded-xl border border-slate-100 p-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-900 text-sm">{n.paciente_nombre}</span>
                  <Badge variant={clasificacionBadge(n.clasificacion)}>{n.clasificacion_display || n.clasificacion}</Badge>
                  <Badge variant={estadoBadge(n.estado)}>{n.estado_display || n.estado}</Badge>
                </div>
                <p className="text-xs font-medium text-halu-700 mt-0.5">{n.evento_display || n.evento}</p>
                <div className="flex gap-3 mt-0.5 text-xs text-slate-400">
                  <span>Consulta: {n.fecha_consulta}</span>
                  {n.hospitalizado && <span className="text-amber-600">Hospitalizado</span>}
                  {n.fallecio && <span className="text-red-600">Fallecido</span>}
                  {n.municipio_residencia && <span>{n.municipio_residencia}</span>}
                </div>
              </div>
              {n.estado !== 'notificada' && (
                <Button variant="secondary" onClick={() => notificarSIVIGILA(n.id)} className="text-xs py-1 flex-shrink-0">
                  <Send className="w-3.5 h-3.5" /> Notificar
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Brotes */}
      {tab === 'brotes' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {loading ? Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-xl border animate-pulse" />
          )) : brotes.length === 0 ? (
            <div className="col-span-3"><EmptyState title="Sin brotes" description="No hay brotes activos registrados" /></div>
          ) : brotes.map(b => (
            <div key={b.id} className={clsx('bg-white rounded-xl border p-4',
              b.estado === 'activo' ? 'border-red-200 bg-red-50/20' : 'border-slate-100'
            )}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-semibold text-slate-900 text-sm">{b.evento}</p>
                <Badge variant={b.estado === 'activo' ? 'danger' : 'success'}>{b.estado_display || b.estado}</Badge>
              </div>
              <p className="text-2xl font-bold text-slate-800 mb-1">{b.numero_casos} <span className="text-sm font-normal text-slate-500">casos</span></p>
              {b.medidas_control && (
                <p className="text-xs text-slate-500 line-clamp-2">{b.medidas_control}</p>
              )}
              {b.fecha_inicio && (
                <p className="text-xs text-slate-400 mt-1">Desde: {new Date(b.fecha_inicio).toLocaleDateString('es-CO')}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <NuevaNotificacionModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); cargar() }}
        />
      )}
    </div>
  )
}

function NuevaNotificacionModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    paciente: '', evento: '', clasificacion: 'sospechosa',
    fecha_consulta: new Date().toISOString().slice(0, 10),
    fecha_inicio_sintomas: '', hospitalizado: false, fallecio: false,
    municipio_residencia: '', observaciones: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))
  const setCheck = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.checked }))

  const guardar = async () => {
    if (!form.paciente || !form.evento) { toast.error('Paciente y evento son requeridos'); return }
    setSaving(true)
    try {
      await api.post('/api/epidemiologia/notificaciones/', form)
      toast.success('Notificación creada')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <div><h2 className="font-bold text-slate-900">Nueva notificación SIVIGILA</h2></div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">ID del paciente *</label>
            <input value={form.paciente} onChange={set('paciente')} className={INPUT} placeholder="UUID del paciente" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 block mb-1">Evento SIVIGILA *</label>
              <select value={form.evento} onChange={set('evento')} className={INPUT}>
                <option value="">Seleccionar evento...</option>
                {EVENTOS_SIVIGILA.map(ev => (
                  <option key={ev.value} value={ev.value}>{ev.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Clasificación</label>
              <select value={form.clasificacion} onChange={set('clasificacion')} className={INPUT}>
                <option value="sospechosa">Sospechosa</option>
                <option value="probable">Probable</option>
                <option value="confirmada">Confirmada</option>
                <option value="descartada">Descartada</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Fecha consulta *</label>
              <input type="date" value={form.fecha_consulta} onChange={set('fecha_consulta')} className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Inicio síntomas</label>
              <input type="date" value={form.fecha_inicio_sintomas} onChange={set('fecha_inicio_sintomas')} className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Municipio residencia</label>
              <input value={form.municipio_residencia} onChange={set('municipio_residencia')} className={INPUT} />
            </div>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={form.hospitalizado} onChange={setCheck('hospitalizado')} className="rounded" />
              Hospitalizado
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={form.fallecio} onChange={setCheck('fallecio')} className="rounded" />
              Falleció
            </label>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Observaciones</label>
            <textarea value={form.observaciones} onChange={set('observaciones')}
              className={INPUT + ' h-20 resize-none'} />
          </div>
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Registrar notificación</Button>
        </div>
      </div>
    </div>
  )
}
