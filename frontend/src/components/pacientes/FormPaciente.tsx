'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { pacientesAPI, aseguradorasAPI } from '@/lib/api'
import { Paciente } from '@/types'
import { Input, Select, Button, Card } from '@/components/ui'
import { TIPOS_DOC, REGIMENES, SEXOS } from './helpers'
import toast from 'react-hot-toast'
import { User, Phone, Shield } from 'lucide-react'

interface FormData {
  tipo_identificacion: string
  numero_identificacion: string
  primer_nombre: string
  segundo_nombre: string
  primer_apellido: string
  segundo_apellido: string
  fecha_nacimiento: string
  sexo: string
  email: string
  telefono: string
  direccion: string
  municipio_codigo: string
  regimen: string
  numero_poliza: string
  aseguradora: string
}

interface Aseguradora { id: string; nombre: string; nit: string; tipo: string; tarifario_nombre: string }

const EMPTY: FormData = {
  tipo_identificacion: 'CC',
  numero_identificacion: '',
  primer_nombre: '',
  segundo_nombre: '',
  primer_apellido: '',
  segundo_apellido: '',
  fecha_nacimiento: '',
  sexo: 'M',
  email: '',
  telefono: '',
  direccion: '',
  municipio_codigo: '08001',
  regimen: 'P',
  numero_poliza: '',
  aseguradora: '',
}

interface Errors { [k: string]: string }

function validate(f: FormData): Errors {
  const e: Errors = {}
  if (!f.tipo_identificacion)    e.tipo_identificacion    = 'Requerido'
  if (!f.numero_identificacion)  e.numero_identificacion  = 'Requerido'
  if (!f.primer_nombre.trim())   e.primer_nombre          = 'Requerido'
  if (!f.primer_apellido.trim()) e.primer_apellido        = 'Requerido'
  if (!f.fecha_nacimiento)       e.fecha_nacimiento       = 'Requerido'
  if (!f.sexo)                   e.sexo                   = 'Requerido'
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email))
                                 e.email                  = 'Email inválido'
  return e
}

