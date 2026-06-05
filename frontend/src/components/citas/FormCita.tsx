'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { citasAPI, pacientesAPI } from '@/lib/api'
import { Input, Select, Button, Card } from '@/components/ui'
import { CalendarDays, User, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

interface FormData {
  paciente: string
  medico: string
  fecha_hora_inicio: string
  fecha_hora_fin: string
  motivo_consulta: string
  estado: string
}

const EMPTY: FormData = {
  paciente: '', medico: '', fecha_hora_inicio: '',
  fecha_hora_fin: '', motivo_consulta: '', estado: 'programada',
}

export function FormCita({ pacienteId }: { pacienteId?: string }) {
  const router = useRouter()
  const [form, setForm]     = useState<FormData>({ ...EMPTY, paciente: pacienteId ?? '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [buscando, setBuscando]   = useState(false)
  const [pacienteBusq, setPacienteBusq] = useState('')
  const [sugerencias, setSugerencias]   = useState<{ id: string; nombre_completo: string }[]>([])

  const set = (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))

  // Autocompletar paciente
  const buscarPaciente = async (q: string) => {
    setPacienteBusq(q)
    if (q.length < 3) { setSugerencias([]); return }
    setBuscando(true)
    try {
      const { data } = await pacientesAPI.list({ search: q })
      setSugerencias(data.results.slice(0, 5))
    } finally { setBuscando(false) }
  }

  const seleccionarPaciente = (p: { id: string; nombre_completo: string }) => {
    setForm(f => ({ ...f, paciente: p.id }))
    setPacienteBusq(p.nombre_completo)
    setSugerencias([])
  }

  // Calcular fin automático (+20 min)
  const onInicioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setForm(f => {
      const fin = val ? new Date(new Date(val).getTime() + 20 * 60000)
        .toISOString().slice(0, 16) : ''
      return { ...f, fecha_hora_inicio: val, fecha_hora_fin: fin }
    })
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.paciente)          e.paciente          = 'Selecciona un paciente'
    if (!form.fecha_hora_inicio) e.fecha_hora_inicio = 'Requerido'
    if (!form.fecha_hora_fin)    e.fecha_hora_fin    = 'Requerido'
    return e
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    try {
      const { data } = await citasAPI.create(form as unknown as Record<string, unknown>)
      toast.success('Cita agendada correctamente')
      router.push(`/citas/${data.id}`)
    } catch (err: unknown) {
      const d = (err as { response?: { data?: Record<string, string[]> } })?.response?.data
      if (d) {
        const ae: Record<string, string> = {}
        Object.entries(d).forEach(([k, v]) => { ae[k] = Array.isArray(v) ? v[0] : String(v) })
        setErrors(ae)
        toast.error('Revisa los campos con errores')
      } else {
        toast.error('Error al agendar la cita')
      }
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 animate-slide-up">
      {/* Paciente */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 bg-halu-50 rounded-lg flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-halu-600" />
          </div>
          <h3 className="font-semibold text-slate-900 text-sm">Paciente</h3>
        </div>
        <div className="relative">
          <Input
            label="Buscar paciente *"
            value={pacienteBusq}
            onChange={e => buscarPaciente(e.target.value)}
            placeholder="Nombre o número de documento..."
            error={errors.paciente}
          />
          {sugerencias.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
              {sugerencias.map(p => (
                <button
                  key={p.id} type="button"
                  onClick={() => seleccionarPaciente(p)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-halu-50 transition-colors border-b border-slate-50 last:border-0"
                >
                  {p.nombre_completo}
                </button>
              ))}
            </div>
          )}
          {buscando && (
            <p className="text-xs text-slate-400 mt-1">Buscando...</p>
          )}
        </div>
      </Card>

      {/* Fecha y hora */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 bg-teal-50 rounded-lg flex items-center justify-center">
            <CalendarDays className="w-3.5 h-3.5 text-teal-600" />
          </div>
          <h3 className="font-semibold text-slate-900 text-sm">Fecha y hora</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Inicio *</label>
            <input
              type="datetime-local"
              value={form.fecha_hora_inicio}
              onChange={onInicioChange}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-halu-500/20 focus:border-halu-400"
            />
            {errors.fecha_hora_inicio && <p className="text-xs text-red-500">{errors.fecha_hora_inicio}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Fin *</label>
            <input
              type="datetime-local"
              value={form.fecha_hora_fin}
              onChange={set('fecha_hora_fin')}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-halu-500/20 focus:border-halu-400"
            />
            {errors.fecha_hora_fin && <p className="text-xs text-red-500">{errors.fecha_hora_fin}</p>}
          </div>
        </div>
        <div className="mt-3 p-3 bg-slate-50 rounded-xl">
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            La hora de fin se calcula automáticamente (+20 min por defecto)
          </p>
        </div>
      </Card>

      {/* Motivo */}
      <Card>
        <h3 className="font-semibold text-slate-900 text-sm mb-4">Motivo de consulta</h3>
        <div className="space-y-1.5">
          <textarea
            value={form.motivo_consulta}
            onChange={set('motivo_consulta')}
            rows={3}
            placeholder="Describe brevemente el motivo de la cita..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-halu-500/20 focus:border-halu-400 resize-none"
          />
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3 pb-6">
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancelar</Button>
        <Button type="submit" loading={saving}>Agendar cita</Button>
      </div>
    </form>
  )
}
