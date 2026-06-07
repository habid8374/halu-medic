'use client'
import { useState, useEffect } from 'react'
import { enfermeriaAPI, mensajeError } from '@/lib/api'
import { PageHeader, Button, Badge, EmptyState, BuscadorPacienteIngreso } from '@/components/ui'
import { Plus, Moon, Sun, Sunset, Lock, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface NotaEnf {
  id: string
  turno: string
  turno_display: string
  fecha_hora: string
  enfermero_nombre: string
  tension_arterial: string
  frecuencia_cardiaca: number | null
  spo2: number | null
  temperatura: string | null
  dolor_escala: number | null
  balance_hidrico: number | null
  observaciones: string
  firmada: boolean
  ingreso: string
}

const TURNO_ICON: Record<string, React.ReactNode> = {
  manana: <Sun className="w-3.5 h-3.5 text-amber-500" />,
  tarde:  <Sunset className="w-3.5 h-3.5 text-orange-500" />,
  noche:  <Moon className="w-3.5 h-3.5 text-blue-500" />,
}

export default function EnfermeriaPage() {
  const [notas, setNotas] = useState<NotaEnf[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filtroIngreso, setFiltroIngreso] = useState('')
  const [filtroTurno, setFiltroTurno] = useState('')

  const cargar = async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {}
      if (filtroIngreso) params.ingreso = filtroIngreso
      if (filtroTurno) params.turno = filtroTurno
      const { data } = await enfermeriaAPI.list(params)
      setNotas(data.results ?? data)
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [filtroTurno])

  const balanceColor = (b: number | null) => {
    if (b === null) return 'text-slate-400'
    if (b > 0) return 'text-blue-600'
    if (b < 0) return 'text-red-600'
    return 'text-green-600'
  }

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="Notas de enfermería"
        description="Registro por turno · Signos vitales · Balance hídrico · MAR"
        action={<Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4" />Nueva nota</Button>}
      />

      <div className="flex gap-2 mb-5 flex-wrap">
        {[
          { v: '', label: 'Todos los turnos' },
          { v: 'manana', label: '☀ Mañana' },
          { v: 'tarde',  label: '🌅 Tarde' },
          { v: 'noche',  label: '🌙 Noche' },
        ].map(f => (
          <button key={f.v} onClick={() => setFiltroTurno(f.v)}
            className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              filtroTurno === f.v ? 'bg-halu-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            )}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-white rounded-xl border animate-pulse" />)
        ) : notas.length === 0 ? (
          <EmptyState title="Sin notas" description="Las notas de enfermería aparecerán aquí" />
        ) : (
          notas.map(n => (
            <div key={n.id} className="bg-white rounded-xl border border-slate-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                {TURNO_ICON[n.turno]}
                <span className="text-xs font-semibold text-slate-700">{n.turno_display}</span>
                <span className="text-xs text-slate-400">
                  {new Date(n.fecha_hora).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                {n.firmada && (
                  <span className="ml-auto flex items-center gap-1 text-xs text-green-600">
                    <Lock className="w-3 h-3" /> Firmada
                  </span>
                )}
                {n.enfermero_nombre && <span className="text-xs text-slate-400 ml-auto">{n.enfermero_nombre}</span>}
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-2">
                {[
                  { label: 'T.A.', value: n.tension_arterial || '—' },
                  { label: 'FC', value: n.frecuencia_cardiaca ? `${n.frecuencia_cardiaca} lpm` : '—' },
                  { label: 'SpO₂', value: n.spo2 ? `${n.spo2}%` : '—' },
                  { label: 'Temp', value: n.temperatura ? `${n.temperatura}°C` : '—' },
                  { label: 'Dolor', value: n.dolor_escala != null ? `${n.dolor_escala}/10` : '—' },
                  {
                    label: 'Balance',
                    value: n.balance_hidrico != null ? `${n.balance_hidrico > 0 ? '+' : ''}${n.balance_hidrico} ml` : '—',
                    color: balanceColor(n.balance_hidrico),
                  },
                ].map(f => (
                  <div key={f.label} className="bg-slate-50 rounded-lg p-2 text-center">
                    <p className="text-xs text-slate-400">{f.label}</p>
                    <p className={clsx('text-sm font-semibold', f.color || 'text-slate-800')}>{f.value}</p>
                  </div>
                ))}
              </div>

              {n.observaciones && (
                <p className="text-xs text-slate-600 border-t pt-2">{n.observaciones}</p>
              )}
            </div>
          ))
        )}
      </div>

      {showForm && (
        <NuevoNotaModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); cargar() }} />
      )}
    </div>
  )
}

function NuevoNotaModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    paciente: '', ingreso: '', turno: 'manana', fecha_hora: new Date().toISOString().slice(0, 16),
    tension_arterial: '', frecuencia_cardiaca: '', frecuencia_resp: '',
    temperatura: '', spo2: '', glasgow: '', dolor_escala: '', peso_kg: '',
    curaciones: '', sondas_catéteres: '', movilizacion: '', observaciones: '',
    entradas_ml: [] as { tipo: string; volumen_ml: number }[],
    salidas_ml:  [] as { tipo: string; volumen_ml: number }[],
    medicamentos_administrados: [] as { medicamento: string; dosis: string; via: string; hora: string }[],
  })
  const [saving, setSaving] = useState(false)
  const [showBuscador, setShowBuscador] = useState(false)
  const [pacienteNombre, setPacienteNombre] = useState('')

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const INPUT = "w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/20"

  const totalEntradas = form.entradas_ml.reduce((s, e) => s + e.volumen_ml, 0)
  const totalSalidas  = form.salidas_ml.reduce((s, e) => s + e.volumen_ml, 0)
  const balance       = totalEntradas - totalSalidas

  const guardar = async () => {
    if ((!form.ingreso && !form.paciente) || !form.turno) { toast.error('Paciente y turno son requeridos'); return }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        ...form,
        balance_hidrico: balance || null,
      }
      ;['frecuencia_cardiaca','frecuencia_resp','spo2','glasgow','dolor_escala'].forEach(k => {
        if (payload[k] === '') payload[k] = null
        else if (payload[k]) payload[k] = Number(payload[k])
      })
      if (!payload.temperatura) payload.temperatura = null
      if (!payload.peso_kg) payload.peso_kg = null
      await enfermeriaAPI.create(payload)
      toast.success('Nota de enfermería registrada')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b">
          <h2 className="font-bold text-slate-900">Nota de enfermería</h2>
          <p className="text-xs text-slate-500">Registro por turno · Balance hídrico · Signos vitales</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3">
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
              <label className="text-xs font-medium text-slate-600 block mb-1">Turno *</label>
              <select value={form.turno} onChange={set('turno')} className={INPUT}>
                <option value="manana">☀ Mañana (6am-2pm)</option>
                <option value="tarde">🌅 Tarde (2pm-10pm)</option>
                <option value="noche">🌙 Noche (10pm-6am)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Fecha/hora</label>
              <input type="datetime-local" value={form.fecha_hora} onChange={set('fecha_hora')} className={INPUT} />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2">Signos vitales</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { k: 'tension_arterial', label: 'T.A.', ph: '120/80', type: 'text' },
                { k: 'frecuencia_cardiaca', label: 'FC (lpm)', ph: '80', type: 'number' },
                { k: 'frecuencia_resp', label: 'FR (rpm)', ph: '18', type: 'number' },
                { k: 'temperatura', label: 'Temp °C', ph: '36.5', type: 'number' },
                { k: 'spo2', label: 'SpO₂ %', ph: '98', type: 'number' },
                { k: 'glasgow', label: 'Glasgow', ph: '15', type: 'number' },
                { k: 'dolor_escala', label: 'Dolor (EVA)', ph: '0-10', type: 'number' },
                { k: 'peso_kg', label: 'Peso kg', ph: '70', type: 'number' },
              ].map(f => (
                <div key={f.k}>
                  <label className="text-xs text-slate-400 block mb-0.5">{f.label}</label>
                  <input type={f.type} step="any" value={(form as Record<string, unknown>)[f.k] as string} onChange={set(f.k)} placeholder={f.ph} className={INPUT} />
                </div>
              ))}
            </div>
          </div>

          {/* Balance hídrico simplificado */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-blue-800 mb-2">Balance hídrico (ml)</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-slate-500">Entradas</p>
                <input type="number" placeholder="0" className={INPUT}
                  onChange={e => setForm(f => ({ ...f, entradas_ml: [{ tipo: 'Total', volumen_ml: Number(e.target.value) }] }))} />
              </div>
              <div>
                <p className="text-xs text-slate-500">Salidas</p>
                <input type="number" placeholder="0" className={INPUT}
                  onChange={e => setForm(f => ({ ...f, salidas_ml: [{ tipo: 'Total', volumen_ml: Number(e.target.value) }] }))} />
              </div>
              <div>
                <p className="text-xs text-slate-500">Balance</p>
                <p className={clsx('text-lg font-bold py-2', balance > 0 ? 'text-blue-600' : balance < 0 ? 'text-red-600' : 'text-green-600')}>
                  {balance > 0 ? '+' : ''}{balance} ml
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Curaciones / estado de heridas</label>
            <textarea value={form.curaciones} onChange={set('curaciones')} rows={2} className={INPUT} placeholder="Curaciones realizadas, estado de heridas operatorias..." />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Sondas, catéteres y drenajes</label>
            <textarea value={form['sondas_catéteres']} onChange={set('sondas_catéteres')} rows={2} className={INPUT} placeholder="Estado de sonda vesical, catéter venoso central, drenajes..." />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Movilización</label>
            <textarea value={form.movilizacion} onChange={set('movilizacion')} rows={2} className={INPUT} placeholder="Cambios de posición, deambulación, medidas antitrombóticas..." />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Observaciones generales</label>
            <textarea value={form.observaciones} onChange={set('observaciones')} rows={3} className={INPUT} placeholder="Observaciones del turno, conducta, novedades..." />
          </div>
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Guardar nota</Button>
        </div>
      </div>
      {showBuscador && (
        <BuscadorPacienteIngreso
          onSelect={(p, ing) => {
            setForm(f => ({ ...f, paciente: p.id, ingreso: ing?.id || f.ingreso || '' }))
            setPacienteNombre(p.nombre_completo)
            setShowBuscador(false)
          }}
          onClose={() => setShowBuscador(false)}
        />
      )}
    </div>
  )
}
