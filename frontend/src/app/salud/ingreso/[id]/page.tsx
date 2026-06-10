'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ingresosAPI, notasMedicasAPI, ayudasDiagnosticasAPI,
  programacionCxAPI, mensajeError, medicosAPI,
} from '@/lib/api'
import { Ingreso, NotaMedica, AyudaDiagnostica, ProgramacionCx, MedicoProfesional } from '@/types'
import { PageHeader, Button, Spinner } from '@/components/ui'
import { CupsAutocomplete } from '@/components/ui/CupsAutocomplete'
import { Cie10Autocomplete } from '@/components/ui/Cie10Autocomplete'
import {
  ArrowLeft, FileText, Microscope, Scissors, PlusCircle, Lock, CheckCircle,
  Clock, AlertCircle, Upload, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const TABS = ['Notas médicas', 'Ayudas diagnósticas', 'Programación CX'] as const
type Tab = typeof TABS[number]

const TIPO_NOTA_LABELS: Record<string, string> = {
  ingreso: 'Nota de ingreso', evolucion: 'Evolución médica',
  interconsulta: 'Interconsulta', valoracion: 'Valoración especialidad',
  preoperatoria: 'Valoración preoperatoria', postoperatoria: 'Nota postoperatoria',
  anestesia: 'Valoración anestésica', enfermeria: 'Nota enfermería',
  aclaratoria: 'Nota aclaratoria', epicrisis: 'Epicrisis',
}
const TIPO_AYUDA_LABELS: Record<string, string> = {
  laboratorio: 'Laboratorio', rx: 'Radiografía', ecografia: 'Ecografía',
  tomografia: 'Tomografía (TAC)', resonancia: 'Resonancia (RMN)',
  electrocardiograma: 'Electrocardiograma', ecocardiograma: 'Ecocardiograma',
  endoscopia: 'Endoscopia', biopsia: 'Biopsia/Patología',
  espirometria: 'Espirometría', otro: 'Otro',
}
const ESTADO_CX: Record<string, { label: string; color: string }> = {
  programada: { label: 'Programada', color: 'bg-blue-100 text-blue-700' },
  confirmada: { label: 'Confirmada', color: 'bg-teal-100 text-teal-700' },
  en_curso:   { label: 'En curso',   color: 'bg-amber-100 text-amber-700' },
  realizada:  { label: 'Realizada',  color: 'bg-emerald-100 text-emerald-700' },
  suspendida: { label: 'Suspendida', color: 'bg-orange-100 text-orange-700' },
  cancelada:  { label: 'Cancelada',  color: 'bg-red-100 text-red-700' },
}

// ── Modal Nueva Nota ──────────────────────────────────────────────────────────
function ModalNuevaNota({
  ingresoId, medicos, onClose, onSaved,
}: {
  ingresoId: string
  medicos: MedicoProfesional[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    tipo: 'evolucion', servicio: '', fecha_hora: new Date().toISOString().slice(0, 16),
    subjetivo: '', objetivo: '', analisis: '', plan: '',
    medico: '',
  })
  const [saving, setSaving] = useState(false)

  const save = async (firmar = false) => {
    setSaving(true)
    try {
      const payload = { ...form, ingreso: ingresoId, fecha_hora: form.fecha_hora + ':00' }
      const { data } = await notasMedicasAPI.create(payload)
      if (firmar) await notasMedicasAPI.firmar(data.id)
      toast.success(firmar ? 'Nota guardada y firmada' : 'Nota guardada como borrador')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Nueva nota médica</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-xs">Tipo de nota</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                className="input-base w-full">
                {Object.entries(TIPO_NOTA_LABELS).map(([k, v]) =>
                  <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label-xs">Fecha y hora</label>
              <input type="datetime-local" value={form.fecha_hora}
                onChange={e => setForm(f => ({ ...f, fecha_hora: e.target.value }))}
                className="input-base w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-xs">Médico</label>
              <select value={form.medico} onChange={e => setForm(f => ({ ...f, medico: e.target.value }))}
                className="input-base w-full">
                <option value="">— Seleccionar —</option>
                {medicos.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.nombre_completo}{m.especialidad ? ` (${m.especialidad})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-xs">Servicio / Sala</label>
              <input value={form.servicio}
                onChange={e => setForm(f => ({ ...f, servicio: e.target.value }))}
                placeholder="Ej: Medicina interna, UCI..."
                className="input-base w-full" />
            </div>
          </div>

          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Formato SOAP</p>

          {(['subjetivo', 'objetivo', 'analisis', 'plan'] as const).map(campo => (
            <div key={campo}>
              <label className="label-xs capitalize">
                {campo === 'subjetivo' ? 'S — Subjetivo (síntomas del paciente)' :
                 campo === 'objetivo'  ? 'O — Objetivo (examen físico, paraclínicos)' :
                 campo === 'analisis'  ? 'A — Análisis / impresión diagnóstica' :
                                        'P — Plan de manejo y conducta'}
              </label>
              <textarea
                value={form[campo]}
                onChange={e => setForm(f => ({ ...f, [campo]: e.target.value }))}
                rows={3}
                className="input-base w-full resize-none"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-3 p-5 border-t border-slate-100">
          <Button variant="secondary" onClick={() => save(false)} loading={saving} className="flex-1">
            Guardar borrador
          </Button>
          <Button onClick={() => save(true)} loading={saving} className="flex-1">
            <Lock className="w-4 h-4" /> Guardar y firmar
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Nueva Ayuda ─────────────────────────────────────────────────────────
function ModalNuevaAyuda({
  ingresoId, medicos, onClose, onSaved,
}: {
  ingresoId: string
  medicos: MedicoProfesional[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    tipo: 'laboratorio', descripcion: '', indicacion_clinica: '',
    cups: '', urgente: false, medico_solicitante: '',
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.descripcion.trim()) { toast.error('Ingresa la descripción del examen'); return }
    setSaving(true)
    try {
      await ayudasDiagnosticasAPI.create({ ...form, ingreso: ingresoId })
      toast.success('Ayuda diagnóstica solicitada')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Solicitar ayuda diagnóstica</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-xs">Tipo</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                className="input-base w-full">
                {Object.entries(TIPO_AYUDA_LABELS).map(([k, v]) =>
                  <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label-xs">CUPS (opcional)</label>
              <input value={form.cups}
                onChange={e => setForm(f => ({ ...f, cups: e.target.value }))}
                placeholder="Ej: 902201"
                className="input-base w-full" />
            </div>
          </div>
          <div>
            <label className="label-xs">Descripción / nombre del examen *</label>
            <input value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              placeholder="Ej: Hemograma completo, Ecografía abdominal..."
              className="input-base w-full" />
          </div>
          <div>
            <label className="label-xs">Indicación clínica / justificación</label>
            <textarea value={form.indicacion_clinica}
              onChange={e => setForm(f => ({ ...f, indicacion_clinica: e.target.value }))}
              rows={2} className="input-base w-full resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className="label-xs">Médico solicitante</label>
              <select value={form.medico_solicitante}
                onChange={e => setForm(f => ({ ...f, medico_solicitante: e.target.value }))}
                className="input-base w-full">
                <option value="">— Seleccionar —</option>
                {medicos.map(m => <option key={m.id} value={m.id}>{m.nombre_completo}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer pb-2">
              <input type="checkbox" checked={form.urgente}
                onChange={e => setForm(f => ({ ...f, urgente: e.target.checked }))}
                className="rounded" />
              <span className="text-sm font-medium text-red-600">Urgente</span>
            </label>
          </div>
        </div>
        <div className="p-5 border-t border-slate-100">
          <Button onClick={save} loading={saving} className="w-full">
            <Microscope className="w-4 h-4" /> Solicitar ayuda diagnóstica
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Nueva CX ────────────────────────────────────────────────────────────
function ModalNuevaCx({
  ingresoId, pacienteId, medicos, onClose, onSaved,
}: {
  ingresoId: string
  pacienteId: string
  medicos: MedicoProfesional[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    cups_principal: '', descripcion_cups: '', diagnostico_preop: '',
    desc_diagnostico_preop: '', tipo_cirugia: 'electiva',
    cirujano: '', anestesiologo: '',
    fecha_programada: '', duracion_estimada_min: 60, quirofano: '',
    tipo_anestesia: 'general', numero_autorizacion: '',
    requiere_autorizacion: true, observaciones_preop: '',
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.cups_principal) { toast.error('Ingresa el CUPS del procedimiento'); return }
    if (!form.fecha_programada) { toast.error('Selecciona la fecha programada'); return }
    setSaving(true)
    try {
      await programacionCxAPI.create({
        ...form,
        ingreso: ingresoId,
        paciente: pacienteId,
        fecha_programada: form.fecha_programada + ':00',
      })
      toast.success('Cirugía programada')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  const f = (key: string, val: string | number | boolean) =>
    setForm(prev => ({ ...prev, [key]: val }))

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Programar cirugía</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <CupsAutocomplete
                label="CUPS procedimiento *"
                value={form.cups_principal}
                descripcion={form.descripcion_cups}
                onChange={(cod, desc) => {
                  f('cups_principal', cod)
                  f('descripcion_cups', desc)
                }}
                placeholder="Código o nombre del procedimiento..."
                required
              />
            </div>
            <div>
              <label className="label-xs">Tipo de cirugía</label>
              <select value={form.tipo_cirugia} onChange={e => f('tipo_cirugia', e.target.value)}
                className="input-base w-full">
                <option value="electiva">Electiva</option>
                <option value="urgente">Urgente</option>
                <option value="emergencia">Emergencia</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label-xs">Descripción del procedimiento</label>
            <input value={form.descripcion_cups} onChange={e => f('descripcion_cups', e.target.value)}
              className="input-base w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Cie10Autocomplete
                label="CIE-10 preoperatorio"
                value={form.diagnostico_preop}
                onChange={(cod, nombre) => {
                  f('diagnostico_preop', cod)
                  f('desc_diagnostico_preop', nombre)
                }}
                placeholder="Código o diagnóstico..."
              />
            </div>
            <div>
              <label className="label-xs">Diagnóstico preoperatorio</label>
              <input value={form.desc_diagnostico_preop}
                onChange={e => f('desc_diagnostico_preop', e.target.value)}
                className="input-base w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-xs">Cirujano</label>
              <select value={form.cirujano} onChange={e => f('cirujano', e.target.value)}
                className="input-base w-full">
                <option value="">— Seleccionar —</option>
                {medicos.map(m => <option key={m.id} value={m.id}>{m.nombre_completo}</option>)}
              </select>
            </div>
            <div>
              <label className="label-xs">Anestesiólogo</label>
              <select value={form.anestesiologo} onChange={e => f('anestesiologo', e.target.value)}
                className="input-base w-full">
                <option value="">— Seleccionar —</option>
                {medicos.map(m => <option key={m.id} value={m.id}>{m.nombre_completo}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-xs">Fecha y hora programada *</label>
              <input type="datetime-local" value={form.fecha_programada}
                onChange={e => f('fecha_programada', e.target.value)}
                className="input-base w-full" />
            </div>
            <div>
              <label className="label-xs">Duración estimada (minutos)</label>
              <input type="number" value={form.duracion_estimada_min}
                onChange={e => f('duracion_estimada_min', Number(e.target.value))}
                className="input-base w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-xs">Quirófano</label>
              <input value={form.quirofano} onChange={e => f('quirofano', e.target.value)}
                placeholder="Ej: Quirófano 1" className="input-base w-full" />
            </div>
            <div>
              <label className="label-xs">Tipo de anestesia</label>
              <select value={form.tipo_anestesia} onChange={e => f('tipo_anestesia', e.target.value)}
                className="input-base w-full">
                {['general','regional','local','sedacion','epidural','raquidea','mixta'].map(a =>
                  <option key={a} value={a} className="capitalize">{a.charAt(0).toUpperCase()+a.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label-xs">Número de autorización EPS</label>
            <input value={form.numero_autorizacion}
              onChange={e => f('numero_autorizacion', e.target.value)}
              className="input-base w-full" />
          </div>
          <div>
            <label className="label-xs">Observaciones preoperatorias</label>
            <textarea value={form.observaciones_preop}
              onChange={e => f('observaciones_preop', e.target.value)}
              rows={2} className="input-base w-full resize-none" />
          </div>
        </div>
        <div className="p-5 border-t border-slate-100">
          <Button onClick={save} loading={saving} className="w-full">
            <Scissors className="w-4 h-4" /> Programar cirugía
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function IngresoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const [ingreso, setIngreso]   = useState<Ingreso | null>(null)
  const [notas, setNotas]       = useState<NotaMedica[]>([])
  const [ayudas, setAyudas]     = useState<AyudaDiagnostica[]>([])
  const [cxList, setCxList]     = useState<ProgramacionCx[]>([])
  const [medicos, setMedicos]   = useState<MedicoProfesional[]>([])
  const [tab, setTab]           = useState<Tab>('Notas médicas')
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState<'nota' | 'ayuda' | 'cx' | null>(null)

  const cargar = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [ingresoRes, notasRes, ayudasRes, cxRes, medicosRes] = await Promise.allSettled([
        ingresosAPI.get(id),
        notasMedicasAPI.list({ ingreso: id }),
        ayudasDiagnosticasAPI.list({ ingreso: id }),
        programacionCxAPI.list({ ingreso: id }),
        medicosAPI.list(),
      ])
      if (ingresoRes.status === 'fulfilled') setIngreso(ingresoRes.value.data)
      if (notasRes.status === 'fulfilled')   setNotas(Array.isArray(notasRes.value.data) ? notasRes.value.data : notasRes.value.data.results ?? [])
      if (ayudasRes.status === 'fulfilled')  setAyudas(Array.isArray(ayudasRes.value.data) ? ayudasRes.value.data : ayudasRes.value.data.results ?? [])
      if (cxRes.status === 'fulfilled')      setCxList(Array.isArray(cxRes.value.data) ? cxRes.value.data : cxRes.value.data.results ?? [])
      if (medicosRes.status === 'fulfilled') setMedicos(Array.isArray(medicosRes.value.data) ? medicosRes.value.data : [])
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (!ingreso) return <p className="p-8 text-slate-500">Ingreso no encontrado</p>

  const pacienteId = (ingreso as any).paciente_id ?? (ingreso as any).paciente

  return (
    <div className="page-padding animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/salud/censo">
          <Button variant="ghost" className="px-2"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{(ingreso as any).paciente_nombre}</h1>
          <p className="text-sm text-slate-500">
            Ingreso #{ingreso.numero_ingreso} ·{' '}
            {ingreso.tipo_atencion?.replace('_', ' ')} ·{' '}
            {new Date(ingreso.fecha_ingreso).toLocaleString('es-CO')}
          </p>
        </div>
      </div>

      {/* Motivo */}
      <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 mb-5 text-sm text-slate-700">
        <span className="font-medium text-slate-500 mr-2">Motivo:</span>{ingreso.motivo_ingreso}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-5 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('flex-1 whitespace-nowrap py-2 px-3 rounded-lg text-sm font-medium transition-all',
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Notas médicas ──────────────────────────────────────────────────── */}
      {tab === 'Notas médicas' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setModal('nota')}>
              <PlusCircle className="w-4 h-4" /> Nueva nota
            </Button>
          </div>
          {notas.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">
              Sin notas registradas para este ingreso
            </div>
          )}
          {notas.map(n => (
            <div key={n.id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                    {TIPO_NOTA_LABELS[n.tipo] ?? n.tipo}
                  </span>
                  {n.firmada ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                      <Lock className="w-3 h-3" /> Firmada
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                      <Clock className="w-3 h-3" /> Borrador
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(n.fecha_hora).toLocaleString('es-CO')}
                </span>
              </div>
              {n.medico_info && (
                <p className="text-xs text-slate-500 mb-2">
                  Dr(a). {n.medico_info.nombre_completo}
                  {n.especialidad_nota && ` · ${n.especialidad_nota}`}
                  {n.tarjeta_prof_nota && ` · TP ${n.tarjeta_prof_nota}`}
                  {n.servicio && ` · ${n.servicio}`}
                </p>
              )}
              {n.subjetivo  && <p className="text-sm mb-1"><span className="font-semibold text-slate-600">S:</span> {n.subjetivo}</p>}
              {n.objetivo   && <p className="text-sm mb-1"><span className="font-semibold text-slate-600">O:</span> {n.objetivo}</p>}
              {n.analisis   && <p className="text-sm mb-1"><span className="font-semibold text-slate-600">A:</span> {n.analisis}</p>}
              {n.plan       && <p className="text-sm"><span className="font-semibold text-slate-600">P:</span> {n.plan}</p>}
            </div>
          ))}
        </div>
      )}

      {/* ── Ayudas diagnósticas ─────────────────────────────────────────────── */}
      {tab === 'Ayudas diagnósticas' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setModal('ayuda')}>
              <PlusCircle className="w-4 h-4" /> Solicitar ayuda
            </Button>
          </div>
          {ayudas.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">
              Sin ayudas diagnósticas solicitadas
            </div>
          )}
          {ayudas.map(a => (
            <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Microscope className="w-4 h-4 text-halu-600" />
                  <span className="font-medium text-slate-800">
                    {TIPO_AYUDA_LABELS[a.tipo] ?? a.tipo}
                  </span>
                  {a.urgente && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
                      URGENTE
                    </span>
                  )}
                </div>
                <EstadoAyudaBadge estado={a.estado} />
              </div>
              <p className="text-sm text-slate-700 mb-1">{a.descripcion}</p>
              {a.cups && <p className="text-xs text-slate-400">CUPS: {a.cups}</p>}
              {a.indicacion_clinica && (
                <p className="text-xs text-slate-500 mt-1">Indicación: {a.indicacion_clinica}</p>
              )}
              {/* Resultado */}
              {a.resultado && (
                <div className="mt-3 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                  <p className="text-xs font-semibold text-emerald-700 mb-1 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Resultado disponible
                  </p>
                  {a.resultado.resultado_texto && (
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{a.resultado.resultado_texto}</p>
                  )}
                  {a.resultado.interpretacion && (
                    <p className="text-xs text-slate-600 mt-1">
                      <span className="font-medium">Interpretación:</span> {a.resultado.interpretacion}
                    </p>
                  )}
                  {a.resultado.archivo_url && (
                    <a href={a.resultado.archivo_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-xs text-halu-600 underline">
                      <Upload className="w-3 h-3" /> Ver archivo adjunto
                    </a>
                  )}
                </div>
              )}
              {/* Cargar resultado si no tiene */}
              {!a.resultado && a.estado !== 'cancelada' && (
                <ResultadoForm ayudaId={a.id} onSaved={cargar} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Programación CX ─────────────────────────────────────────────────── */}
      {tab === 'Programación CX' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setModal('cx')}>
              <PlusCircle className="w-4 h-4" /> Programar cirugía
            </Button>
          </div>
          {cxList.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">
              Sin cirugías programadas para este ingreso
            </div>
          )}
          {cxList.map(cx => {
            const estadoBadge = ESTADO_CX[cx.estado] ?? ESTADO_CX.programada
            return (
              <div key={cx.id} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', estadoBadge.color)}>
                        {estadoBadge.label}
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        CX-{String(cx.numero_cx).padStart(5, '0')}
                      </span>
                    </div>
                    <p className="font-medium text-slate-900">
                      {cx.descripcion_cups || cx.cups_principal}
                    </p>
                  </div>
                  <Link href={`/salud/cx/${cx.id}/descripcion`}>
                    <Button variant="secondary" className="text-xs py-1 px-2">
                      <FileText className="w-3.5 h-3.5" /> Informe operatorio
                    </Button>
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 mt-2">
                  <span>📅 {new Date(cx.fecha_programada).toLocaleString('es-CO')}</span>
                  {cx.quirofano && <span>🏥 {cx.quirofano}</span>}
                  {cx.cirujano_info && <span>👨‍⚕️ {cx.cirujano_info.nombre_completo}</span>}
                  {cx.anestesiologo_info && <span>💉 {cx.anestesiologo_info.nombre_completo}</span>}
                  <span>Anestesia: {cx.tipo_anestesia}</span>
                  {cx.numero_autorizacion && <span>Auth: {cx.numero_autorizacion}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modales */}
      {modal === 'nota'  && <ModalNuevaNota  ingresoId={id} medicos={medicos} onClose={() => setModal(null)} onSaved={() => { setModal(null); cargar() }} />}
      {modal === 'ayuda' && <ModalNuevaAyuda ingresoId={id} medicos={medicos} onClose={() => setModal(null)} onSaved={() => { setModal(null); cargar() }} />}
      {modal === 'cx'    && <ModalNuevaCx    ingresoId={id} pacienteId={String(pacienteId)} medicos={medicos} onClose={() => setModal(null)} onSaved={() => { setModal(null); cargar() }} />}
    </div>
  )
}

function EstadoAyudaBadge({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    solicitada: 'bg-blue-100 text-blue-700',
    tomada:     'bg-amber-100 text-amber-700',
    resultado:  'bg-emerald-100 text-emerald-700',
    cancelada:  'bg-slate-100 text-slate-500',
  }
  const labels: Record<string, string> = {
    solicitada: 'Solicitada', tomada: 'Procesada', resultado: 'Con resultado', cancelada: 'Cancelada',
  }
  return (
    <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', map[estado] ?? map.solicitada)}>
      {labels[estado] ?? estado}
    </span>
  )
}

function ResultadoForm({ ayudaId, onSaved }: { ayudaId: string; onSaved: () => void }) {
  const [open, setOpen]   = useState(false)
  const [form, setForm]   = useState({ resultado_texto: '', interpretacion: '', conclusion: '', fecha_resultado: new Date().toISOString().slice(0, 16) })
  const [file, setFile]   = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="mt-2 flex items-center gap-1.5 text-xs text-halu-600 hover:underline">
      <Upload className="w-3.5 h-3.5" /> Cargar resultado
    </button>
  )

  const save = async () => {
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('fecha_resultado', form.fecha_resultado + ':00')
      fd.append('resultado_texto', form.resultado_texto)
      fd.append('interpretacion', form.interpretacion)
      fd.append('conclusion', form.conclusion)
      if (file) fd.append('archivo', file)
      await ayudasDiagnosticasAPI.cargarResultado(ayudaId, fd)
      toast.success('Resultado cargado')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="mt-3 border border-slate-100 rounded-xl p-3 bg-slate-50 space-y-2">
      <p className="text-xs font-semibold text-slate-600">Cargar resultado</p>
      <input type="datetime-local" value={form.fecha_resultado}
        onChange={e => setForm(f => ({ ...f, fecha_resultado: e.target.value }))}
        className="input-base w-full text-sm" />
      <textarea placeholder="Texto del resultado / informe" value={form.resultado_texto}
        onChange={e => setForm(f => ({ ...f, resultado_texto: e.target.value }))}
        rows={2} className="input-base w-full text-sm resize-none" />
      <textarea placeholder="Interpretación clínica" value={form.interpretacion}
        onChange={e => setForm(f => ({ ...f, interpretacion: e.target.value }))}
        rows={2} className="input-base w-full text-sm resize-none" />
      <div>
        <label className="text-xs text-slate-500 mb-1 block">Adjuntar archivo (imagen, PDF, eco...)</label>
        <input type="file" accept="image/*,application/pdf"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
          className="text-xs" />
      </div>
      <div className="flex gap-2">
        <Button onClick={save} loading={saving} className="flex-1 text-sm">Guardar resultado</Button>
        <Button variant="ghost" onClick={() => setOpen(false)} className="text-sm px-3">Cancelar</Button>
      </div>
    </div>
  )
}
