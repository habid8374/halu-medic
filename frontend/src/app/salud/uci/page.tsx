'use client'
import { useState, useEffect } from 'react'
import api, { mensajeError } from '@/lib/api'
import { PageHeader, Button, Badge, EmptyState } from '@/components/ui'
import { Plus, Activity, BedDouble, X } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface CamaUCI {
  id: string
  numero: string
  estado: 'libre' | 'ocupada' | 'mantenimiento' | 'reservada'
  estado_display: string
  admision_activa?: AdmisionUCI
}

interface AdmisionUCI {
  id: string
  paciente_nombre: string
  diagnostico_ingreso_uci: string
  motivo_ingreso: string
  fecha_ingreso: string
  apache_ii_score: number | null
  sofa_score: number | null
  ventilacion_mecanica: boolean
  drogas_vasoactivas: boolean
  dialisis: boolean
  ultimo_monitoreo?: MonitoreoUCI
}

interface MonitoreoUCI {
  id: string
  fecha_hora: string
  ta_sistolica: number | null
  ta_diastolica: number | null
  frecuencia_cardiaca: number | null
  spo2: number | null
  temperatura: number | null
  frecuencia_respiratoria: number | null
  entradas_ml: number | null
  salidas_ml: number | null
  diuresis_ml_hora: number | null
  glasgow: number | null
  observaciones: string
  fio2: number | null
  peep: number | null
  volumen_corriente: number | null
}

const CAMA_COLORS: Record<string, string> = {
  libre:         'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 cursor-pointer',
  ocupada:       'bg-red-50 border-red-200 hover:bg-red-100 cursor-pointer',
  mantenimiento: 'bg-slate-100 border-slate-200 cursor-not-allowed',
  reservada:     'bg-amber-50 border-amber-200 hover:bg-amber-100 cursor-pointer',
}

const CAMA_TEXT: Record<string, string> = {
  libre:         'text-emerald-700',
  ocupada:       'text-red-700',
  mantenimiento: 'text-slate-500',
  reservada:     'text-amber-700',
}

const INPUT = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/20 bg-white'

