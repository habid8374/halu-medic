'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ingresosAPI, historiaAPI, mensajeError } from '@/lib/api'
import { Ingreso, HistoriaClinica } from '@/types'
import { Button, Card, Spinner } from '@/components/ui'
import {
  ArrowLeft, UserCheck, UserMinus, PlusCircle, ClipboardList,
  Heart, Thermometer, Activity, Scale, CheckCircle2
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

function fmtFecha(s: string) {
  return new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const TIPO_REGISTRO_LABEL: Record<string, string> = {
  consulta: 'Consulta', urgencias: 'Urgencias', hospitalizacion: 'Hospitalización',
  procedimiento: 'Procedimiento', evolucion: 'Evolución', interconsulta: 'Interconsulta',
}
const TIPO_REGISTRO_COLOR: Record<string, string> = {
  consulta: 'bg-blue-100 text-blue-700', urgencias: 'bg-red-100 text-red-700',
  hospitalizacion: 'bg-purple-100 text-purple-700', procedimiento: 'bg-orange-100 text-orange-700',
  evolucion: 'bg-green-100 text-green-700', interconsulta: 'bg-yellow-100 text-yellow-700',
}

const TIPO_EGRESO = [
  { value: 'alta_medica', label: 'Alta médica' },
  { value: 'traslado', label: 'Traslado' },
  { value: 'voluntario', label: 'Retiro voluntario' },
  { value: 'fallecimiento', label: 'Fallecimiento' },
  { value: 'fuga', label: 'Fuga' },
]

function SignoVital({ label, value, unit }: { label: string; value?: number; unit: string }) {
  if (!value) return null
  return (
    <div className="text-center">
      <p className="text-lg font-bold text-slate-900">{value}<span className="text-xs text-slate-400 ml-0.5">{unit}</span></p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}

function ModalEgreso({ onClose, onConfirm }: { onClose: () => void; onConfirm: (data: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState({ fecha_egreso: new Date().toISOString().slice(0, 16), tipo_egreso: 'alta_medica', diagnostico_egreso: '', condicion_al_egreso: '', observaciones: '' })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try { await onConfirm(form) } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Registrar Egreso</h2>
          <p className="text-xs text-slate-500 mt-0.5">Completar para dar de alta al paciente</p>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha egreso *</label>
              <input type="datetime-local" className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.fecha_egreso} onChange={e => set('fecha_egreso', e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo egreso *</label>
              <select className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.tipo_egreso} onChange={e => set('tipo_egreso', e.target.value)}>
                {TIPO_EGRESO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Diagnóstico egreso (CIE-10)</label>
            <input type="text" maxLength={10} className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.diagnostico_egreso} onChange={e => set('diagnostico_egreso', e.target.value)} placeholder="Ej: J06.9" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Condición al egreso</label>
            <textarea rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              value={form.condicion_al_egreso} onChange={e => set('condicion_al_egreso', e.target.value)} placeholder="Estado del paciente al momento del egreso..." />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? <Spinner size="sm" /> : <CheckCircle2 className="w-4 h-4" />}
              {saving ? 'Guardando…' : 'Confirmar Egreso'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalNuevaHC({ ingresoId, pacienteId, onClose, onCreated }: {
  ingresoId: string; pacienteId: string; onClose: () => void; onCreated: () => void
}) {
  const [form, setForm] = useState({
    fecha_atencion: new Date().toISOString().slice(0, 16),
    tipo_registro: 'consulta',
    motivo_consulta: '', anamnesis: '', enfermedad_actual: '',
    examen_fisico: '', impresion_diagnostica: '',
    diagnostico_principal: '', plan_tratamiento: '', ordenes_medicas: '',
    sv_pa_s: '', sv_pa_d: '', sv_fc: '', sv_fr: '', sv_temp: '', sv_peso: '', sv_talla: '', sv_spo2: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    const sv: Record<string, number> = {}
    if (form.sv_pa_s)   sv.pa_sistolica  = Number(form.sv_pa_s)
    if (form.sv_pa_d)   sv.pa_diastolica = Number(form.sv_pa_d)
    if (form.sv_fc)     sv.fc            = Number(form.sv_fc)
    if (form.sv_fr)     sv.fr            = Number(form.sv_fr)
    if (form.sv_temp)   sv.temperatura   = Number(form.sv_temp)
    if (form.sv_peso)   sv.peso          = Number(form.sv_peso)
    if (form.sv_talla)  sv.talla         = Number(form.sv_talla)
    if (form.sv_spo2)   sv.spo2          = Number(form.sv_spo2)
    try {
      await historiaAPI.create({
        paciente: pacienteId, ingreso: ingresoId,
        fecha_atencion: form.fecha_atencion, tipo_registro: form.tipo_registro,
        motivo_consulta: form.motivo_consulta, anamnesis: form.anamnesis,
        enfermedad_actual: form.enfermedad_actual, examen_fisico: form.examen_fisico,
        impresion_diagnostica: form.impresion_diagnostica,
        diagnostico_principal: form.diagnostico_principal,
        plan_tratamiento: form.plan_tratamiento, ordenes_medicas: form.ordenes_medicas,
        signos_vitales: Object.keys(sv).length > 0 ? sv : null,
      })
      toast.success('Registro guardado')
      onCreated()
    } catch (err) {
      toast.error(mensajeError(err))
    } finally {
      setSaving(false)
    }
  }

  const tiposRegistro = [
    { value: 'consulta', label: 'Consulta' }, { value: 'urgencias', label: 'Urgencias' },
    { value: 'hospitalizacion', label: 'Hospitalización' }, { value: 'procedimiento', label: 'Procedimiento' },
    { value: 'evolucion', label: 'Nota de evolución' }, { value: 'interconsulta', label: 'Interconsulta' },
  ]

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-slate-900">Nuevo Registro HC</h2>
            <p className="text-xs text-slate-500">Historia clínica del paciente</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha atención *</label>
              <input type="datetime-local" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.fecha_atencion} onChange={e => set('fecha_atencion', e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo *</label>
              <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.tipo_registro} onChange={e => set('tipo_registro', e.target.value)}>
                {tiposRegistro.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {/* Signos vitales */}
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">Signos vitales</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { k: 'sv_pa_s', label: 'TAS', placeholder: 'mmHg' },
                { k: 'sv_pa_d', label: 'TAD', placeholder: 'mmHg' },
                { k: 'sv_fc', label: 'FC', placeholder: 'lpm' },
                { k: 'sv_fr', label: 'FR', placeholder: '/min' },
                { k: 'sv_temp', label: 'Temp', placeholder: '°C' },
                { k: 'sv_peso', label: 'Peso', placeholder: 'kg' },
                { k: 'sv_talla', label: 'Talla', placeholder: 'cm' },
                { k: 'sv_spo2', label: 'SpO2', placeholder: '%' },
              ].map(sv => (
                <div key={sv.k}>
                  <label className="block text-xs text-slate-500 mb-0.5">{sv.label}</label>
                  <input type="number" step="any" placeholder={sv.placeholder}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={(form as Record<string, string>)[sv.k]} onChange={e => set(sv.k, e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          {[
            { k: 'motivo_consulta', label: 'Motivo de consulta' },
            { k: 'anamnesis', label: 'Anamnesis' },
            { k: 'enfermedad_actual', label: 'Enfermedad actual' },
            { k: 'examen_fisico', label: 'Examen físico' },
            { k: 'impresion_diagnostica', label: 'Impresión diagnóstica' },
          ].map(f => (
            <div key={f.k}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
              <textarea rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                value={(form as Record<string, string>)[f.k]} onChange={e => set(f.k, e.target.value)} />
            </div>
          ))}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Diagnóstico CIE-10</label>
            <input type="text" maxLength={10} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.diagnostico_principal} onChange={e => set('diagnostico_principal', e.target.value)} placeholder="Ej: J06.9" />
          </div>

          {[
            { k: 'plan_tratamiento', label: 'Plan de tratamiento' },
            { k: 'ordenes_medicas', label: 'Órdenes médicas' },
          ].map(f => (
            <div key={f.k}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
              <textarea rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                value={(form as Record<string, string>)[f.k]} onChange={e => set(f.k, e.target.value)} />
            </div>
          ))}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? <Spinner size="sm" /> : null}
              {saving ? 'Guardando…' : 'Guardar Registro'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function IngresoDetallePage({ params }: { params: { id: string } }) {
  const { id } = params
  const [ingreso, setIngreso]     = useState<Ingreso | null>(null)
  const [historias, setHistorias] = useState<HistoriaClinica[]>([])
  const [loading, setLoading]     = useState(true)
  const [showEgreso, setShowEgreso]   = useState(false)
  const [showNuevaHC, setShowNuevaHC] = useState(false)

  const cargar = () => {
    Promise.all([
      ingresosAPI.get(id),
      historiaAPI.list({ ingreso: id }),
    ]).then(([{ data: ing }, { data: hc }]) => {
      setIngreso(ing)
      setHistorias(Array.isArray(hc) ? hc : hc.results ?? [])
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [id])

  const confirmarEgreso = async (data: Record<string, unknown>) => {
    await ingresosAPI.egresar(id, data)
    toast.success('Paciente egresado correctamente')
    setShowEgreso(false)
    cargar()
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (!ingreso) return <div className="page-padding"><p className="text-red-600">Ingreso no encontrado</p></div>

  const sv = historias.find(h => h.signos_vitales)?.signos_vitales

  return (
    <div className="page-padding max-w-4xl animate-fade-in">
      {showEgreso && <ModalEgreso onClose={() => setShowEgreso(false)} onConfirm={confirmarEgreso} />}
      {showNuevaHC && (
        <ModalNuevaHC
          ingresoId={id} pacienteId={ingreso.paciente}
          onClose={() => setShowNuevaHC(false)}
          onCreated={() => { setShowNuevaHC(false); cargar() }}
        />
      )}

      {/* Header */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 mb-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Link href="/historia-clinica">
              <button className="p-1.5 rounded-lg hover:bg-white/10"><ArrowLeft className="w-4 h-4" /></button>
            </Link>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Ingreso #{ingreso.numero_ingreso}</p>
              <h1 className="text-xl font-bold mt-0.5">{ingreso.paciente_nombre}</h1>
              <p className="text-sm text-slate-300 mt-1">{fmtFecha(ingreso.fecha_ingreso)}</p>
            </div>
          </div>
          <div className="text-right">
            {ingreso.activo ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/20 text-green-300 text-xs font-semibold">
                <UserCheck className="w-3.5 h-3.5" />Activo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-600 text-slate-300 text-xs font-semibold">
                <UserMinus className="w-3.5 h-3.5" />Egresado
              </span>
            )}
            <p className="text-xs text-slate-400 mt-2 capitalize">{ingreso.tipo_atencion.replace('_', ' ')}</p>
          </div>
        </div>
        <div className="mt-3 bg-white/5 rounded-lg px-3 py-2 text-sm text-slate-300">
          {ingreso.motivo_ingreso}
        </div>
      </div>

      {/* Egreso info */}
      {ingreso.egreso_info && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 flex gap-4 items-center">
          <CheckCircle2 className="w-5 h-5 text-slate-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-700">Paciente egresado</p>
            <p className="text-xs text-slate-500">
              {fmtFecha(ingreso.egreso_info.fecha_egreso)} · {TIPO_EGRESO.find(t => t.value === ingreso.egreso_info!.tipo_egreso)?.label}
              {ingreso.egreso_info.diagnostico_egreso && ` · Dx: ${ingreso.egreso_info.diagnostico_egreso}`}
            </p>
          </div>
        </div>
      )}

      {/* Últimos signos vitales */}
      {sv && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Últimos signos vitales</p>
          <div className="flex flex-wrap gap-6">
            {sv.pa_sistolica && sv.pa_diastolica && (
              <div className="text-center">
                <p className="text-lg font-bold text-slate-900">{sv.pa_sistolica}/{sv.pa_diastolica}<span className="text-xs text-slate-400 ml-0.5">mmHg</span></p>
                <p className="text-xs text-slate-500">Tensión</p>
              </div>
            )}
            <SignoVital label="FC" value={sv.fc} unit="lpm" />
            <SignoVital label="FR" value={sv.fr} unit="/min" />
            <SignoVital label="Temp" value={sv.temperatura} unit="°C" />
            <SignoVital label="SpO2" value={sv.spo2} unit="%" />
            <SignoVital label="Peso" value={sv.peso} unit="kg" />
            <SignoVital label="Talla" value={sv.talla} unit="cm" />
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className="flex flex-wrap gap-3 mb-5">
        <button onClick={() => setShowNuevaHC(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <PlusCircle className="w-4 h-4" />Nuevo Registro HC
        </button>
        {ingreso.activo && (
          <button onClick={() => setShowEgreso(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
            <UserMinus className="w-4 h-4" />Registrar Egreso
          </button>
        )}
        <Link href={`/pacientes/${ingreso.paciente}`}>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
            Ver paciente
          </button>
        </Link>
      </div>

      {/* Timeline HC */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <ClipboardList className="w-4 h-4" />Historia Clínica ({historias.length} registros)
        </h2>

        {historias.length === 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
            <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Sin registros. Agrega el primer registro clínico.</p>
          </div>
        )}

        <div className="relative">
          {historias.map((hc, idx) => (
            <div key={hc.id} className="flex gap-4 mb-4">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-blue-500 mt-1 shrink-0" />
                {idx < historias.length - 1 && <div className="w-0.5 flex-1 bg-slate-200 mt-1" />}
              </div>
              <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4 mb-1">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', TIPO_REGISTRO_COLOR[hc.tipo_registro] ?? 'bg-slate-100 text-slate-600')}>
                      {TIPO_REGISTRO_LABEL[hc.tipo_registro] || hc.tipo_registro}
                    </span>
                    {hc.diagnostico_principal && (
                      <span className="ml-2 text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                        Dx: {hc.diagnostico_principal}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">{fmtFecha(hc.fecha_atencion)}</p>
                </div>

                {hc.motivo_consulta && (
                  <div className="mb-2">
                    <p className="text-xs text-slate-400 font-medium">Motivo</p>
                    <p className="text-sm text-slate-700">{hc.motivo_consulta}</p>
                  </div>
                )}
                {hc.examen_fisico && (
                  <div className="mb-2">
                    <p className="text-xs text-slate-400 font-medium">Examen físico</p>
                    <p className="text-sm text-slate-700 whitespace-pre-line">{hc.examen_fisico}</p>
                  </div>
                )}
                {hc.impresion_diagnostica && (
                  <div className="mb-2">
                    <p className="text-xs text-slate-400 font-medium">Impresión diagnóstica</p>
                    <p className="text-sm text-slate-700">{hc.impresion_diagnostica}</p>
                  </div>
                )}
                {hc.plan_tratamiento && (
                  <div className="mb-2">
                    <p className="text-xs text-slate-400 font-medium">Plan</p>
                    <p className="text-sm text-slate-700">{hc.plan_tratamiento}</p>
                  </div>
                )}
                {hc.ordenes_medicas && (
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Órdenes</p>
                    <p className="text-sm text-slate-700">{hc.ordenes_medicas}</p>
                  </div>
                )}
                {hc.signos_vitales && (
                  <div className="mt-2 bg-slate-50 rounded-lg px-3 py-2 flex flex-wrap gap-4 text-xs">
                    {hc.signos_vitales.pa_sistolica && <span>TA: {hc.signos_vitales.pa_sistolica}/{hc.signos_vitales.pa_diastolica} mmHg</span>}
                    {hc.signos_vitales.fc && <span>FC: {hc.signos_vitales.fc} lpm</span>}
                    {hc.signos_vitales.temperatura && <span>T: {hc.signos_vitales.temperatura}°C</span>}
                    {hc.signos_vitales.spo2 && <span>SpO₂: {hc.signos_vitales.spo2}%</span>}
                    {hc.signos_vitales.peso && <span>Peso: {hc.signos_vitales.peso}kg</span>}
                  </div>
                )}
                {hc.medico_nombre && <p className="text-xs text-slate-400 mt-2">Dr. {hc.medico_nombre}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