export function FormPaciente({ inicial }: { inicial?: Partial<Paciente> }) {
  const router = useRouter()
  const esEdicion = !!inicial?.id

  const [form, setForm] = useState<FormData>({
    ...EMPTY,
    ...inicial,
    aseguradora: (inicial as Record<string, unknown>)?.aseguradora as string ?? '',
  })
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const [aseguradoras, setAseguradoras] = useState<Aseguradora[]>([])

  useEffect(() => {
    aseguradorasAPI.list({ activo: true })
      .then(({ data }) => setAseguradoras(data.results ?? data))
      .catch(() => {/* silencioso */})
  }, [])

  const set = (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate(form)
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setSaving(true)
    try {
      const payload = { ...form, aseguradora: form.aseguradora || null }
      if (esEdicion) {
        await pacientesAPI.update(inicial!.id!, payload)
        toast.success('Paciente actualizado')
      } else {
        const { data } = await pacientesAPI.create(payload)
        toast.success('Paciente registrado correctamente')
        router.push(`/pacientes/${data.id}`)
        return
      }
      router.push(`/pacientes/${inicial!.id}`)
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, string[]> } })?.response?.data
      if (data) {
        const apiErrors: Errors = {}
        Object.entries(data).forEach(([k, v]) => { apiErrors[k] = Array.isArray(v) ? v[0] : String(v) })
        setErrors(apiErrors)
        toast.error('Revisa los campos con errores')
      } else {
        toast.error('Error al guardar el paciente')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-slide-up">

      {/* Identificación */}
      <Card>
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 bg-halu-50 rounded-lg flex items-center justify-center">
            <User className="w-4 h-4 text-halu-600" />
          </div>
          <h3 className="font-semibold text-slate-900 text-sm">Identificación</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Tipo de documento *"
            value={form.tipo_identificacion}
            onChange={set('tipo_identificacion')}
            error={errors.tipo_identificacion}
          >
            {TIPOS_DOC.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
          <Input
            label="Número de documento *"
            value={form.numero_identificacion}
            onChange={set('numero_identificacion')}
            error={errors.numero_identificacion}
            placeholder="Ej: 1234567890"
          />
        </div>
      </Card>

      {/* Datos personales */}
      <Card>
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center">
            <User className="w-4 h-4 text-teal-600" />
          </div>
          <h3 className="font-semibold text-slate-900 text-sm">Datos personales</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Primer nombre *"
            value={form.primer_nombre}
            onChange={set('primer_nombre')}
            error={errors.primer_nombre}
            placeholder="Ej: María"
          />
          <Input
            label="Segundo nombre"
            value={form.segundo_nombre}
            onChange={set('segundo_nombre')}
            placeholder="Opcional"
          />
          <Input
            label="Primer apellido *"
            value={form.primer_apellido}
            onChange={set('primer_apellido')}
            error={errors.primer_apellido}
            placeholder="Ej: García"
          />
          <Input
            label="Segundo apellido"
            value={form.segundo_apellido}
            onChange={set('segundo_apellido')}
            placeholder="Opcional"
          />
          <Input
            label="Fecha de nacimiento *"
            type="date"
            value={form.fecha_nacimiento}
            onChange={set('fecha_nacimiento')}
            error={errors.fecha_nacimiento}
          />
          <Select
            label="Sexo *"
            value={form.sexo}
            onChange={set('sexo')}
            error={errors.sexo}
          >
            {SEXOS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
        </div>
      </Card>

      {/* Contacto */}
      <Card>
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
            <Phone className="w-4 h-4 text-amber-600" />
          </div>
          <h3 className="font-semibold text-slate-900 text-sm">Contacto</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Teléfono"
            value={form.telefono}
            onChange={set('telefono')}
            placeholder="Ej: 3001234567"
            type="tel"
          />
          <Input
            label="Correo electrónico"
            value={form.email}
            onChange={set('email')}
            error={errors.email}
            placeholder="Ej: paciente@email.com"
            type="email"
          />
          <div className="sm:col-span-2">
            <Input
              label="Dirección"
              value={form.direccion}
              onChange={set('direccion')}
              placeholder="Ej: Cra 50 # 80-20, Barranquilla"
            />
          </div>
          <Input
            label="Código municipio (DANE)"
            value={form.municipio_codigo}
            onChange={set('municipio_codigo')}
            placeholder="08001 = Barranquilla"
          />
        </div>
      </Card>

      {/* Aseguramiento */}
      <Card>
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-emerald-600" />
          </div>
          <h3 className="font-semibold text-slate-900 text-sm">Aseguramiento</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Régimen de afiliación *"
            value={form.regimen}
            onChange={set('regimen')}
            error={errors.regimen}
          >
            {REGIMENES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </Select>
          <Input
            label="Número de póliza / afiliación"
            value={form.numero_poliza}
            onChange={set('numero_poliza')}
            placeholder="Opcional"
          />
          <Select
            label="EPS / Aseguradora"
            value={form.aseguradora}
            onChange={set('aseguradora')}
          >
            <option value="">— Sin aseguradora (particular) —</option>
            {aseguradoras.map(a => (
              <option key={a.id} value={a.id}>
                {a.nombre}{a.tarifario_nombre ? ` · ${a.tarifario_nombre}` : ''}
              </option>
            ))}
          </Select>
        </div>

        {/* Aviso RIPS */}
        <div className="mt-4 p-3 bg-halu-50 rounded-xl border border-halu-100">
          <p className="text-xs text-halu-700 font-medium">ℹ️ Importante para RIPS</p>
          <p className="text-xs text-halu-600 mt-0.5">
            El régimen determina el tipo de usuario en el RIPS (Res. 948/2026)
            y el concepto de recaudo en la factura electrónica sector salud.
          </p>
        </div>
      </Card>

      {/* Acciones */}
      <div className="flex items-center justify-end gap-3 pb-6">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
        >
          Cancelar
        </Button>
        <Button type="submit" loading={saving}>
          {esEdicion ? 'Guardar cambios' : 'Registrar paciente'}
        </Button>
      </div>
    </form>
  )
}
