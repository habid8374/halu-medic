'use client'
/**
 * Modal de programación quirúrgica — crear y editar.
 * Soporta hasta 3 procedimientos por acto quirúrgico (principal + 2 adicionales).
 * Usado desde el ingreso hospitalario y desde la agenda de cirugías (/salud/cx).
 */
import { useEffect, useState } from 'react'
import { programacionCxAPI, quirofanosAPI, mensajeError } from '@/lib/api'
import { ProgramacionCx, MedicoProfesional } from '@/types'
import { Button } from '@/components/ui'
import { CupsAutocomplete } from '@/components/ui/CupsAutocomplete'
import { Cie10Autocomplete } from '@/components/ui/Cie10Autocomplete'
import { Scissors, PlusCircle, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  /** Programación existente → modo edición. Null/undefined → crear. */
  cx?: ProgramacionCx | null
  /** Requeridos en modo crear */
  ingresoId?: string | null
  pacienteId?: string
  pacienteNombre?: string
  medicos: MedicoProfesional[]
  onClose: () => void
  onSaved: () => void
}

export default function ModalProgramacionCx({
  cx, ingresoId, pacienteId, pacienteNombre, medicos, onClose, onSaved,
}: Props) {
  const editando = !!cx
  const [form, setForm] = useState({
    cups_principal: cx?.cups_principal ?? '',
    descripcion_cups: cx?.descripcion_cups ?? '',
    diagnostico_preop: cx?.diagnostico_preop ?? '',
    desc_diagnostico_preop: cx?.desc_diagnostico_preop ?? '',
    tipo_cirugia: cx?.tipo_cirugia ?? 'electiva',
    cirujano: cx?.cirujano ?? '',
    anestesiologo: cx?.anestesiologo ?? '',
    fecha_programada: cx?.fecha_programada?.slice(0, 16) ?? '',
    duracion_estimada_min: cx?.duracion_estimada_min ?? 60,
    quirofano: cx?.quirofano ?? '',
    tipo_anestesia: cx?.tipo_anestesia ?? 'general',
    numero_autorizacion: cx?.numero_autorizacion ?? '',
    requiere_autorizacion: cx?.requiere_autorizacion ?? true,
    observaciones_preop: cx?.observaciones_preop ?? '',
    estado: cx?.estado ?? 'programada',
  })
  const [cupsSecundarios, setCupsSecundarios] = useState<{ cups: string; descripcion: string }[]>(
    cx?.cups_secundarios ?? []
  )
  const [saving, setSaving] = useState(false)
  const [quirofanos, setQuirofanos] = useState<{ id: string; nombre: string; estado: string }[]>([])

  useEffect(() => {
    quirofanosAPI.list({ activos: '1' })
      .then(({ data }) => setQuirofanos(data.results ?? data))
      .catch(() => {/* silencioso */})
  }, [])

  const f = (key: string, val: string | number | boolean) =>
    setForm(prev => ({ ...prev, [key]: val }))

  const save = async () => {
    if (!form.cups_principal) { toast.error('Ingresa el CUPS del procedimiento'); return }
    if (!form.fecha_programada) { toast.error('Selecciona la fecha programada'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        fecha_programada: form.fecha_programada.length === 16
          ? form.fecha_programada + ':00'
          : form.fecha_programada,
        cups_secundarios: cupsSecundarios.filter(s => s.cups),
      }
      if (editando && cx) {
        await programacionCxAPI.update(cx.id, payload)
        toast.success('Programación actualizada')
      } else {
        await programacionCxAPI.create({
          ...payload,
          ingreso: ingresoId ?? null,
          paciente: pacienteId,
        })
        toast.success('Cirugía programada')
      }
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="font-semibold text-slate-900">
              {editando ? `Editar CX-${String(cx!.numero_cx).padStart(5, '0')}` : 'Programar cirugía'}
            </h2>
            {(pacienteNombre || cx?.paciente_nombre) && (
              <p className="text-xs text-slate-500 mt-0.5">{pacienteNombre || cx?.paciente_nombre}</p>
            )}
          </div>
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

          {/* Procedimientos adicionales del mismo acto (hasta 3 en total) */}
          {cupsSecundarios.map((sec, i) => (
            <div key={i} className="flex items-end gap-2 bg-slate-50 rounded-xl p-3">
              <div className="flex-1">
                <CupsAutocomplete
                  label={`CUPS procedimiento ${i + 2}`}
                  value={sec.cups}
                  descripcion={sec.descripcion}
                  onChange={(cod, desc) => setCupsSecundarios(prev =>
                    prev.map((s, j) => j === i ? { cups: cod, descripcion: desc } : s))}
                  placeholder="Código o nombre del procedimiento adicional..."
                />
              </div>
              <button
                type="button"
                onClick={() => setCupsSecundarios(prev => prev.filter((_, j) => j !== i))}
                className="p-2 text-red-400 hover:text-red-600 mb-0.5"
                title="Quitar procedimiento"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          {cupsSecundarios.length < 2 && (
            <button
              type="button"
              onClick={() => setCupsSecundarios(prev => [...prev, { cups: '', descripcion: '' }])}
              className="flex items-center gap-1.5 text-sm text-halu-600 hover:text-halu-800 font-medium"
            >
              <PlusCircle className="w-4 h-4" /> Agregar otra cirugía al mismo acto ({cupsSecundarios.length + 1}/3)
            </button>
          )}

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
              <select value={String(form.cirujano ?? '')} onChange={e => f('cirujano', e.target.value)}
                className="input-base w-full">
                <option value="">— Seleccionar —</option>
                {medicos.map(m => <option key={m.id} value={m.id}>{m.nombre_completo}</option>)}
              </select>
            </div>
            <div>
              <label className="label-xs">Anestesiólogo</label>
              <select value={String(form.anestesiologo ?? '')} onChange={e => f('anestesiologo', e.target.value)}
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
              <select value={form.quirofano} onChange={e => f('quirofano', e.target.value)}
                className="input-base w-full">
                <option value="">— Seleccionar —</option>
                {form.quirofano && !quirofanos.some(q => q.nombre === form.quirofano) && (
                  <option value={form.quirofano}>{form.quirofano}</option>
                )}
                {quirofanos.map(q => (
                  <option key={q.id} value={q.nombre}
                    disabled={q.estado === 'mantenimiento'}>
                    {q.nombre}{q.estado === 'en_uso' ? ' (En uso)' : q.estado === 'limpieza' ? ' (Limpieza)' : q.estado === 'mantenimiento' ? ' (Mant.)' : ''}
                  </option>
                ))}
              </select>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-xs">Número de autorización EPS</label>
              <input value={form.numero_autorizacion}
                onChange={e => f('numero_autorizacion', e.target.value)}
                className="input-base w-full" />
            </div>
            {editando && (
              <div>
                <label className="label-xs">Estado</label>
                <select value={form.estado} onChange={e => f('estado', e.target.value)}
                  className="input-base w-full">
                  {[
                    ['programada','Programada'],['confirmada','Confirmada'],['en_curso','En curso'],
                    ['realizada','Realizada'],['suspendida','Suspendida'],['cancelada','Cancelada'],
                  ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            )}
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
            <Scissors className="w-4 h-4" /> {editando ? 'Guardar cambios' : 'Programar cirugía'}
          </Button>
        </div>
      </div>
    </div>
  )
}
