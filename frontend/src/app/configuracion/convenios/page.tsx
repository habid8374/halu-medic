'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { aseguradorasAPI, conveniosAPI, mensajeError } from '@/lib/api'
import { PageHeader, Button, Input, Card } from '@/components/ui'
import { Aseguradora, ConvenioEPS } from '@/types'
import toast from 'react-hot-toast'
import {
  Plus, Pencil, Trash2, Copy, Check, X,
  FileText, Calendar, Hash, ChevronLeft,
} from 'lucide-react'
import Link from 'next/link'

interface FormState {
  aseguradora: string
  numero_contrato: string
  vigencia_desde: string
  vigencia_hasta: string
  cucon: string
  tipo_tarifa: string
  porcentaje_copago: string
  valor_cuota_moderadora: string
  activo: boolean
  observaciones: string
}

const emptyForm = (): FormState => ({
  aseguradora: '',
  numero_contrato: '',
  vigencia_desde: '',
  vigencia_hasta: '',
  cucon: '',
  tipo_tarifa: '',
  porcentaje_copago: '0',
  valor_cuota_moderadora: '0',
  activo: true,
  observaciones: '',
})

const CUCON_RE = /^[0-9a-fA-F]{64}$/

export default function ConveniosPage() {
  const { usuario } = useAuth()
  const esAdmin = usuario?.permisos.es_admin || usuario?.permisos.es_superadmin

  const [convenios, setConvenios]       = useState<ConvenioEPS[]>([])
  const [aseguradoras, setAseguradoras] = useState<Aseguradora[]>([])
  const [loading, setLoading]           = useState(true)
  const [showForm, setShowForm]         = useState(false)
  const [editId, setEditId]             = useState<string | null>(null)
  const [form, setForm]                 = useState<FormState>(emptyForm())
  const [saving, setSaving]             = useState(false)
  const [copiedId, setCopiedId]         = useState<string | null>(null)

  const cargar = async () => {
    try {
      const [resC, resA] = await Promise.all([
        conveniosAPI.list(),
        aseguradorasAPI.list(),
      ])
      const dataC = resC.data
      const dataA = resA.data
      setConvenios(Array.isArray(dataC) ? dataC : (dataC.results ?? []))
      setAseguradoras(Array.isArray(dataA) ? dataA : (dataA.results ?? []))
    } catch (err) {
      toast.error('No se pudieron cargar los convenios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const abrirNuevo = () => {
    setEditId(null)
    setForm(emptyForm())
    setShowForm(true)
  }

  const abrirEditar = (c: ConvenioEPS) => {
    setEditId(c.id)
    setForm({
      aseguradora: c.aseguradora,
      numero_contrato: c.numero_contrato,
      vigencia_desde: c.vigencia_desde,
      vigencia_hasta: c.vigencia_hasta,
      cucon: c.cucon,
      tipo_tarifa: c.tipo_tarifa,
      porcentaje_copago: String(c.porcentaje_copago),
      valor_cuota_moderadora: String(c.valor_cuota_moderadora),
      activo: c.activo,
      observaciones: c.observaciones,
    })
    setShowForm(true)
  }

  const cerrarForm = () => {
    setShowForm(false)
    setEditId(null)
    setForm(emptyForm())
  }

  const guardar = async () => {
    if (!form.aseguradora) { toast.error('Selecciona una aseguradora'); return }
    if (!form.numero_contrato.trim()) { toast.error('El número de contrato es requerido'); return }
    if (!form.vigencia_desde) { toast.error('La fecha de inicio de vigencia es requerida'); return }
    if (form.cucon && !CUCON_RE.test(form.cucon)) {
      toast.error('El CUCON debe ser un hash SHA-256 (64 caracteres hexadecimales)')
      return
    }

    setSaving(true)
    try {
      const payload = {
        aseguradora: form.aseguradora,
        numero_contrato: form.numero_contrato.trim(),
        vigencia_desde: form.vigencia_desde,
        vigencia_hasta: form.vigencia_hasta || null,
        cucon: form.cucon.trim(),
        tipo_tarifa: form.tipo_tarifa.trim(),
        porcentaje_copago: parseFloat(form.porcentaje_copago) || 0,
        valor_cuota_moderadora: parseFloat(form.valor_cuota_moderadora) || 0,
        activo: form.activo,
        observaciones: form.observaciones.trim(),
      }

      if (editId) {
        await conveniosAPI.update(editId, payload)
        toast.success('Convenio actualizado')
      } else {
        await conveniosAPI.create(payload)
        toast.success('Convenio creado')
      }
      cerrarForm()
      cargar()
    } catch (err) {
      toast.error(mensajeError(err))
    } finally {
      setSaving(false)
    }
  }

  const eliminar = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar el convenio con ${nombre}?`)) return
    try {
      await conveniosAPI.delete(id)
      toast.success('Convenio eliminado')
      cargar()
    } catch (err) {
      toast.error(mensajeError(err))
    }
  }

  const copiarCucon = (cucon: string, id: string) => {
    navigator.clipboard.writeText(cucon).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const set = (campo: keyof FormState, valor: string | boolean) =>
    setForm((prev: FormState) => ({ ...prev, [campo]: valor }))

  if (loading) return (
    <div className="p-8">
      <div className="animate-pulse space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-xl" />
        ))}
      </div>
    </div>
  )

  return (
    <div className="p-8 animate-fade-in max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/configuracion">
          <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </Link>
        <span className="text-sm text-slate-400">Configuración</span>
      </div>

      <PageHeader
        title="Convenios EPS"
        description="Gestiona los convenios con aseguradoras y EPS del consultorio"
        action={
          esAdmin ? (
            <Button onClick={abrirNuevo}>
              <Plus className="w-4 h-4" />
              Nuevo convenio
            </Button>
          ) : undefined
        }
      />

      {/* Formulario */}
      {showForm && (
        <Card className="mb-6 space-y-5 border-halu-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-slate-700 font-semibold">
              <FileText className="w-4 h-4 text-halu-600" />
              {editId ? 'Editar convenio' : 'Nuevo convenio'}
            </div>
            <button onClick={cerrarForm} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Aseguradora */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Aseguradora / EPS *
              </label>
              <select
                value={form.aseguradora}
                onChange={e => set('aseguradora', e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800
                           focus:outline-none focus:ring-2 focus:ring-halu-500 focus:border-transparent"
              >
                <option value="">Seleccionar aseguradora…</option>
                {aseguradoras.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.nombre} — NIT: {a.nit}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Número de contrato *"
              value={form.numero_contrato}
              onChange={e => set('numero_contrato', e.target.value)}
              placeholder="Ej: CTR-2026-001"
            />

            <Input
              label="Tipo de tarifa"
              value={form.tipo_tarifa}
              onChange={e => set('tipo_tarifa', e.target.value)}
              placeholder="Ej: ISS-2001, SOAT, Libre"
            />

            <div className="relative">
              <Input
                label="Vigencia desde *"
                type="date"
                value={form.vigencia_desde}
                onChange={e => set('vigencia_desde', e.target.value)}
              />
              <Calendar className="absolute right-3 top-9 w-4 h-4 text-slate-300 pointer-events-none" />
            </div>

            <div className="relative">
              <Input
                label="Vigencia hasta"
                type="date"
                value={form.vigencia_hasta}
                onChange={e => set('vigencia_hasta', e.target.value)}
              />
              <Calendar className="absolute right-3 top-9 w-4 h-4 text-slate-300 pointer-events-none" />
            </div>

            <Input
              label="Porcentaje copago (%)"
              type="number"
              value={form.porcentaje_copago}
              onChange={e => set('porcentaje_copago', e.target.value)}
              placeholder="0"
            />

            <Input
              label="Valor cuota moderadora ($)"
              type="number"
              value={form.valor_cuota_moderadora}
              onChange={e => set('valor_cuota_moderadora', e.target.value)}
              placeholder="0"
            />

            {/* CUCON */}
            <div className="md:col-span-2 space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">
                  CUCON (Res. 948/2026)
                </label>
                {form.cucon && (
                  <button
                    type="button"
                    onClick={() => copiarCucon(form.cucon, 'form')}
                    className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                  >
                    {copiedId === 'form' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    Copiar
                  </button>
                )}
              </div>
              <input
                value={form.cucon}
                onChange={e => set('cucon', e.target.value)}
                placeholder="Hash SHA-256 de 64 caracteres hexadecimales (opcional)"
                maxLength={64}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm font-mono text-slate-800
                  focus:outline-none focus:ring-2 focus:ring-halu-500 focus:border-transparent
                  ${form.cucon && !CUCON_RE.test(form.cucon)
                    ? 'border-red-300 bg-red-50'
                    : 'border-slate-200'
                  }`}
              />
              {form.cucon && !CUCON_RE.test(form.cucon) && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  Debe tener exactamente 64 caracteres hexadecimales (0-9, a-f)
                  <span className="ml-auto font-semibold">{form.cucon.length}/64</span>
                </p>
              )}
              {form.cucon && CUCON_RE.test(form.cucon) && (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Hash SHA-256 válido
                </p>
              )}
              <p className="text-xs text-slate-400">
                Solo para SS-CUFE (EPS con convenio). Pacientes particulares no requieren CUCON.
              </p>
            </div>

            {/* Observaciones */}
            <div className="md:col-span-2 space-y-1">
              <label className="block text-sm font-medium text-slate-700">Observaciones</label>
              <textarea
                value={form.observaciones}
                onChange={e => set('observaciones', e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800
                           focus:outline-none focus:ring-2 focus:ring-halu-500 focus:border-transparent resize-none"
                placeholder="Notas adicionales del convenio…"
              />
            </div>

            {/* Activo */}
            <div className="md:col-span-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => set('activo', !form.activo)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  form.activo ? 'bg-halu-600' : 'bg-slate-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  form.activo ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
              <span className="text-sm text-slate-700">Convenio activo</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <Button onClick={guardar} loading={saving}>
              {editId ? 'Guardar cambios' : 'Crear convenio'}
            </Button>
            <Button variant="outline" onClick={cerrarForm}>Cancelar</Button>
          </div>
        </Card>
      )}

      {/* Lista de convenios */}
      {convenios.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay convenios registrados</p>
          <p className="text-sm mt-1">Agrega el primer convenio con una EPS o aseguradora</p>
        </div>
      ) : (
        <div className="space-y-3">
          {convenios.map(c => (
            <Card key={c.id} className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-slate-900 text-sm">{c.aseguradora_nombre}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    c.activo
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {c.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs text-slate-500">
                  <div><span className="text-slate-400">NIT:</span> {c.aseguradora_nit}</div>
                  <div><span className="text-slate-400">Contrato:</span> {c.numero_contrato}</div>
                  {c.vigencia_desde && (
                    <div>
                      <span className="text-slate-400">Vigencia:</span>{' '}
                      {c.vigencia_desde}{c.vigencia_hasta ? ` → ${c.vigencia_hasta}` : ''}
                    </div>
                  )}
                  {c.tipo_tarifa && (
                    <div><span className="text-slate-400">Tarifa:</span> {c.tipo_tarifa}</div>
                  )}
                </div>
                {c.cucon && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-slate-400">CUCON:</span>
                    <span className="text-xs font-mono text-slate-600 truncate max-w-xs">
                      {c.cucon.slice(0, 16)}…{c.cucon.slice(-8)}
                    </span>
                    <button
                      onClick={() => copiarCucon(c.cucon, c.id)}
                      className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex-shrink-0"
                      title="Copiar CUCON completo"
                    >
                      {copiedId === c.id
                        ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                        : <Copy className="w-3.5 h-3.5" />
                      }
                    </button>
                  </div>
                )}
              </div>

              {esAdmin && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => abrirEditar(c)}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => eliminar(c.id, c.aseguradora_nombre)}
                    className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
