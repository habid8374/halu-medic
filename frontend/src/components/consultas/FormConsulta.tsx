'use client'
import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { consultasAPI, facturasAPI, tarifasAPI, pacientesAPI } from '@/lib/api'
import { Procedimiento } from '@/types'
import { Input, Select, Button, Card, CupsAutocomplete, Cie10Autocomplete } from '@/components/ui'
import { Stethoscope, Plus, Trash2, Receipt, FileText, ClipboardList, DollarSign, User } from 'lucide-react'
import toast from 'react-hot-toast'

interface FormData {
  paciente: string
  cita: string
  cups_principal: string
  descripcion_cups: string
  diagnostico_principal: string
  diagnostico_relacionado_1: string
  diagnostico_relacionado_2: string
  tipo_diagnostico: string
  motivo_consulta: string
  enfermedad_actual: string
  examen_fisico: string
  plan_tratamiento: string
  numero_autorizacion: string
  modalidad: string
  grupo_servicio: string
  finalidad: string
  causa_atencion: string
  valor_consulta: string
  valor_copago: string
}

const EMPTY: FormData = {
  paciente: '', cita: '',
  cups_principal: '', descripcion_cups: '',
  diagnostico_principal: '', diagnostico_relacionado_1: '',
  diagnostico_relacionado_2: '', tipo_diagnostico: '1',
  motivo_consulta: '', enfermedad_actual: '',
  examen_fisico: '', plan_tratamiento: '',
  numero_autorizacion: '',
  modalidad: '01', grupo_servicio: '01',
  finalidad: '13', causa_atencion: '26',
  valor_consulta: '', valor_copago: '0',
}

const PROC_EMPTY = { cups: '', descripcion: '', valor_facturar: 0, cantidad: 1 }

interface PacienteOption { id: string; nombre_completo: string; numero_identificacion: string }

