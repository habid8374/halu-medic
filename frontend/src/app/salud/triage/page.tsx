'use client'
import { useState } from 'react'
import { triageAPI, mensajeError } from '@/lib/api'
import { PageHeader, Button, Badge, EmptyState, BuscadorPacienteIngreso } from '@/components/ui'
import { AlertTriangle, Clock, CheckCircle, Plus, Search, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { useRouter } from 'next/navigation'

interface TriageItem {
  id: string
  nivel: number
  nivel_display: string
  estado: string
  estado_display: string
  motivo_consulta: string
  paciente_nombre: string
  tension_arterial: string
  frecuencia_cardiaca: number | null
  spo2: number | null
  temperatura: string | null
  dolor_escala: number | null
  hora_clasificacion: string
  hora_atencion: string | null
}

const NIVEL_CONFIG: Record<number, { color: string; bg: string; label: string; tiempo: string }> = {
  1: { color: 'text-red-700',    bg: 'bg-red-100 border-red-300',    label: 'I — Reanimación',    tiempo: 'Inmediato' },
  2: { color: 'text-orange-700', bg: 'bg-orange-100 border-orange-300', label: 'II — Emergencia', tiempo: '< 15 min' },
  3: { color: 'text-yellow-700', bg: 'bg-yellow-100 border-yellow-300', label: 'III — Urgencia',  tiempo: '< 30 min' },
  4: { color: 'text-green-700',  bg: 'bg-green-100 border-green-300', label: 'IV — Menos urgente', tiempo: '< 2 hrs' },
  5: { color: 'text-blue-700',   bg: 'bg-blue-100 border-blue-300',  label: 'V — Sin urgencia',   tiempo: '< 4 hrs' },
}

function NivelBadge({ nivel }: { nivel: number }) {
  const cfg = NIVEL_CONFIG[nivel]
  return (
    <span className={clsx('text-xs font-bold px-2.5 py-1 rounded-lg border', cfg.bg, cfg.color)}>
      N{nivel} · {NIVEL_CONFIG[nivel].tiempo}
    </span>
  )
}

function tiempoEspera(fecha: string) {
  const mins = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000)
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

export default function TriagePage() {
  const router = useRouter()
  const [triages, setTriages] = useState<TriageItem[]>([])
  const [loading, setLoading] = useState(false)
  const [cargado, setCargado] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState('espera')
  const [showForm, setShowForm] = useState(false)

  const cargar = async (estado?: string) => {
    setLoading(true)
    try {
      const { data } = await triageAPI.list({ estado: estado ?? filtroEstado })
      setTriages(data.results ?? data)
      setCargado(true)
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setLoading(false) }
  }

  // Carga inicial
  useState(() => { cargar() })

  const cambiarFiltro = (estado: string) => {
    setFiltroEstado(estado)
    cargar(estado)
  }

  const atender = async (id: string) => {
    try {
      await triageAPI.atender(id)
      toast.success('Paciente en atención')
      cargar()
    } catch (e) { toast.error(mensajeError(e)) }
  }

  const kpis = [
    { label: 'Nivel I-II (críticos)', value: triages.filter(t => t.nivel <= 2 && t.estado === 'espera').length, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
    { label: 'Nivel III (urgentes)', value: triages.filter(t => t.nivel === 3 && t.estado === 'espera').length, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
    { label: 'En atención', value: triages.filter(t => t.estado === 'en_atencion').length, color: 'text-halu-600', bg: 'bg-halu-50 border-halu-200' },
    { label: 'Atendidos hoy', value: triages.filter(t => t.estado === 'atendido').length, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  ]

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="Triage / Urgencias"
        description="Clasificación Res. 5596/2015 · 5 niveles de prioridad"
        action={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> Nuevo triage
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {kpis.map(k => (
          <div key={k.label} className={clsx('rounded-xl border p-3', k.bg)}>
            <p className={clsx('text-2xl font-black', k.color)}>{k.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros estado */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { v: 'espera', label: 'En espera' },
          { v: 'en_atencion', label: 'En atención' },
          { v: 'atendido', label: 'Atendidos' },
          { v: '', label: 'Todos' },
        ].map(f => (
          <button key={f.v}
            onClick={() => cambiarFiltro(f.v)}
            className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              filtroEstado === f.v ? 'bg-halu-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            )}>
            {f.label}
          </button>
        ))}
        <button onClick={() => cargar()}
          className="ml-auto px-3 py-1.5 rounded-lg text-xs bg-white border border-slate-200 text-slate-600 hover:bg-slate-50">
          <Search className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-xl border border-slate-100 animate-pulse" />
          ))
        ) : triages.length === 0 ? (
          <EmptyState title="No hay registros" description="No hay pacientes en triage con el filtro seleccionado" />
        ) : (
          triages.map(t => {
            const cfg = NIVEL_CONFIG[t.nivel]
            return (
              <div key={t.id} className={clsx('bg-white rounded-xl border p-4 flex items-start gap-3', t.nivel <= 2 ? 'border-l-4 border-l-red-400' : t.nivel === 3 ? 'border-l-4 border-l-yellow-400' : 'border-slate-100')}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <NivelBadge nivel={t.nivel} />
                    <span className="font-semibold text-sm text-slate-900">{t.paciente_nombre}</span>
                    {t.estado === 'espera' && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {tiempoEspera(t.hora_clasificacion)}
                      </span>
                    )}
                    {t.estado === 'en_atencion' && <Badge variant="info">En atención</Badge>}
                    {t.estado === 'atendido' && <Badge variant="success">Atendido</Badge>}
                  </div>
                  <p className="text-xs text-slate-600 mb-2">{t.motivo_consulta}</p>
                  <div className="flex gap-3 flex-wrap text-xs text-slate-500">
                    {t.tension_arterial && <span>TA: {t.tension_arterial}</span>}
                    {t.frecuencia_cardiaca && <span>FC: {t.frecuencia_cardiaca} lpm</span>}
                    {t.spo2 && <span>SpO₂: {t.spo2}%</span>}
                    {t.temperatura && <span>T°: {t.temperatura}°C</span>}
                    {t.dolor_escala != null && <span>Dolor: {t.dolor_escala}/10</span>}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {t.estado === 'espera' && (
                    <Button variant="secondary" onClick={() => atender(t.id)}>
                      Atender
                    </Button>
                  )}
                  <button onClick={() => router.push(`/salud/triage/${t.id}`)}
                    className="p-2 rounded-lg hover:bg-slate-50 text-slate-400">
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal nuevo triage */}
      {showForm && <NuevoTriageModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); cargar() }} />}
    </div>
  )
}

function NuevoTriageModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    paciente: '', nivel: 3, motivo_consulta: '',
    tension_arterial: '', frecuencia_cardiaca: '', frecuencia_resp: '',
    temperatura: '', spo2: '', glasgow: '', dolor_escala: '', peso_kg: '',
    alergias: '', medicamentos_actuales: '', mecanismo_trauma: '',
  })
  const [saving, setSaving] = useState(false)
  const [showBuscador, setShowBuscador] = useState(false)
  const [pacienteNombre, setPacienteNombre] = useState('')

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const guardar = async () => {
    if (!form.paciente || !form.motivo_consulta) { toast.error('Paciente y motivo son requeridos'); return }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = { ...form }
      ;['frecuencia_cardiaca','frecuencia_resp','spo2','glasgow','dolor_escala'].forEach(k => {
        if (payload[k] === '') payload[k] = null
        else if (payload[k]) payload[k] = Number(payload[k])
      })
      if (!payload.temperatura) payload.temperatura = null
      if (!payload.peso_kg) payload.peso_kg = null
      await triageAPI.create(payload)
      toast.success('Triage registrado')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  const INPUT = "w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/20"

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">Nuevo Triage</h2>
          <p className="text-xs text-slate-500">Clasificación Res. 5596/2015</p>
        </div>
        <div className="p-5 space-y-4">
          {/* Paciente + nivel */}
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
              <label className="text-xs font-medium text-slate-600 block mb-1">Nivel de triage *</label>
              <select value={form.nivel} onChange={set('nivel')} className={INPUT}>
                <option value={1}>I — Reanimación (ROJO) · Inmediato</option>
                <option value={2}>II — Emergencia (NARANJA) · &lt; 15 min</option>
                <option value={3}>III — Urgencia (AMARILLO) · &lt; 30 min</option>
                <option value={4}>IV — Menos urgente (VERDE) · &lt; 2 hrs</option>
                <option value={5}>V — Sin urgencia (AZUL) · &lt; 4 hrs</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Motivo de consulta *</label>
            <textarea value={form.motivo_consulta} onChange={set('motivo_consulta')} rows={2} placeholder="Motivo en palabras del paciente..." className={INPUT} />
          </div>

          {/* Signos vitales */}
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2 border-b pb-1">Signos vitales iniciales</p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {[
                { k: 'tension_arterial', label: 'T.A.', ph: '120/80', type: 'text' },
                { k: 'frecuencia_cardiaca', label: 'FC (lpm)', ph: '80', type: 'number' },
                { k: 'frecuencia_resp', label: 'FR (rpm)', ph: '18', type: 'number' },
                { k: 'temperatura', label: 'Temp (°C)', ph: '36.5', type: 'number' },
                { k: 'spo2', label: 'SpO₂ (%)', ph: '98', type: 'number' },
                { k: 'glasgow', label: 'Glasgow', ph: '15', type: 'number' },
                { k: 'dolor_escala', label: 'Dolor (EVA)', ph: '0-10', type: 'number' },
                { k: 'peso_kg', label: 'Peso (kg)', ph: '70', type: 'number' },
              ].map(f => (
                <div key={f.k}>
                  <label className="text-xs text-slate-500 block mb-1">{f.label}</label>
                  <input type={f.type} step="any" value={(form as Record<string, unknown>)[f.k] as string} onChange={set(f.k)} placeholder={f.ph} className={INPUT} />
                </div>
              ))}
            </div>
          </div>

          {/* Antecedentes urgentes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Alergias conocidas</label>
              <textarea value={form.alergias} onChange={set('alergias')} rows={2} className={INPUT} placeholder="Medicamentos, alimentos, etc." />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Medicamentos actuales</label>
              <textarea value={form.medicamentos_actuales} onChange={set('medicamentos_actuales')} rows={2} className={INPUT} placeholder="Medicamentos en uso..." />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Mecanismo de trauma (si aplica)</label>
            <input value={form.mecanismo_trauma} onChange={set('mecanismo_trauma')} className={INPUT} placeholder="Ej: caída, accidente, etc." />
          </div>
        </div>
        <div className="p-5 border-t border-slate-100 flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Registrar triage</Button>
        </div>
      </div>
      {showBuscador && (
        <BuscadorPacienteIngreso
          onSelect={(p, ing) => {
            setForm(f => ({ ...f, paciente: p.id }))
            setPacienteNombre(p.nombre_completo)
            setShowBuscador(false)
          }}
          onClose={() => setShowBuscador(false)}
        />
      )}
    </div>
  )
}