export default function UCIPage() {
  const [camas, setCamas] = useState<CamaUCI[]>([])
  const [loading, setLoading] = useState(true)
  const [camaSeleccionada, setCamaSeleccionada] = useState<CamaUCI | null>(null)
  const [showAdmision, setShowAdmision] = useState(false)
  const [showMonitoreo, setShowMonitoreo] = useState(false)
  const [admisionDetalle, setAdmisionDetalle] = useState<AdmisionUCI | null>(null)

  const cargar = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/salud/uci/camas/')
      setCamas(data.results ?? data)
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const handleCamaClick = async (cama: CamaUCI) => {
    if (cama.estado === 'mantenimiento') return
    setCamaSeleccionada(cama)
    if (cama.estado === 'libre' || cama.estado === 'reservada') {
      setShowAdmision(true)
    } else if (cama.estado === 'ocupada') {
      // Cargar detalle de admisión
      try {
        const { data } = await api.get(`/api/salud/uci/admisiones/?cama=${cama.id}&activa=true`)
        const admision = (data.results ?? data)[0]
        setAdmisionDetalle(admision || null)
        setShowMonitoreo(false) // primero mostrar detalle
      } catch (e) { toast.error(mensajeError(e)) }
    }
  }

  const libres = camas.filter(c => c.estado === 'libre').length
  const ocupadas = camas.filter(c => c.estado === 'ocupada').length

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="UCI · Cuidados intensivos"
        description="Mapa de camas, admisiones y monitoreo horario"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{libres}</p>
          <p className="text-xs text-slate-500">Camas libres</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{ocupadas}</p>
          <p className="text-xs text-slate-500">Camas ocupadas</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{camas.filter(c => c.estado === 'reservada').length}</p>
          <p className="text-xs text-slate-500">Reservadas</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 text-center">
          <p className="text-2xl font-bold text-slate-500">{camas.filter(c => c.estado === 'mantenimiento').length}</p>
          <p className="text-xs text-slate-500">Mantenimiento</p>
        </div>
      </div>

      {/* Mapa de camas */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Mapa de camas UCI</h2>
        {loading ? (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : camas.length === 0 ? (
          <EmptyState title="Sin camas UCI configuradas" description="Configura las camas UCI en el módulo de configuración" />
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
            {camas.map(cama => (
              <button
                key={cama.id}
                onClick={() => handleCamaClick(cama)}
                className={clsx(
                  'rounded-xl border-2 p-3 text-center transition-all',
                  CAMA_COLORS[cama.estado]
                )}
              >
                <BedDouble className={clsx('w-5 h-5 mx-auto mb-1', CAMA_TEXT[cama.estado])} />
                <p className={clsx('text-xs font-bold', CAMA_TEXT[cama.estado])}>{cama.numero}</p>
                <p className={clsx('text-xs mt-0.5', CAMA_TEXT[cama.estado])}>{cama.estado_display}</p>
                {cama.estado === 'ocupada' && cama.admision_activa && (
                  <p className="text-xs text-slate-500 truncate mt-1 text-left leading-tight">
                    {cama.admision_activa.paciente_nombre?.split(' ')[0]}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Leyenda */}
        <div className="flex gap-4 mt-4 flex-wrap text-xs">
          {[
            { color: 'bg-emerald-100 border-emerald-300', label: 'Libre' },
            { color: 'bg-red-100 border-red-300', label: 'Ocupada' },
            { color: 'bg-amber-100 border-amber-300', label: 'Reservada' },
            { color: 'bg-slate-100 border-slate-300', label: 'Mantenimiento' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className={clsx('w-4 h-4 rounded border-2', item.color)} />
              <span className="text-slate-500">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Panel detalle admisión */}
      {admisionDetalle && camaSeleccionada?.estado === 'ocupada' && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-semibold text-slate-900">Cama {camaSeleccionada.numero} · {admisionDetalle.paciente_nombre}</h2>
              <p className="text-xs text-slate-500">Ingreso: {admisionDetalle.fecha_ingreso ? new Date(admisionDetalle.fecha_ingreso).toLocaleDateString('es-CO') : ''}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowMonitoreo(true)}>
                <Activity className="w-4 h-4" /> Registrar monitoreo
              </Button>
              <button onClick={() => { setAdmisionDetalle(null); setCamaSeleccionada(null) }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-400">Diagnóstico UCI</p>
              <p className="text-sm font-medium text-slate-800">{admisionDetalle.diagnostico_ingreso_uci || '—'}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-400">APACHE II</p>
              <p className="text-xl font-bold text-slate-800">{admisionDetalle.apache_ii_score ?? '—'}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-400">SOFA</p>
              <p className="text-xl font-bold text-slate-800">{admisionDetalle.sofa_score ?? '—'}</p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {admisionDetalle.ventilacion_mecanica && (
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">Ventilación mecánica</span>
            )}
            {admisionDetalle.drogas_vasoactivas && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">Drogas vasoactivas</span>
            )}
            {admisionDetalle.dialisis && (
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">Diálisis</span>
            )}
          </div>

          {admisionDetalle.ultimo_monitoreo && (
            <div className="mt-4 border-t pt-4">
              <p className="text-xs font-semibold text-slate-700 mb-2">Último monitoreo</p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[
                  { label: 'T.A.', value: admisionDetalle.ultimo_monitoreo.ta_sistolica ? `${admisionDetalle.ultimo_monitoreo.ta_sistolica}/${admisionDetalle.ultimo_monitoreo.ta_diastolica}` : '—' },
                  { label: 'FC', value: admisionDetalle.ultimo_monitoreo.frecuencia_cardiaca ? `${admisionDetalle.ultimo_monitoreo.frecuencia_cardiaca}` : '—' },
                  { label: 'SpO₂', value: admisionDetalle.ultimo_monitoreo.spo2 ? `${admisionDetalle.ultimo_monitoreo.spo2}%` : '—' },
                  { label: 'Temp', value: admisionDetalle.ultimo_monitoreo.temperatura ? `${admisionDetalle.ultimo_monitoreo.temperatura}°C` : '—' },
                  { label: 'Glasgow', value: admisionDetalle.ultimo_monitoreo.glasgow ?? '—' },
                  { label: 'Diuresis', value: admisionDetalle.ultimo_monitoreo.diuresis_ml_hora ? `${admisionDetalle.ultimo_monitoreo.diuresis_ml_hora} ml/h` : '—' },
                ].map(f => (
                  <div key={f.label} className="bg-slate-50 rounded-lg p-2 text-center">
                    <p className="text-xs text-slate-400">{f.label}</p>
                    <p className="text-sm font-semibold text-slate-800">{String(f.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showAdmision && camaSeleccionada && (
        <AdmisionModal
          cama={camaSeleccionada}
          onClose={() => { setShowAdmision(false); setCamaSeleccionada(null) }}
          onSaved={() => { setShowAdmision(false); setCamaSeleccionada(null); cargar() }}
        />
      )}

      {showMonitoreo && admisionDetalle && (
        <MonitoreoModal
          admision={admisionDetalle}
          onClose={() => setShowMonitoreo(false)}
          onSaved={() => { setShowMonitoreo(false); cargar() }}
        />
      )}
    </div>
  )
}

function AdmisionModal({ cama, onClose, onSaved }: {
  cama: CamaUCI
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    paciente: '', diagnostico_ingreso_uci: '', motivo_ingreso: '',
    apache_ii_score: '', sofa_score: '',
    ventilacion_mecanica: false, drogas_vasoactivas: false, dialisis: false,
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))
  const setCheck = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.checked }))

  const guardar = async () => {
    if (!form.paciente || !form.diagnostico_ingreso_uci) {
      toast.error('Paciente y diagnóstico son requeridos'); return
    }
    setSaving(true)
    try {
      await api.post('/api/salud/uci/admisiones/', {
        ...form, cama: cama.id,
        apache_ii_score: form.apache_ii_score ? Number(form.apache_ii_score) : null,
        sofa_score: form.sofa_score ? Number(form.sofa_score) : null,
      })
      toast.success('Paciente admitido en UCI')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Admisión UCI · Cama {cama.numero}</h2>
            <p className="text-xs text-slate-500">Ingresar paciente a cuidados intensivos</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">ID del paciente *</label>
            <input value={form.paciente} onChange={set('paciente')} className={INPUT} placeholder="UUID del paciente" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Diagnóstico de ingreso UCI *</label>
            <input value={form.diagnostico_ingreso_uci} onChange={set('diagnostico_ingreso_uci')} className={INPUT} placeholder="Diagnóstico principal" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Motivo de ingreso</label>
            <textarea value={form.motivo_ingreso} onChange={set('motivo_ingreso')} rows={3}
              className={INPUT} placeholder="Descripción clínica del motivo de ingreso a UCI..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">APACHE II score</label>
              <input type="number" min="0" max="71" value={form.apache_ii_score} onChange={set('apache_ii_score')} className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">SOFA score</label>
              <input type="number" min="0" max="24" value={form.sofa_score} onChange={set('sofa_score')} className={INPUT} />
            </div>
          </div>
          <div className="flex gap-4 flex-wrap">
            {[
              { k: 'ventilacion_mecanica', label: 'Ventilación mecánica' },
              { k: 'drogas_vasoactivas', label: 'Drogas vasoactivas' },
              { k: 'dialisis', label: 'Diálisis' },
            ].map(item => (
              <label key={item.k} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={(form as Record<string, unknown>)[item.k] as boolean}
                  onChange={setCheck(item.k)} className="rounded" />
                {item.label}
              </label>
            ))}
          </div>
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Admitir paciente</Button>
        </div>
      </div>
    </div>
  )
}

function MonitoreoModal({ admision, onClose, onSaved }: {
  admision: AdmisionUCI
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    ta_sistolica: '', ta_diastolica: '', frecuencia_cardiaca: '',
    spo2: '', temperatura: '', frecuencia_respiratoria: '',
    entradas_ml: '', salidas_ml: '', diuresis_ml_hora: '',
    glasgow: '', observaciones: '',
    fio2: '', peep: '', volumen_corriente: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const guardar = async () => {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = { admision: admision.id, ...form }
      const numFields = [
        'ta_sistolica', 'ta_diastolica', 'frecuencia_cardiaca', 'spo2',
        'temperatura', 'frecuencia_respiratoria', 'entradas_ml', 'salidas_ml',
        'diuresis_ml_hora', 'glasgow', 'fio2', 'peep', 'volumen_corriente',
      ]
      numFields.forEach(k => {
        payload[k] = payload[k] !== '' ? Number(payload[k]) : null
      })
      await api.post('/api/salud/uci/monitoreo/', payload)
      toast.success('Monitoreo registrado')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Monitoreo UCI</h2>
            <p className="text-xs text-slate-500">{admision.paciente_nombre} · Registro horario</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2">Signos vitales</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { k: 'ta_sistolica', label: 'T.A. sistólica' },
                { k: 'ta_diastolica', label: 'T.A. diastólica' },
                { k: 'frecuencia_cardiaca', label: 'FC (lpm)' },
                { k: 'spo2', label: 'SpO₂ (%)' },
                { k: 'temperatura', label: 'Temp (°C)' },
                { k: 'frecuencia_respiratoria', label: 'FR (rpm)' },
                { k: 'glasgow', label: 'Glasgow' },
              ].map(f => (
                <div key={f.k}>
                  <label className="text-xs text-slate-400 block mb-0.5">{f.label}</label>
                  <input type="number" step="any" value={(form as Record<string, string>)[f.k]}
                    onChange={set(f.k)} className={INPUT} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2">Balance hídrico</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { k: 'entradas_ml', label: 'Entradas (ml)' },
                { k: 'salidas_ml', label: 'Salidas (ml)' },
                { k: 'diuresis_ml_hora', label: 'Diuresis (ml/h)' },
              ].map(f => (
                <div key={f.k}>
                  <label className="text-xs text-slate-400 block mb-0.5">{f.label}</label>
                  <input type="number" step="any" value={(form as Record<string, string>)[f.k]}
                    onChange={set(f.k)} className={INPUT} />
                </div>
              ))}
            </div>
          </div>

          {admision.ventilacion_mecanica && (
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2">Parámetros ventilatorios</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { k: 'fio2', label: 'FiO₂ (%)' },
                  { k: 'peep', label: 'PEEP (cmH₂O)' },
                  { k: 'volumen_corriente', label: 'Vol. corriente (ml)' },
                ].map(f => (
                  <div key={f.k}>
                    <label className="text-xs text-slate-400 block mb-0.5">{f.label}</label>
                    <input type="number" step="any" value={(form as Record<string, string>)[f.k]}
                      onChange={set(f.k)} className={INPUT} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Observaciones</label>
            <textarea value={form.observaciones} onChange={set('observaciones')} rows={3}
              className={INPUT} placeholder="Observaciones clínicas del período de monitoreo..." />
          </div>
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Registrar monitoreo</Button>
        </div>
      </div>
    </div>
  )
}
