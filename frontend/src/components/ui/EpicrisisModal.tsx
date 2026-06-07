'use client'
import { useState } from 'react'
import { notasMedicasAPI, mensajeError } from '@/lib/api'
import { Cie10Autocomplete } from '@/components/ui/Cie10Autocomplete'
import { CheckCircle2, X } from 'lucide-react'
import { Button, Spinner } from '@/components/ui'
import toast from 'react-hot-toast'

interface Props {
  ingresoId: string
  pacienteNombre?: string
  onClose: () => void
  onSaved: () => void
}

const CONDICIONES = [
  { value: 'mejorado', label: 'Mejorado' },
  { value: 'estacionario', label: 'Estacionario' },
  { value: 'deteriorado', label: 'Deteriorado' },
  { value: 'fallecido', label: 'Fallecido' },
]

export function EpicrisisModal({ ingresoId, pacienteNombre, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    resumen_hospitalizacion: '',
    diagnostico_egreso: '',
    desc_diagnostico_egreso: '',
    condicion_al_egreso: 'mejorado',
    recomendaciones_egreso: '',
    medico_tratante: '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.resumen_hospitalizacion.trim()) {
      toast.error('El resumen de hospitalización es requerido')
      return
    }
    if (!form.diagnostico_egreso) {
      toast.error('Seleccione un diagnóstico de egreso')
      return
    }
    setSaving(true)
    try {
      await notasMedicasAPI.create({
        ingreso: ingresoId,
        tipo: 'epicrisis',
        resumen_hospitalizacion: form.resumen_hospitalizacion,
        diagnostico_egreso: form.diagnostico_egreso,
        desc_diagnostico_egreso: form.desc_diagnostico_egreso,
        condicion_al_egreso: form.condicion_al_egreso,
        recomendaciones_egreso: form.recomendaciones_egreso,
        medico_tratante: form.medico_tratante,
      })
      toast.success('Epicrisis guardada correctamente')
      onSaved()
    } catch (err) {
      toast.error(mensajeError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-4">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-slate-900">Epicrisis</h2>
            {pacienteNombre && (
              <p className="text-xs text-slate-500 mt-0.5">{pacienteNombre}</p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {/* Resumen de hospitalización */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Resumen de hospitalización *
            </label>
            <textarea
              rows={5}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Descripción del curso clínico durante la hospitalización..."
              value={form.resumen_hospitalizacion}
              onChange={e => set('resumen_hospitalizacion', e.target.value)}
            />
          </div>

          {/* Diagnóstico de egreso */}
          <div>
            <Cie10Autocomplete
              label="Diagnóstico de egreso *"
              value={form.diagnostico_egreso}
              required
              onChange={(codigo, nombre) => {
                set('diagnostico_egreso', codigo)
                set('desc_diagnostico_egreso', nombre)
              }}
              placeholder="Código o nombre (ej: J06, neumonía…)"
            />
          </div>

          {/* Condición al egreso */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">
              Condición al egreso *
            </label>
            <div className="flex flex-wrap gap-3">
              {CONDICIONES.map(c => (
                <label key={c.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="condicion_al_egreso"
                    value={c.value}
                    checked={form.condicion_al_egreso === c.value}
                    onChange={() => set('condicion_al_egreso', c.value)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-slate-700">{c.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Recomendaciones */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Recomendaciones y plan ambulatorio
            </label>
            <textarea
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Indicaciones, seguimiento, medicamentos ambulatorios..."
              value={form.recomendaciones_egreso}
              onChange={e => set('recomendaciones_egreso', e.target.value)}
            />
          </div>

          {/* Médico tratante */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Médico tratante
            </label>
            <input
              type="text"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nombre del médico tratante"
              value={form.medico_tratante}
              onChange={e => set('medico_tratante', e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? <Spinner size="sm" /> : <CheckCircle2 className="w-4 h-4" />}
              {saving ? 'Guardando…' : 'Guardar Epicrisis'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
