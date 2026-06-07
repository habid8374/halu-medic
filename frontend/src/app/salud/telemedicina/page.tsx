'use client'
import { useState, useEffect } from 'react'
import api, { mensajeError } from '@/lib/api'
import { PageHeader, Button, Badge, EmptyState, Card, BuscadorPacienteIngreso } from '@/components/ui'
import { Plus, Video, ExternalLink, CheckCircle2, Clock, X, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Teleconsulta {
  id: string
  paciente_nombre: string
  medico_nombre: string
  tipo: string
  tipo_display: string
  plataforma: string
  link_reunion: string
  fecha_programada: string
  duracion_estimada_min: number
  motivo_consulta: string
  estado: 'programada' | 'en_curso' | 'completada' | 'cancelada' | 'no_asistio'
  estado_display: string
  notas_clinicas: string
  formula_medica: string
  incapacidad_dias: number | null
}

const estadoBadge = (e: string): 'default' | 'info' | 'success' | 'warning' | 'danger' => {
  if (e === 'programada') return 'info'
  if (e === 'en_curso') return 'warning'
  if (e === 'completada') return 'success'
  if (e === 'cancelada') return 'danger'
  if (e === 'no_asistio') return 'default'
  return 'default'
}

const INPUT = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/20 bg-white'

export default function TelemedicinaPage() {
  const [sesiones, setSesiones] = useState<Teleconsulta[]>([])
  const [loading, setLoading] = useState(true)
  const [showNueva, setShowNueva] = useState(false)
  const [completarSesion, setCompletarSesion] = useState<Teleconsulta | null>(null)

  const cargar = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/salud/telemedicina/')
      setSesiones(data.results ?? data)
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const programadas = sesiones.filter(s => s.estado === 'programada' || s.estado === 'en_curso')
  const completadas = sesiones.filter(s => s.estado === 'completada')
  const otras = sesiones.filter(s => s.estado === 'cancelada' || s.estado === 'no_asistio')

  const iniciarSesion = async (id: string) => {
    try {
      await api.patch(`/api/salud/telemedicina/${id}/`, { estado: 'en_curso' })
      toast.success('Sesión iniciada')
      cargar()
    } catch (e) { toast.error(mensajeError(e)) }
  }

  const SesionCard = ({ s }: { s: Teleconsulta }) => (
    <div className="bg-white rounded-xl border border-slate-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-slate-900 text-sm">{s.paciente_nombre}</span>
            <Badge variant={estadoBadge(s.estado)}>{s.estado_display}</Badge>
            {s.tipo_display && <Badge variant="default">{s.tipo_display}</Badge>}
          </div>
          <p className="text-xs text-slate-500">Médico: {s.medico_nombre}</p>
          {s.motivo_consulta && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{s.motivo_consulta}</p>}
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
            <span>{s.fecha_programada ? new Date(s.fecha_programada).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
            {s.duracion_estimada_min && <span>{s.duracion_estimada_min} min</span>}
            {s.plataforma && <span className="capitalize">{s.plataforma}</span>}
          </div>
          {s.estado === 'completada' && s.notas_clinicas && (
            <div className="mt-2 p-2 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-600 line-clamp-2">{s.notas_clinicas}</p>
              {s.incapacidad_dias && (
                <p className="text-xs text-amber-600 font-medium mt-1">Incapacidad: {s.incapacidad_dias} días</p>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          {(s.estado === 'programada' || s.estado === 'en_curso') && (
            <>
              {s.link_reunion && (
                <a href={s.link_reunion} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-lg font-medium transition-colors">
                  <Video className="w-3.5 h-3.5" />
                  {s.estado === 'en_curso' ? 'Unirse' : 'Iniciar'}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {s.estado === 'programada' && (
                <button onClick={() => iniciarSesion(s.id)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 text-xs rounded-lg hover:bg-slate-50 transition-colors">
                  Marcar en curso
                </button>
              )}
              {s.estado === 'en_curso' && (
                <button onClick={() => setCompletarSesion(s)}
                  className="px-3 py-1.5 border border-emerald-200 text-emerald-700 text-xs rounded-lg hover:bg-emerald-50 transition-colors">
                  <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                  Completar
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="Telemedicina"
        description="Consultas virtuales y seguimiento remoto de pacientes"
        action={
          <Button onClick={() => setShowNueva(true)}>
            <Plus className="w-4 h-4" /> Nueva teleconsulta
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-white rounded-xl border animate-pulse h-20" />)
        ) : (
          <>
            <Card className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{programadas.length}</p>
                <p className="text-xs text-slate-500">Programadas / en curso</p>
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700">{completadas.length}</p>
                <p className="text-xs text-slate-500">Completadas</p>
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="w-10 h-10 bg-halu-100 rounded-xl flex items-center justify-center">
                <Video className="w-5 h-5 text-halu-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{sesiones.length}</p>
                <p className="text-xs text-slate-500">Total sesiones</p>
              </div>
            </Card>
          </>
        )}
      </div>

      {loading ? (
        Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-white rounded-xl border animate-pulse h-24 mb-2" />)
      ) : sesiones.length === 0 ? (
        <EmptyState
          title="Sin teleconsultas"
          description="Las teleconsultas programadas y realizadas aparecerán aquí"
          action={<Button onClick={() => setShowNueva(true)}><Plus className="w-4 h-4" /> Nueva teleconsulta</Button>}
        />
      ) : (
        <div className="space-y-6">
          {programadas.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" /> Programadas y en curso
              </h2>
              <div className="space-y-2">
                {programadas.map(s => <SesionCard key={s.id} s={s} />)}
              </div>
            </div>
          )}
          {completadas.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Completadas
              </h2>
              <div className="space-y-2">
                {completadas.map(s => <SesionCard key={s.id} s={s} />)}
              </div>
            </div>
          )}
          {otras.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Canceladas / No asistió</h2>
              <div className="space-y-2">
                {otras.map(s => <SesionCard key={s.id} s={s} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {showNueva && (
        <NuevaTeleconsultaModal
          onClose={() => setShowNueva(false)}
          onSaved={() => { setShowNueva(false); cargar() }}
        />
      )}
      {completarSesion && (
        <CompletarSesionModal
          sesion={completarSesion}
          onClose={() => setCompletarSesion(null)}
          onSaved={() => { setCompletarSesion(null); cargar() }}
        />
      )}
    </div>
  )
}

function NuevaTeleconsultaModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    paciente: '', medico: '', tipo: 'primera_vez',
    plataforma: 'meet', link_reunion: '',
    fecha_programada: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
    duracion_estimada_min: '30', motivo_consulta: '',
  })
  const [saving, setSaving] = useState(false)
  const [showBuscador, setShowBuscador] = useState(false)
  const [pacienteNombre, setPacienteNombre] = useState('')
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const guardar = async () => {
    if (!form.paciente || !form.motivo_consulta) {
      toast.error('Paciente y motivo son requeridos'); return
    }
    setSaving(true)
    try {
      await api.post('/api/salud/telemedicina/', {
        ...form,
        duracion_estimada_min: Number(form.duracion_estimada_min),
      })
      toast.success('Teleconsulta programada')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Nueva teleconsulta</h2>
            <p className="text-xs text-slate-500">Programar consulta médica virtual</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Paciente *</label>
              <button
                type="button"
                onClick={() => setShowBuscador(true)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-left flex items-center justify-between hover:border-halu-400 transition-colors"
              >
                {pacienteNombre ? (
                  <span className="text-slate-900 font-medium">{pacienteNombre}</span>
                ) : (
                  <span className="text-slate-400">Buscar paciente por nombre o documento...</span>
                )}
                <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
              </button>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">ID del médico</label>
              <input value={form.medico} onChange={set('medico')} className={INPUT} placeholder="UUID del médico" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Tipo de consulta</label>
              <select value={form.tipo} onChange={set('tipo')} className={INPUT}>
                <option value="primera_vez">Primera vez</option>
                <option value="control">Control</option>
                <option value="urgencia">Urgencia</option>
                <option value="interconsulta">Interconsulta</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Plataforma</label>
              <select value={form.plataforma} onChange={set('plataforma')} className={INPUT}>
                <option value="meet">Google Meet</option>
                <option value="zoom">Zoom</option>
                <option value="teams">Microsoft Teams</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Enlace de reunión</label>
            <input value={form.link_reunion} onChange={set('link_reunion')} className={INPUT}
              placeholder="https://meet.google.com/..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Fecha y hora programada</label>
              <input type="datetime-local" value={form.fecha_programada} onChange={set('fecha_programada')} className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Duración estimada (min)</label>
              <input type="number" min="15" max="120" step="15" value={form.duracion_estimada_min} onChange={set('duracion_estimada_min')} className={INPUT} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Motivo de consulta *</label>
            <textarea value={form.motivo_consulta} onChange={set('motivo_consulta')} rows={3}
              className={INPUT} placeholder="Motivo por el cual el paciente solicita la teleconsulta..." />
          </div>
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Programar teleconsulta</Button>
        </div>
      </div>
      {showBuscador && (
        <BuscadorPacienteIngreso
          onSelect={(p, ing) => {
            setForm(f => ({ ...f, paciente: p.id, ingreso: ing?.id || '' }))
            setPacienteNombre(p.nombre_completo)
            setShowBuscador(false)
          }}
          onClose={() => setShowBuscador(false)}
        />
      )}
    </div>
  )
}

function CompletarSesionModal({ sesion, onClose, onSaved }: {
  sesion: Teleconsulta
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    notas_clinicas: '', formula_medica: '', incapacidad_dias: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const guardar = async () => {
    if (!form.notas_clinicas) { toast.error('Las notas clínicas son requeridas'); return }
    setSaving(true)
    try {
      await api.patch(`/api/salud/telemedicina/${sesion.id}/`, {
        estado: 'completada',
        notas_clinicas: form.notas_clinicas,
        formula_medica: form.formula_medica || null,
        incapacidad_dias: form.incapacidad_dias ? Number(form.incapacidad_dias) : null,
      })
      toast.success('Sesión completada')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Completar teleconsulta</h2>
            <p className="text-xs text-slate-500">{sesion.paciente_nombre}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Notas clínicas *</label>
            <textarea value={form.notas_clinicas} onChange={set('notas_clinicas')} rows={5}
              className={INPUT} placeholder="Resumen de la consulta, hallazgos, diagnóstico, plan de manejo..." />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Fórmula médica</label>
            <textarea value={form.formula_medica} onChange={set('formula_medica')} rows={3}
              className={INPUT} placeholder="Medicamentos prescritos durante la consulta..." />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Días de incapacidad</label>
            <input type="number" min="0" value={form.incapacidad_dias} onChange={set('incapacidad_dias')}
              className={INPUT} placeholder="0 si no aplica" />
          </div>
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Completar sesión</Button>
        </div>
      </div>
    </div>
  )
}
