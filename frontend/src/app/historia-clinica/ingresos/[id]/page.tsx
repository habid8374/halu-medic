'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { ingresosAPI, historiaAPI, medicamentosHCAPI, catalogoMedicamentosAPI, cie10API, ordenesHCAPI, descripcionQxAPI, liquidacionCxAPI, ayudasDiagnosticasAPI, prefacturaAPI, mensajeError } from '@/lib/api'
import { Ingreso, HistoriaClinica } from '@/types'
import { Button, Card, Spinner } from '@/components/ui'
import { CupsAutocomplete } from '@/components/ui/CupsAutocomplete'
import { EpicrisisModal } from '@/components/ui/EpicrisisModal'
import {
  ArrowLeft, UserCheck, UserMinus, PlusCircle, ClipboardList,
  Heart, Thermometer, Activity, Scale, CheckCircle2, Pill, Trash2, Search, X,
  FlaskConical, Stethoscope, Scissors, FileText, AlertCircle, Printer,
  ChevronDown, ChevronRight, FlaskRound,
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

const VIA_CHOICES = [
  { value: 'oral', label: 'Oral' }, { value: 'iv', label: 'IV' },
  { value: 'im', label: 'IM' }, { value: 'sc', label: 'SC' },
  { value: 'topica', label: 'Tópica' }, { value: 'inhalatoria', label: 'Inhalatoria' },
  { value: 'sublingual', label: 'Sublingual' }, { value: 'rectal', label: 'Rectal' },
  { value: 'otra', label: 'Otra' },
]

interface MedItem {
  cum: string
  principio_activo: string
  concentracion: string
  forma_farmaceutica: string
  dosis: string
  frecuencia: string
  via_administracion: string
  cantidad: number
  dias_tratamiento: number
  indicaciones: string
}

interface OrdenItem {
  tipo: string
  cups: string
  descripcion_cups: string
  cie10_justificacion: string
  desc_cie10: string
  cantidad: number
  urgente: boolean
  indicacion: string
  genera_factura: boolean
  valor_unitario: number
}

const TIPOS_ORDEN = [
  { value: 'procedimiento',        label: 'Procedimiento',          icon: '🔬' },
  { value: 'cirugia',              label: 'Cirugía',                icon: '🏥' },
  { value: 'consulta_especializada', label: 'Consulta especializada', icon: '👨‍⚕️' },
  { value: 'laboratorio',          label: 'Laboratorio',            icon: '🧪' },
  { value: 'imagen',               label: 'Imagen diagnóstica',     icon: '📷' },
  { value: 'interconsulta',        label: 'Interconsulta',          icon: '🔄' },
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

function BuscadorMedicamento({ onSelect }: { onSelect: (med: any) => void }) {
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<any[]>([])
  const [buscando, setBuscando] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const buscar = (texto: string) => {
    setQ(texto)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (texto.length < 2) { setResultados([]); return }
    timerRef.current = setTimeout(async () => {
      setBuscando(true)
      try {
        const { data } = await catalogoMedicamentosAPI.search(texto)
        setResultados(Array.isArray(data) ? data : data.results ?? [])
      } catch { setResultados([]) } finally { setBuscando(false) }
    }, 300)
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-2">
        {buscando ? <Spinner size="sm" /> : <Search className="w-4 h-4 text-slate-400" />}
        <input
          type="text" value={q} onChange={e => buscar(e.target.value)}
          placeholder="Buscar por nombre o CUM…"
          className="flex-1 text-sm focus:outline-none"
        />
        {q && <button type="button" onClick={() => { setQ(''); setResultados([]) }}><X className="w-4 h-4 text-slate-400" /></button>}
      </div>
      {resultados.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-10 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
          {resultados.map(r => (
            <button key={r.cum} type="button"
              className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-slate-100 last:border-0"
              onClick={() => { onSelect(r); setQ(''); setResultados([]) }}>
              <p className="text-sm font-medium text-slate-900">{r.principio_activo}</p>
              <p className="text-xs text-slate-500">{r.cum}{r.concentracion ? ` · ${r.concentracion}` : ''}{r.forma_farmaceutica ? ` · ${r.forma_farmaceutica}` : ''}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function BuscadorCIE10({ value, nombre, onChange }: {
  value: string
  nombre?: string
  onChange: (codigo: string, nombre: string) => void
}) {
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<any[]>([])
  const [buscando, setBuscando] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const buscar = (texto: string) => {
    setQ(texto)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (texto.length < 2) { setResultados([]); setAbierto(false); return }
    timerRef.current = setTimeout(async () => {
      setBuscando(true)
      try {
        const { data } = await cie10API.buscar(texto)
        const items = Array.isArray(data) ? data : data.results ?? []
        setResultados(items)
        setAbierto(items.length > 0)
      } catch { setResultados([]) } finally { setBuscando(false) }
    }, 300)
  }

  const seleccionar = (item: any) => {
    onChange(item.codigo, item.nombre)
    setQ('')
    setResultados([])
    setAbierto(false)
  }

  return (
    <div className="relative">
      {value && (
        <div className="flex items-center gap-2 mb-1.5 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
          <span className="text-xs font-bold text-purple-700 shrink-0">{value}</span>
          {nombre && <span className="text-xs text-purple-700 flex-1 truncate">{nombre}</span>}
          <button type="button" onClick={() => onChange('', '')} className="text-purple-400 hover:text-purple-600 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-2">
        {buscando ? <Spinner size="sm" /> : <Search className="w-4 h-4 text-slate-400" />}
        <input
          type="text" value={q} onChange={e => buscar(e.target.value)}
          placeholder={value ? 'Cambiar diagnóstico…' : 'Código o nombre (ej: J06, hipertensión…)'}
          className="flex-1 text-sm focus:outline-none"
        />
        {q && <button type="button" onClick={() => { setQ(''); setResultados([]); setAbierto(false) }}><X className="w-4 h-4 text-slate-400" /></button>}
      </div>
      {abierto && resultados.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-20 bg-white border border-slate-200 rounded-lg shadow-xl mt-1 max-h-52 overflow-y-auto">
          {resultados.map(r => (
            <button key={r.codigo} type="button"
              className="w-full text-left px-4 py-2.5 hover:bg-purple-50 border-b border-slate-100 last:border-0"
              onClick={() => seleccionar(r)}>
              <span className="text-xs font-bold text-purple-700 mr-2">{r.codigo}</span>
              <span className="text-sm text-slate-800">{r.nombre}</span>
              {r.descripcion && <p className="text-xs text-slate-400 mt-0.5 truncate">{r.descripcion}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ModalEgreso({ onClose, onConfirm, ingresoId }: {
  onClose: () => void
  onConfirm: (data: Record<string, unknown>) => Promise<void>
  ingresoId: string
}) {
  const [form, setForm] = useState({
    fecha_egreso: new Date().toISOString().slice(0, 16),
    tipo_egreso: 'alta_medica',
    diagnostico_egreso: '',
    diagnostico_egreso_nombre: '',
    condicion_al_egreso: '',
    indicaciones_alta: '',
    observaciones: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      const { indicaciones_alta, diagnostico_egreso_nombre, ...rest } = form
      await onConfirm({ ...rest, indicaciones_alta })
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Registrar Egreso</h2>
          <p className="text-xs text-slate-500 mt-0.5">Completar para dar de alta al paciente</p>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha egreso *</label>
              <input type="datetime-local"
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-xs font-medium text-slate-600 mb-1">Diagnóstico de egreso (CIE-10)</label>
            <BuscadorCIE10
              value={form.diagnostico_egreso}
              nombre={form.diagnostico_egreso_nombre}
              onChange={(codigo, nombre) => setForm(f => ({ ...f, diagnostico_egreso: codigo, diagnostico_egreso_nombre: nombre }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Condición al egreso</label>
            <textarea rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              value={form.condicion_al_egreso} onChange={e => set('condicion_al_egreso', e.target.value)}
              placeholder="Estado del paciente al momento del egreso..." />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Indicaciones de alta</label>
            <textarea rows={3} className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              value={form.indicaciones_alta} onChange={e => set('indicaciones_alta', e.target.value)}
              placeholder="Medicamentos, cuidados, dieta, cita de control..." />
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? <Spinner size="sm" /> : <CheckCircle2 className="w-4 h-4" />}
              {saving ? 'Guardando…' : 'Confirmar Egreso'}
            </Button>
            {form.diagnostico_egreso && (
              <a
                href={`/historia-clinica/ingresos/${ingresoId}/egreso`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Orden de salida
              </a>
            )}
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
  const [medicamentos, setMedicamentos] = useState<MedItem[]>([])
  const [ordenes, setOrdenes] = useState<OrdenItem[]>([])
  const [dx1nombre, setDx1nombre] = useState('')
  const [saving, setSaving] = useState(false)
  const [nuevaOrden, setNuevaOrden] = useState<OrdenItem>({
    tipo: 'procedimiento', cups: '', descripcion_cups: '',
    cie10_justificacion: '', desc_cie10: '', cantidad: 1,
    urgente: false, indicacion: '', genera_factura: false, valor_unitario: 0,
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const agregarMed = (cum: any) => {
    setMedicamentos(prev => [...prev, {
      cum: cum.cum,
      principio_activo: cum.principio_activo,
      concentracion: cum.concentracion || '',
      forma_farmaceutica: cum.forma_farmaceutica || '',
      dosis: '', frecuencia: '', via_administracion: 'oral',
      cantidad: 1, dias_tratamiento: 1, indicaciones: '',
    }])
  }

  const actualizarMed = (i: number, k: keyof MedItem, v: string | number) => {
    setMedicamentos(prev => prev.map((m, idx) => idx === i ? { ...m, [k]: v } : m))
  }

  const eliminarMed = (i: number) => setMedicamentos(prev => prev.filter((_, idx) => idx !== i))

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
      const { data: hc } = await historiaAPI.create({
        paciente: pacienteId, ingreso: ingresoId,
        fecha_atencion: form.fecha_atencion, tipo_registro: form.tipo_registro,
        motivo_consulta: form.motivo_consulta, anamnesis: form.anamnesis,
        enfermedad_actual: form.enfermedad_actual, examen_fisico: form.examen_fisico,
        impresion_diagnostica: form.impresion_diagnostica,
        diagnostico_principal: form.diagnostico_principal,
        plan_tratamiento: form.plan_tratamiento, ordenes_medicas: form.ordenes_medicas,
        signos_vitales: Object.keys(sv).length > 0 ? sv : null,
      })
      // Guardar medicamentos y órdenes en paralelo
      await Promise.all([
        ...medicamentos.map(m => medicamentosHCAPI.create({ historia: hc.id, ...m })),
        ...ordenes.map(o => ordenesHCAPI.create({ historia: hc.id, ...o })),
      ])
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
            <label className="block text-xs font-medium text-slate-600 mb-1">Diagnóstico principal (CIE-10)</label>
            <BuscadorCIE10
              value={form.diagnostico_principal}
              nombre={dx1nombre}
              onChange={(codigo, nombre) => { set('diagnostico_principal', codigo); setDx1nombre(nombre) }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Plan de tratamiento</label>
            <textarea rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              value={form.plan_tratamiento} onChange={e => set('plan_tratamiento', e.target.value)} />
          </div>

          {/* ── Órdenes médicas estructuradas ── */}
          <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/30">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="w-4 h-4 text-blue-600" />
              <p className="text-sm font-semibold text-slate-700">Órdenes médicas</p>
              {ordenes.length > 0 && (
                <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{ordenes.length}</span>
              )}
            </div>

            {/* Selector de tipo */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {TIPOS_ORDEN.map(t => (
                <button key={t.value} type="button"
                  onClick={() => setNuevaOrden(o => ({ ...o, tipo: t.value }))}
                  className={clsx('text-xs px-2.5 py-1 rounded-full border transition-all',
                    nuevaOrden.tipo === t.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300')}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* CUPS con autocomplete */}
            <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
              <CupsAutocomplete
                label="CUPS (código del servicio)"
                value={nuevaOrden.cups}
                descripcion={nuevaOrden.descripcion_cups}
                onChange={(cod, desc) => setNuevaOrden(o => ({ ...o, cups: cod, descripcion_cups: desc }))}
                placeholder="Buscar por código o nombre..."
              />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-slate-500 mb-0.5">CIE-10 justificación</label>
                  <input type="text" maxLength={10}
                    placeholder="Ej: J06.9"
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={nuevaOrden.cie10_justificacion}
                    onChange={e => setNuevaOrden(o => ({ ...o, cie10_justificacion: e.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-0.5">Cantidad</label>
                  <input type="number" min={1}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={nuevaOrden.cantidad}
                    onChange={e => setNuevaOrden(o => ({ ...o, cantidad: Number(e.target.value) }))} />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={nuevaOrden.urgente}
                      onChange={e => setNuevaOrden(o => ({ ...o, urgente: e.target.checked }))}
                      className="accent-red-500" />
                    Urgente
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer mt-1">
                    <input type="checkbox" checked={nuevaOrden.genera_factura}
                      onChange={e => setNuevaOrden(o => ({ ...o, genera_factura: e.target.checked }))}
                      className="accent-blue-500" />
                    Facturar
                  </label>
                </div>
              </div>
              {nuevaOrden.genera_factura && (
                <div>
                  <label className="block text-xs text-slate-500 mb-0.5">Valor unitario $</label>
                  <input type="number" min={0}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={nuevaOrden.valor_unitario}
                    onChange={e => setNuevaOrden(o => ({ ...o, valor_unitario: Number(e.target.value) }))} />
                </div>
              )}
              <div>
                <label className="block text-xs text-slate-500 mb-0.5">Indicación clínica</label>
                <input type="text" placeholder="Justificación médica..."
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={nuevaOrden.indicacion}
                  onChange={e => setNuevaOrden(o => ({ ...o, indicacion: e.target.value }))} />
              </div>
              <button type="button"
                disabled={!nuevaOrden.cups && !nuevaOrden.descripcion_cups}
                onClick={() => {
                  if (!nuevaOrden.cups && !nuevaOrden.descripcion_cups) return
                  setOrdenes(prev => [...prev, { ...nuevaOrden }])
                  setNuevaOrden(o => ({ ...o, cups: '', descripcion_cups: '', cie10_justificacion: '', indicacion: '', cantidad: 1, urgente: false, genera_factura: false, valor_unitario: 0 }))
                }}
                className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-all">
                + Agregar orden
              </button>
            </div>

            {/* Lista de órdenes agregadas */}
            {ordenes.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {ordenes.map((o, i) => (
                  <div key={i} className="flex items-start gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                          {TIPOS_ORDEN.find(t => t.value === o.tipo)?.icon} {TIPOS_ORDEN.find(t => t.value === o.tipo)?.label}
                        </span>
                        {o.cups && <span className="text-xs font-mono text-slate-600">{o.cups}</span>}
                        {o.urgente && <span className="text-xs text-red-600 font-semibold">🚨 Urgente</span>}
                        {o.genera_factura && <span className="text-xs text-emerald-600">💰 Facturar</span>}
                      </div>
                      <p className="text-xs text-slate-700 mt-0.5">{o.descripcion_cups}</p>
                      {o.cie10_justificacion && <p className="text-xs text-slate-400">DX: {o.cie10_justificacion}</p>}
                    </div>
                    <button type="button" onClick={() => setOrdenes(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-red-400 hover:text-red-600 flex-shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Medicamentos */}
          <div className="border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Pill className="w-4 h-4 text-emerald-600" />
              <p className="text-sm font-semibold text-slate-700">Medicamentos prescritos</p>
              {medicamentos.length > 0 && (
                <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                  {medicamentos.length}
                </span>
              )}
            </div>
            <BuscadorMedicamento onSelect={agregarMed} />

            {medicamentos.length > 0 && (
              <div className="mt-3 space-y-3">
                {medicamentos.map((m, i) => (
                  <div key={i} className="bg-slate-50 rounded-xl p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{m.principio_activo}</p>
                        <p className="text-xs text-slate-500">{m.cum}{m.concentracion ? ` · ${m.concentracion}` : ''}</p>
                      </div>
                      <button type="button" onClick={() => eliminarMed(i)}
                        className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">Dosis</label>
                        <input type="text" placeholder="Ej: 500 mg"
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={m.dosis} onChange={e => actualizarMed(i, 'dosis', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">Frecuencia</label>
                        <input type="text" placeholder="Ej: cada 8 horas"
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={m.frecuencia} onChange={e => actualizarMed(i, 'frecuencia', e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">Vía</label>
                        <select className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={m.via_administracion} onChange={e => actualizarMed(i, 'via_administracion', e.target.value)}>
                          {VIA_CHOICES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">Cantidad</label>
                        <input type="number" min={1}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={m.cantidad} onChange={e => actualizarMed(i, 'cantidad', Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">Días tto.</label>
                        <input type="number" min={1}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={m.dias_tratamiento} onChange={e => actualizarMed(i, 'dias_tratamiento', Number(e.target.value))} />
                      </div>
                    </div>
                    <div className="mt-2">
                      <label className="block text-xs text-slate-500 mb-0.5">Indicaciones</label>
                      <input type="text" placeholder="Indicaciones adicionales"
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={m.indicaciones} onChange={e => actualizarMed(i, 'indicaciones', e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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

function fmtCOP(n: number | string | null | undefined) {
  if (n == null) return '—'
  const num = typeof n === 'string' ? parseFloat(n) : n
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num)
}

function Acordeon({ titulo, icono, badge, children }: {
  titulo: string; icono: React.ReactNode; badge?: number; children: React.ReactNode
}) {
  const [abierto, setAbierto] = useState(false)
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden mb-4">
      <button
        type="button"
        onClick={() => setAbierto(a => !a)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left"
      >
        <span className="text-slate-600">{icono}</span>
        <span className="text-sm font-semibold text-slate-800 flex-1">{titulo}</span>
        {badge !== undefined && badge > 0 && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{badge}</span>
        )}
        {abierto ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
      </button>
      {abierto && <div className="border-t border-slate-100 p-4">{children}</div>}
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
  const [showEpicrisis, setShowEpicrisis] = useState(false)
  const [showPrefacturaPrompt, setShowPrefacturaPrompt] = useState(false)
  const [egresoData, setEgresoData] = useState<Record<string, unknown> | null>(null)
  const [dqxList, setDqxList]             = useState<any[]>([])
  const [liquidaciones, setLiquidaciones] = useState<any[]>([])
  const [ayudas, setAyudas]               = useState<any[]>([])

  const cargar = () => {
    Promise.all([
      ingresosAPI.get(id),
      historiaAPI.list({ ingreso: id }),
      descripcionQxAPI.list({ ingreso: id } as any).catch(() => ({ data: [] })),
      liquidacionCxAPI.list({ ingreso: id }).catch(() => ({ data: [] })),
      ayudasDiagnosticasAPI.list({ ingreso: id } as any).catch(() => ({ data: [] })),
    ]).then(([{ data: ing }, { data: hc }, { data: dqx }, { data: liq }, { data: ay }]) => {
      setIngreso(ing)
      setHistorias(Array.isArray(hc) ? hc : hc.results ?? [])
      setDqxList(Array.isArray(dqx) ? dqx : (dqx as any).results ?? [])
      setLiquidaciones(Array.isArray(liq) ? liq : (liq as any).results ?? [])
      setAyudas(Array.isArray(ay) ? ay : (ay as any).results ?? [])
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [id])

  const confirmarEgreso = async (data: Record<string, unknown>) => {
    await ingresosAPI.egresar(id, data)
    toast.success('Paciente egresado correctamente')
    setShowEgreso(false)
    setEgresoData(data)
    cargar()
    setShowPrefacturaPrompt(true)
  }

  const crearPrefacturaDesdeEgreso = async () => {
    setShowPrefacturaPrompt(false)
    try {
      const hoy = new Date().toISOString().split('T')[0]
      const { data: pre } = await prefacturaAPI.create({
        paciente: ingreso!.paciente,
        ingreso: id,
        fecha_inicio: (ingreso!.fecha_ingreso || hoy).split('T')[0],
        fecha_fin: hoy,
      })
      try { await prefacturaAPI.autocargar(pre.id) } catch { /* autocarga manual luego */ }
      window.location.href = `/facturacion/prefactura/${pre.id}`
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { prefactura_existente?: string | string[] } } })?.response?.data
      const existente = Array.isArray(detail?.prefactura_existente) ? detail?.prefactura_existente[0] : detail?.prefactura_existente
      if (existente) {
        window.location.href = `/facturacion/prefactura/${existente}`
      } else {
        toast.error(mensajeError(e))
      }
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (!ingreso) return <div className="page-padding"><p className="text-red-600">Ingreso no encontrado</p></div>

  const sv = historias.find(h => h.signos_vitales)?.signos_vitales

  return (
    <div className="page-padding max-w-4xl animate-fade-in">
      {showEgreso && <ModalEgreso ingresoId={id} onClose={() => setShowEgreso(false)} onConfirm={confirmarEgreso} />}
      {showPrefacturaPrompt && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">Cuenta médica del episodio</p>
                <p className="text-xs text-slate-500 mt-0.5">¿Deseas generar la prefactura de este ingreso ahora?</p>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={crearPrefacturaDesdeEgreso}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors"
              >
                <FileText className="w-4 h-4" />
                Generar prefactura
              </button>
              <button
                onClick={() => setShowPrefacturaPrompt(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Ahora no
              </button>
            </div>
          </div>
        </div>
      )}
      {showNuevaHC && (
        <ModalNuevaHC
          ingresoId={id} pacienteId={ingreso.paciente}
          onClose={() => setShowNuevaHC(false)}
          onCreated={() => { setShowNuevaHC(false); cargar() }}
        />
      )}
      {showEpicrisis && (
        <EpicrisisModal
          ingresoId={id}
          pacienteNombre={ingreso?.paciente_nombre}
          onClose={() => setShowEpicrisis(false)}
          onSaved={() => { setShowEpicrisis(false); cargar() }}
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
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-700">Paciente egresado</p>
            <p className="text-xs text-slate-500">
              {fmtFecha(ingreso.egreso_info.fecha_egreso)} · {TIPO_EGRESO.find(t => t.value === ingreso.egreso_info!.tipo_egreso)?.label}
              {ingreso.egreso_info.diagnostico_egreso && ` · Dx: ${ingreso.egreso_info.diagnostico_egreso}`}
            </p>
          </div>
          <a
            href={`/historia-clinica/ingresos/${id}/egreso`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-600 hover:bg-white transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Orden de salida
          </a>
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
        <button onClick={() => setShowEpicrisis(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
          <FileText className="w-4 h-4" />Epicrisis
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
        <button
          onClick={() => window.open(`/historia-clinica/ingresos/${id}/imprimir`, '_blank')}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
          <Printer className="w-4 h-4" />Imprimir HC
        </button>
      </div>

      {/* ── Descripciones Quirúrgicas ── */}
      <Acordeon
        titulo={`Descripciones Quirúrgicas (DQX)${dqxList.length === 0 ? ' — sin registros' : ''}`}
        icono={<Scissors className="w-4 h-4" />}
        badge={dqxList.length}
      >
        {dqxList.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-2">No hay descripciones quirúrgicas registradas para este ingreso.</p>
        ) : (
          <div className="space-y-3">
            {dqxList.map((dqx: any) => (
              <div key={dqx.id} className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                      DQX-{String(dqx.numero_dqx).padStart(5, '0')}
                    </span>
                    {dqx.cups_principal && (
                      <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{dqx.cups_principal}</span>
                    )}
                    {dqx.firmada ? (
                      <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Firmada</span>
                    ) : (
                      <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Borrador</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">{dqx.fecha_hora_inicio ? fmtFecha(dqx.fecha_hora_inicio) : ''}</p>
                </div>
                {dqx.descripcion_procedimiento && (
                  <p className="text-sm font-medium text-slate-800 mb-1">{dqx.descripcion_procedimiento}</p>
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 mt-2">
                  {dqx.cirujano_nombre && <span><strong>Cirujano:</strong> {dqx.cirujano_nombre}</span>}
                  {dqx.anestesiologo_nombre && <span><strong>Anestesiólogo:</strong> {dqx.anestesiologo_nombre}</span>}
                  {dqx.tipo_anestesia && <span><strong>Anestesia:</strong> {dqx.tipo_anestesia}</span>}
                  {dqx.quirofano && <span><strong>Quirófano:</strong> {dqx.quirofano}</span>}
                  {dqx.diagnostico_postoperatorio && <span><strong>Dx post-op:</strong> {dqx.diagnostico_postoperatorio} {dqx.desc_diag_postop}</span>}
                  {dqx.sangrado_estimado_ml && <span><strong>Sangrado:</strong> {dqx.sangrado_estimado_ml} ml</span>}
                </div>
                {dqx.hallazgos && (
                  <div className="mt-2">
                    <p className="text-xs text-slate-400 font-medium">Hallazgos</p>
                    <p className="text-xs text-slate-700 whitespace-pre-line">{dqx.hallazgos}</p>
                  </div>
                )}
                {dqx.complicaciones && (
                  <div className="mt-2 bg-red-50 rounded-lg px-3 py-2">
                    <p className="text-xs font-medium text-red-700">Complicaciones</p>
                    <p className="text-xs text-red-800">{dqx.complicaciones}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Acordeon>

      {/* ── Liquidaciones de Cirugía ── */}
      <Acordeon
        titulo={`Liquidación de Cirugía (CX)${liquidaciones.length === 0 ? ' — sin registros' : ''}`}
        icono={<FileText className="w-4 h-4" />}
        badge={liquidaciones.length}
      >
        {liquidaciones.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-2">No hay liquidaciones registradas para este ingreso.</p>
        ) : (
          <div className="space-y-4">
            {liquidaciones.map((liq: any) => (
              <div key={liq.id} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50">
                  <span className={clsx(
                    'text-xs px-2 py-0.5 rounded-full font-medium',
                    liq.estado === 'finalizada' ? 'bg-green-100 text-green-700' :
                    liq.estado === 'facturada' ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  )}>{liq.estado}</span>
                  <span className="text-xs text-slate-500">{liq.tipo_tarifario} · {liq.tipo_liquidacion?.replace(/_/g, ' ')}</span>
                  <span className="ml-auto text-sm font-bold text-slate-900">{fmtCOP(liq.total_general)}</span>
                </div>
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="text-center bg-blue-50 rounded-lg p-2">
                    <p className="text-xs text-slate-500 mb-0.5">Cirujano</p>
                    <p className="text-sm font-bold text-blue-800">{fmtCOP(liq.total_cirujano)}</p>
                  </div>
                  <div className="text-center bg-purple-50 rounded-lg p-2">
                    <p className="text-xs text-slate-500 mb-0.5">Anestesiólogo</p>
                    <p className="text-sm font-bold text-purple-800">{fmtCOP(liq.total_anestesiologo)}</p>
                  </div>
                  <div className="text-center bg-orange-50 rounded-lg p-2">
                    <p className="text-xs text-slate-500 mb-0.5">Ayudante</p>
                    <p className="text-sm font-bold text-orange-800">{fmtCOP(liq.total_ayudante)}</p>
                  </div>
                  <div className="text-center bg-teal-50 rounded-lg p-2">
                    <p className="text-xs text-slate-500 mb-0.5">Quirófano</p>
                    <p className="text-sm font-bold text-teal-800">{fmtCOP(liq.total_quirofano)}</p>
                  </div>
                  <div className="text-center bg-slate-50 rounded-lg p-2">
                    <p className="text-xs text-slate-500 mb-0.5">Materiales</p>
                    <p className="text-sm font-bold text-slate-800">{fmtCOP(liq.total_materiales)}</p>
                  </div>
                  <div className="text-center bg-green-50 rounded-lg p-2 col-span-2 sm:col-span-1">
                    <p className="text-xs text-slate-500 mb-0.5">Total general</p>
                    <p className="text-base font-extrabold text-green-800">{fmtCOP(liq.total_general)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Acordeon>

      {/* ── Ayudas Diagnósticas ── */}
      <Acordeon
        titulo={`Ayudas Diagnósticas${ayudas.length === 0 ? ' — sin registros' : ''}`}
        icono={<FlaskConical className="w-4 h-4" />}
        badge={ayudas.length}
      >
        {ayudas.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-2">No hay ayudas diagnósticas registradas para este ingreso.</p>
        ) : (
          <div className="space-y-2">
            {ayudas.map((ay: any) => (
              <div key={ay.id} className={clsx(
                'flex items-start gap-3 rounded-lg px-3 py-2.5 border',
                ay.urgente ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'
              )}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded capitalize">
                      {ay.tipo?.replace(/_/g, ' ')}
                    </span>
                    {ay.cups && <span className="text-xs font-mono text-slate-500">{ay.cups}</span>}
                    {ay.urgente && <span className="text-xs text-red-700 font-bold">URGENTE</span>}
                    <span className={clsx(
                      'ml-auto text-xs px-2 py-0.5 rounded-full',
                      ay.estado === 'resultado' ? 'bg-green-100 text-green-700' :
                      ay.estado === 'tomada' ? 'bg-blue-100 text-blue-700' :
                      ay.estado === 'cancelada' ? 'bg-slate-100 text-slate-500' :
                      'bg-amber-100 text-amber-700'
                    )}>{ay.estado}</span>
                  </div>
                  <p className="text-sm text-slate-800">{ay.descripcion}</p>
                  {ay.indicacion_clinica && <p className="text-xs text-slate-500 mt-0.5">{ay.indicacion_clinica}</p>}
                  {ay.medico_solicitante_nombre && <p className="text-xs text-slate-400 mt-1">Dr. {ay.medico_solicitante_nombre}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Acordeon>

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
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(hc as any).numero_hc && (
                      <span className="text-xs font-mono font-bold text-halu-700 bg-halu-50 border border-halu-200 px-2 py-0.5 rounded-full">
                        HC-{String((hc as any).numero_hc).padStart(5, '0')}
                      </span>
                    )}
                    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', TIPO_REGISTRO_COLOR[hc.tipo_registro] ?? 'bg-slate-100 text-slate-600')}>
                      {TIPO_REGISTRO_LABEL[hc.tipo_registro] || hc.tipo_registro}
                    </span>
                    {hc.diagnostico_principal && (
                      <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                        Dx: {hc.diagnostico_principal}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 flex-shrink-0 ml-2">{fmtFecha(hc.fecha_atencion)}</p>
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
                {(hc as any).ordenes?.length > 0 && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <p className="text-xs text-slate-400 font-medium flex items-center gap-1 mb-2">
                      <ClipboardList className="w-3.5 h-3.5" />Órdenes médicas ({(hc as any).ordenes.length})
                    </p>
                    <div className="space-y-1">
                      {(hc as any).ordenes.map((o: any) => (
                        <div key={o.id} className={clsx(
                          'text-xs rounded-lg px-3 py-1.5 flex items-center gap-2',
                          o.urgente ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800'
                        )}>
                          <span className="font-semibold">{TIPOS_ORDEN.find(t => t.value === o.tipo)?.icon}</span>
                          {o.cups && <span className="font-mono font-bold">{o.cups}</span>}
                          <span className="flex-1">{o.descripcion_cups}</span>
                          {o.cantidad > 1 && <span className="text-slate-500">×{o.cantidad}</span>}
                          {o.urgente && <span className="text-red-600 font-bold">URGENTE</span>}
                          {o.genera_factura && <span className="text-emerald-600">💰</span>}
                          <span className={clsx('ml-auto px-1.5 py-0.5 rounded-full text-xs',
                            o.estado === 'ejecutada' ? 'bg-green-100 text-green-700' :
                            o.estado === 'cancelada' ? 'bg-slate-100 text-slate-500' :
                            'bg-amber-100 text-amber-700'
                          )}>{o.estado}</span>
                        </div>
                      ))}
                    </div>
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
                {(hc as any).medicamentos?.length > 0 && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <p className="text-xs text-slate-400 font-medium flex items-center gap-1 mb-2">
                      <Pill className="w-3.5 h-3.5" />Medicamentos ({(hc as any).medicamentos.length})
                    </p>
                    <div className="space-y-1">
                      {(hc as any).medicamentos.map((m: any) => (
                        <div key={m.id} className="text-xs bg-emerald-50 rounded-lg px-3 py-1.5">
                          <span className="font-medium text-emerald-800">{m.principio_activo}</span>
                          {m.dosis && <span className="text-emerald-600"> · {m.dosis}</span>}
                          {m.frecuencia && <span className="text-slate-500"> · {m.frecuencia}</span>}
                          {m.via_administracion && <span className="text-slate-400"> · {m.via_administracion}</span>}
                          {m.dias_tratamiento > 1 && <span className="text-slate-400"> · {m.dias_tratamiento} días</span>}
                        </div>
                      ))}
                    </div>
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
