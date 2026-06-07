'use client'
import { useState, useEffect } from 'react'
import { consentimientosAPI, mensajeError } from '@/lib/api'
import { PageHeader, Button, Badge, EmptyState, BuscadorPacienteIngreso, FirmarModal } from '@/components/ui'
import { FileText, Plus, Check, X, Clock, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Consentimiento {
  id: string
  tipo: string
  tipo_display: string
  procedimiento: string
  estado: string
  paciente: string
  paciente_nombre: string
  nombre_paciente_firmante: string
  fecha_firma: string | null
  creado_en: string
  firma_imagen?: string
}

const TIPO_LABELS: Record<string, string> = {
  general: 'Hospitalización', cirugia: 'Quirúrgico', anestesia: 'Anestésico',
  procedimiento: 'Procedimiento', transfusion: 'Transfusión', quimioterapia: 'Quimioterapia',
  investigacion: 'Investigación', imagen: 'Imágenes', telemedicina: 'Telemedicina', otro: 'Otro',
}

const TEXTOS_BASE: Record<string, string> = {
  general: `Yo, el/la paciente o representante legal, declaro haber recibido información clara y comprensible sobre mi diagnóstico, el plan de tratamiento, los procedimientos a realizar, los riesgos y beneficios esperados, y las alternativas disponibles. Autorizo al equipo médico de esta institución a realizar los procedimientos necesarios para mi atención integral, conforme a los protocolos establecidos y la lex artis médica.`,
  cirugia: `Declaro que he sido informado/a sobre el procedimiento quirúrgico a realizarme, incluyendo: la naturaleza del procedimiento, sus objetivos, los riesgos inherentes (sangrado, infección, lesión de estructuras adyacentes, reacciones anestésicas, entre otros), las posibles complicaciones y las alternativas terapéuticas. Autorizo al equipo quirúrgico a realizar el procedimiento descrito y las medidas adicionales que a criterio del cirujano sean necesarias durante el acto quirúrgico.`,
  anestesia: `Declaro que he sido informado/a sobre el tipo de anestesia propuesto, sus riesgos y beneficios, las alternativas disponibles y los posibles efectos secundarios. Autorizo al anestesiólogo a administrar la anestesia y los medicamentos complementarios que considere necesarios para mi seguridad durante el procedimiento.`,
  procedimiento: `Declaro haber recibido información sobre el procedimiento invasivo/diagnóstico a realizarme, sus objetivos, riesgos y alternativas. Autorizo al equipo médico a realizar el procedimiento descrito bajo las condiciones de asepsia y seguridad establecidas.`,
  transfusion: `Declaro que he sido informado/a sobre la necesidad de transfusión de hemoderivados, los riesgos (reacciones transfusionales, transmisión de enfermedades, aunque con mínima probabilidad) y las alternativas disponibles. Autorizo la administración de los hemoderivados indicados por el médico tratante.`,
}

export default function ConsentimientosPage() {
  const [consentimientos, setConsentimientos] = useState<Consentimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [showFirmar, setShowFirmar] = useState<string | null>(null)

  const cargar = async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {}
      if (filtroEstado) params.estado = filtroEstado
      const { data } = await consentimientosAPI.list(params)
      setConsentimientos(data.results ?? data)
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [filtroEstado])

  const firmar = (id: string) => {
    setShowFirmar(id)
  }

  const rechazar = async (id: string) => {
    const motivo = prompt('Motivo del rechazo:')
    if (motivo === null) return
    try {
      await consentimientosAPI.rechazar(id, motivo)
      toast.success('Rechazo registrado')
      cargar()
    } catch (e) { toast.error(mensajeError(e)) }
  }

  const estadoBadge = (estado: string) => {
    if (estado === 'firmado')   return <Badge variant="success">Firmado</Badge>
    if (estado === 'rechazado') return <Badge variant="error">Rechazado</Badge>
    if (estado === 'anulado')   return <Badge variant="default">Anulado</Badge>
    return <Badge variant="warning">Pendiente</Badge>
  }

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="Consentimientos informados"
        description="Documentos de autorización firmados por paciente o representante legal"
        action={<Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4" />Nuevo consentimiento</Button>}
      />

      <div className="flex gap-2 mb-5 flex-wrap">
        {[
          { v: '', label: 'Todos' },
          { v: 'pendiente', label: 'Pendientes' },
          { v: 'firmado', label: 'Firmados' },
          { v: 'rechazado', label: 'Rechazados' },
        ].map(f => (
          <button key={f.v} onClick={() => setFiltroEstado(f.v)}
            className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              filtroEstado === f.v ? 'bg-halu-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            )}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-white rounded-xl border animate-pulse" />)
        ) : consentimientos.length === 0 ? (
          <EmptyState title="Sin consentimientos" description="Los consentimientos creados aparecerán aquí" />
        ) : (
          consentimientos.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-slate-900">{TIPO_LABELS[c.tipo] || c.tipo_display}</span>
                  {estadoBadge(c.estado)}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Paciente: {c.paciente_nombre}
                  {c.procedimiento && ` · ${c.procedimiento}`}
                </p>
                {c.fecha_firma && (
                  <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1.5">
                    Firmado: {new Date(c.fecha_firma).toLocaleDateString('es-CO')}
                    {c.nombre_paciente_firmante && ` — ${c.nombre_paciente_firmante}`}
                    {c.firma_imagen && (
                      <span className="inline-flex items-center gap-0.5 bg-green-100 text-green-700 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                        ✓ Firma digital
                      </span>
                    )}
                  </p>
                )}
              </div>
              {c.estado === 'pendiente' && (
                <div className="flex gap-2">
                  <button onClick={() => firmar(c.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg">
                    <Check className="w-3.5 h-3.5" /> Firmar
                  </button>
                  <button onClick={() => rechazar(c.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold rounded-lg">
                    <X className="w-3.5 h-3.5" /> Rechazar
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showForm && (
        <NuevoConsentimientoModal
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); cargar() }}
        />
      )}
      {showFirmar && (
        <FirmarModal
          consentimientoId={showFirmar}
          pacienteNombre={consentimientos.find(c => c.id === showFirmar)?.paciente_nombre ?? ''}
          onClose={() => setShowFirmar(null)}
          onFirmado={() => { setShowFirmar(null); cargar() }}
        />
      )}
    </div>
  )
}

function NuevoConsentimientoModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    paciente: '', ingreso: '', tipo: 'general', procedimiento: '', cups_procedimiento: '',
    texto_completo: TEXTOS_BASE.general,
    riesgos_informados: '', alternativas_informadas: '',
  })
  const [saving, setSaving] = useState(false)
  const [showBuscador, setShowBuscador] = useState(false)
  const [pacienteNombre, setPacienteNombre] = useState('')
  const INPUT = "w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/20"

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const val = e.target.value
    setForm(f => ({
      ...f, [k]: val,
      ...(k === 'tipo' ? { texto_completo: TEXTOS_BASE[val] || '' } : {}),
    }))
  }

  const guardar = async () => {
    if (!form.paciente || !form.texto_completo) { toast.error('Paciente y texto son requeridos'); return }
    setSaving(true)
    try {
      await consentimientosAPI.create(form)
      toast.success('Consentimiento creado')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b">
          <h2 className="font-bold text-slate-900">Nuevo consentimiento informado</h2>
        </div>
        <div className="p-5 space-y-4">
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
              <label className="text-xs font-medium text-slate-600 block mb-1">Tipo *</label>
              <select value={form.tipo} onChange={set('tipo')} className={INPUT}>
                {Object.entries(TIPO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Procedimiento</label>
              <input value={form.procedimiento} onChange={set('procedimiento')} className={INPUT} placeholder="Nombre del procedimiento" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">CUPS</label>
              <input value={form.cups_procedimiento} onChange={set('cups_procedimiento')} className={INPUT} placeholder="Opcional" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Texto del consentimiento *</label>
            <textarea value={form.texto_completo} onChange={set('texto_completo')} rows={6} className={INPUT} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Riesgos informados</label>
              <textarea value={form.riesgos_informados} onChange={set('riesgos_informados')} rows={3} className={INPUT} placeholder="Riesgos explicados al paciente..." />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Alternativas informadas</label>
              <textarea value={form.alternativas_informadas} onChange={set('alternativas_informadas')} rows={3} className={INPUT} placeholder="Alternativas terapéuticas..." />
            </div>
          </div>
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Crear consentimiento</Button>
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