export function FormConsulta({ pacienteId, citaId }: { pacienteId?: string; citaId?: string }) {
  const router = useRouter()
  const [form, setForm]   = useState<FormData>({ ...EMPTY, paciente: pacienteId ?? '', cita: citaId ?? '' })
  const [procs, setProcs] = useState<Partial<Procedimiento>[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [crearFactura, setCrearFactura] = useState(true)
  const [buscandoPrecio, setBuscandoPrecio] = useState(false)
  const [pacientes, setPacientes] = useState<PacienteOption[]>([])
  const [pacienteNombre, setPacienteNombre] = useState('')
  const [busqPaciente, setBusqPaciente] = useState('')
  const [showPacientes, setShowPacientes] = useState(false)

  useEffect(() => {
    if (!busqPaciente.trim() || busqPaciente.length < 2) { setPacientes([]); return }
    const t = setTimeout(async () => {
      try {
        const { data } = await pacientesAPI.list({ search: busqPaciente, page_size: 20 })
        setPacientes(data.results ?? data)
      } catch { /* ignore */ }
    }, 300)
    return () => clearTimeout(t)
  }, [busqPaciente])

  const set = (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))

  // Cuando se selecciona el CUPS principal: auto-rellena descripción y busca precio
  const onCupsPrincipalChange = useCallback(async (codigo: string, descripcion: string) => {
    setForm(f => ({ ...f, cups_principal: codigo, descripcion_cups: descripcion }))
    if (!codigo) return
    setBuscandoPrecio(true)
    try {
      const { data } = await tarifasAPI.precio(codigo, pacienteId || undefined)
      if (data.encontrado && data.valor != null) {
        setForm(f => ({ ...f, valor_consulta: String(Math.round(data.valor)) }))
        toast.success(`Precio de tarifa "${data.manual_nombre}": $${Number(data.valor).toLocaleString('es-CO')}`, { duration: 2500 })
      }
    } catch { /* no tarifa, no problem */ } finally { setBuscandoPrecio(false) }
  }, [pacienteId])

  // Cuando se selecciona CUPS en un procedimiento adicional
  const onCupsProcChange = useCallback(async (i: number, codigo: string, descripcion: string) => {
    setProcs(p => p.map((pr, idx) => idx === i ? { ...pr, cups: codigo, descripcion } : pr))
    if (!codigo) return
    try {
      const { data } = await tarifasAPI.precio(codigo, pacienteId || undefined)
      if (data.encontrado && data.valor != null) {
        setProcs(p => p.map((pr, idx) => idx === i ? { ...pr, valor_facturar: Math.round(data.valor) } : pr))
      }
    } catch { /* ignore */ }
  }, [pacienteId])

  const addProc = () => setProcs(p => [...p, { ...PROC_EMPTY }])
  const removeProc = (i: number) => setProcs(p => p.filter((_, idx) => idx !== i))
  const setProc = (i: number, field: string, val: string | number) =>
    setProcs(p => p.map((pr, idx) => idx === i ? { ...pr, [field]: val } : pr))

  const seleccionarPaciente = (p: PacienteOption) => {
    setForm(f => ({ ...f, paciente: p.id }))
    setPacienteNombre(`${p.nombre_completo} · ${p.numero_identificacion}`)
    setBusqPaciente('')
    setPacientes([])
    setShowPacientes(false)
    setErrors(e => ({ ...e, paciente: '' }))
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.paciente)              e.paciente              = 'Debes seleccionar un paciente'
    if (!form.cups_principal)        e.cups_principal        = 'Requerido'
    if (!form.diagnostico_principal) e.diagnostico_principal = 'Requerido (CIE-10)'
    if (!form.valor_consulta)        e.valor_consulta        = 'Requerido'
    return e
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      const primero = Object.values(errs)[0]
      toast.error(primero === 'Debes seleccionar un paciente' ? 'Debes seleccionar un paciente' : 'Revisa los campos requeridos')
      return
    }
    setSaving(true)

    try {
      const payload = {
        ...form,
        valor_consulta: parseFloat(form.valor_consulta) || 0,
        valor_copago:   parseFloat(form.valor_copago)   || 0,
        fecha_atencion: new Date().toISOString(),
        estado: 'cerrada',
        procedimientos: procs.filter(p => p.cups && p.descripcion),
      }

      const { data: consulta } = await consultasAPI.create(payload)
      toast.success('Consulta registrada correctamente')

      // Crear factura automáticamente si el usuario lo pidió
      if (crearFactura) {
        try {
          const { data: factura } = await facturasAPI.create({ consulta: consulta.id })
          toast.success('Factura creada — lista para emitir ante DIAN')
          router.push(`/facturacion/${factura.id}`)
          return
        } catch {
          toast.error('Consulta guardada, pero error al crear factura. Créala manualmente.')
          router.push(`/consultas/${consulta.id}`)
          return
        }
      }

      router.push(`/consultas/${consulta.id}`)
    } catch (err: unknown) {
      const d = (err as { response?: { data?: Record<string, string[]> } })?.response?.data
      if (d) {
        const ae: Record<string, string> = {}
        Object.entries(d).forEach(([k, v]) => { ae[k] = Array.isArray(v) ? v[0] : String(v) })
        setErrors(ae)
        toast.error('Revisa los campos')
      } else {
        toast.error('Error al guardar la consulta')
      }
    } finally { setSaving(false) }
  }

  const totalConsulta = (parseFloat(form.valor_consulta) || 0) +
    procs.reduce((s, p) => s + (Number(p.valor_facturar) * Number(p.cantidad || 1)), 0)

  return (
    <form onSubmit={handleSubmit} className="space-y-5 animate-slide-up">

      {/* Paciente — solo se muestra si no viene preseleccionado por URL */}
      {!pacienteId && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-900 text-sm">Paciente *</h3>
          </div>
          {form.paciente && pacienteNombre ? (
            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-sm font-medium text-emerald-800">{pacienteNombre}</span>
              <button type="button" onClick={() => { setForm(f => ({ ...f, paciente: '' })); setPacienteNombre('') }}
                className="text-xs text-slate-400 hover:text-slate-600 underline">Cambiar</button>
            </div>
          ) : (
            <div className="relative">
              <input
                value={busqPaciente}
                onChange={e => { setBusqPaciente(e.target.value); setShowPacientes(true) }}
                onFocus={() => setShowPacientes(true)}
                placeholder="Buscar por nombre o cédula..."
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${
                  errors.paciente ? 'border-red-300 focus:ring-red-200 bg-red-50' : 'border-slate-200 focus:ring-halu-500/20 focus:border-halu-400 bg-slate-50'
                }`}
              />
              {showPacientes && pacientes.length > 0 && (
                <div className="absolute z-50 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                  {pacientes.map(p => (
                    <button key={p.id} type="button" onClick={() => seleccionarPaciente(p)}
                      className="w-full text-left px-4 py-2.5 hover:bg-halu-50 flex flex-col border-b border-slate-50 last:border-0">
                      <span className="text-sm font-medium text-slate-800">{p.nombre_completo}</span>
                      <span className="text-xs text-slate-400">{p.numero_identificacion}</span>
                    </button>
                  ))}
                </div>
              )}
              {errors.paciente && <p className="text-xs text-red-500 mt-1">{errors.paciente}</p>}
            </div>
          )}
        </Card>
      )}

      {/* CUPS y Diagnóstico */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 bg-halu-50 rounded-lg flex items-center justify-center">
            <Stethoscope className="w-3.5 h-3.5 text-halu-600" />
          </div>
          <h3 className="font-semibold text-slate-900 text-sm">CUPS y diagnóstico</h3>
          {buscandoPrecio && (
            <span className="ml-auto text-xs text-halu-600 flex items-center gap-1.5">
              <div className="w-3 h-3 border-2 border-halu-500 border-t-transparent rounded-full animate-spin" />
              Buscando precio en tarifa...
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CupsAutocomplete
            label="CUPS principal"
            value={form.cups_principal}
            descripcion={form.descripcion_cups}
            onChange={(cod, desc) => onCupsPrincipalChange(cod, desc)}
            error={errors.cups_principal}
            required
            placeholder="Código o nombre del procedimiento..."
          />
          <Input label="Descripción del CUPS" value={form.descripcion_cups} onChange={set('descripcion_cups')}
            placeholder="Se autocompleta al seleccionar el CUPS" />
          <Cie10Autocomplete
            label="Diagnóstico principal CIE-10"
            value={form.diagnostico_principal}
            onChange={(cod) => setForm(f => ({ ...f, diagnostico_principal: cod }))}
            error={errors.diagnostico_principal}
            required
            placeholder="Código o nombre del diagnóstico..."
          />
          <Cie10Autocomplete
            label="Diagnóstico relacionado 1"
            value={form.diagnostico_relacionado_1}
            onChange={(cod) => setForm(f => ({ ...f, diagnostico_relacionado_1: cod }))}
            placeholder="Opcional"
          />
          <Cie10Autocomplete
            label="Diagnóstico relacionado 2"
            value={form.diagnostico_relacionado_2}
            onChange={(cod) => setForm(f => ({ ...f, diagnostico_relacionado_2: cod }))}
            placeholder="Opcional"
          />
          <Select label="Tipo de diagnóstico" value={form.tipo_diagnostico} onChange={set('tipo_diagnostico')}>
            <option value="1">Impresión diagnóstica</option>
            <option value="2">Confirmado nuevo</option>
            <option value="3">Confirmado repetido</option>
          </Select>
        </div>
      </Card>

      {/* Registro clínico */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 bg-teal-50 rounded-lg flex items-center justify-center">
            <ClipboardList className="w-3.5 h-3.5 text-teal-600" />
          </div>
          <h3 className="font-semibold text-slate-900 text-sm">Registro clínico</h3>
        </div>
        <div className="space-y-3">
          {[
            { field: 'motivo_consulta', label: 'Motivo de consulta' },
            { field: 'enfermedad_actual', label: 'Enfermedad actual' },
            { field: 'examen_fisico', label: 'Examen físico' },
            { field: 'plan_tratamiento', label: 'Plan de tratamiento' },
          ].map(({ field, label }) => (
            <div key={field} className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">{label}</label>
              <textarea rows={2} value={(form as Record<string, string>)[field]}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50
                  focus:outline-none focus:ring-2 focus:ring-halu-500/20 focus:border-halu-400 resize-none"
                placeholder={`Registra ${label.toLowerCase()}...`} />
            </div>
          ))}
        </div>
      </Card>

      {/* Procedimientos adicionales */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-purple-50 rounded-lg flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <h3 className="font-semibold text-slate-900 text-sm">Procedimientos adicionales</h3>
          </div>
          <Button type="button" variant="secondary" onClick={addProc} className="text-xs py-1.5 px-3">
            <Plus className="w-3.5 h-3.5" />Agregar
          </Button>
        </div>
        {procs.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">Sin procedimientos adicionales</p>
        ) : (
          <div className="space-y-3">
            {procs.map((proc, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-start p-3 bg-slate-50 rounded-xl">
                <div className="col-span-4">
                  <CupsAutocomplete
                    label="CUPS"
                    value={proc.cups ?? ''}
                    descripcion={proc.descripcion ?? ''}
                    onChange={(cod, desc) => onCupsProcChange(i, cod, desc)}
                    placeholder="Código..."
                  />
                </div>
                <div className="col-span-4">
                  <Input label="Descripción" value={proc.descripcion ?? ''}
                    onChange={e => setProc(i, 'descripcion', e.target.value)}
                    placeholder="Se autocompleta..." />
                </div>
                <div className="col-span-1">
                  <Input label="Cant." type="number" value={String(proc.cantidad ?? 1)}
                    onChange={e => setProc(i, 'cantidad', parseInt(e.target.value))} />
                </div>
                <div className="col-span-2">
                  <Input label="Valor $" type="number" value={String(proc.valor_facturar ?? 0)}
                    onChange={e => setProc(i, 'valor_facturar', parseFloat(e.target.value))} />
                </div>
                <div className="col-span-1 flex items-end pb-2.5">
                  <button type="button" onClick={() => removeProc(i)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Datos RIPS y financieros */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 bg-amber-50 rounded-lg flex items-center justify-center">
            <Receipt className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <h3 className="font-semibold text-slate-900 text-sm">Datos financieros y RIPS</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative">
            <Input label="Valor consulta * ($)" type="number" value={form.valor_consulta}
              onChange={set('valor_consulta')} placeholder="Se rellena desde la tarifa"
              error={errors.valor_consulta} />
            {buscandoPrecio && (
              <div className="absolute right-3 top-9 w-3.5 h-3.5 border-2 border-halu-400 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          <Input label="Copago / Cuota moderadora ($)" type="number" value={form.valor_copago}
            onChange={set('valor_copago')} placeholder="0" />
          <Input label="Nº Autorización EPS" value={form.numero_autorizacion}
            onChange={set('numero_autorizacion')} placeholder="Ej: EPS-2026-123456" />
          <Select label="Finalidad (RIPS)" value={form.finalidad} onChange={set('finalidad')}>
            <option value="13">Atención de enfermedad general</option>
            <option value="14">Detección de alteraciones del crecimiento</option>
            <option value="15">Detección de alteraciones del desarrollo</option>
            <option value="18">Atención de accidente de trabajo</option>
            <option value="19">Atención de accidente de tránsito</option>
          </Select>
        </div>

        {/* Total */}
        <div className="mt-4 p-3 bg-halu-50 rounded-xl flex items-center justify-between">
          <span className="text-sm font-medium text-halu-700 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />Total a facturar
          </span>
          <span className="text-lg font-bold text-halu-900">
            ${totalConsulta.toLocaleString('es-CO')}
          </span>
        </div>
      </Card>

      {/* Opción crear factura */}
      <div className="flex items-start gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
        <input type="checkbox" id="crear_factura" checked={crearFactura}
          onChange={e => setCrearFactura(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500" />
        <div>
          <label htmlFor="crear_factura" className="text-sm font-medium text-emerald-800 cursor-pointer">
            Crear factura electrónica automáticamente
          </label>
          <p className="text-xs text-emerald-600 mt-0.5">
            Al guardar la consulta, se creará la factura SS-CUFE o SS-SinAporte lista para emitir ante la DIAN vía Factus.
          </p>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-end gap-3 pb-6">
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancelar</Button>
        <Button type="submit" loading={saving}>
          {crearFactura ? 'Guardar y crear factura' : 'Guardar consulta'}
        </Button>
      </div>
    </form>
  )
}
