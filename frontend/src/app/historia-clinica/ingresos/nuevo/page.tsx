'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { ingresosAPI, pacientesAPI, mensajeError } from '@/lib/api'
import { Paciente } from '@/types'
import { Button, Card, Spinner } from '@/components/ui'
import { ArrowLeft, Search, UserPlus } from 'lucide-react'

const TIPO_ATENCION = [
  { value: 'consulta_externa', label: 'Consulta externa' },
  { value: 'urgencias',        label: 'Urgencias' },
  { value: 'hospitalizacion',  label: 'Hospitalización' },
  { value: 'procedimiento',    label: 'Procedimiento' },
]

function NuevoIngresoForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [saving, setSaving]           = useState(false)
  const [errorMsg, setErrorMsg]       = useState<string | null>(null)
  const [pacientes, setPacientes]     = useState<Paciente[]>([])
  const [searchPac, setSearchPac]     = useState('')
  const [loadingPac, setLoadingPac]   = useState(false)
  const [pacSelec, setPacSelec]       = useState<Paciente | null>(null)

  const [form, setForm] = useState({
    paciente: params.get('paciente') ?? '',
    medico: '',
    fecha_ingreso: new Date().toISOString().slice(0, 16),
    tipo_atencion: 'consulta_externa',
    motivo_ingreso: '',
    observaciones: '',
  })

  // Cargar paciente si viene en query
  useEffect(() => {
    if (params.get('paciente')) {
      pacientesAPI.get(params.get('paciente')!).then(({ data }) => setPacSelec(data)).catch(() => {})
    }
  }, [])

  const buscarPacientes = () => {
    if (!searchPac.trim()) return
    setLoadingPac(true)
    pacientesAPI.list({ search: searchPac, page_size: 10 })
      .then(({ data }) => setPacientes(data.results ?? []))
      .catch(() => {})
      .finally(() => setLoadingPac(false))
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.paciente) { setErrorMsg('Selecciona un paciente'); return }
    if (!form.motivo_ingreso) { setErrorMsg('Ingresa el motivo de ingreso'); return }
    setSaving(true); setErrorMsg(null)
    try {
      const { data } = await ingresosAPI.create({
        paciente: form.paciente,
        fecha_ingreso: form.fecha_ingreso,
        tipo_atencion: form.tipo_atencion,
        motivo_ingreso: form.motivo_ingreso,
        observaciones: form.observaciones,
      })
      router.push(`/historia-clinica/ingresos/${data.id}`)
    } catch (err) {
      setErrorMsg(mensajeError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Card>
        <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <UserPlus className="w-4 h-4" /> Paciente
        </h2>
        {pacSelec ? (
          <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
            <div>
              <p className="font-medium text-slate-900">{pacSelec.nombre_completo}</p>
              <p className="text-xs text-slate-500">{pacSelec.tipo_identificacion} {pacSelec.numero_identificacion}</p>
            </div>
            <button type="button" onClick={() => { setPacSelec(null); set('paciente', '') }} className="text-xs text-red-500 hover:underline">Cambiar</button>
          </div>
        ) : (
          <div>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Buscar por nombre o documento..."
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchPac}
                onChange={e => setSearchPac(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), buscarPacientes())}
              />
              <Button type="button" variant="secondary" onClick={buscarPacientes} disabled={loadingPac}>
                {loadingPac ? <Spinner size="sm" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            {pacientes.length > 0 && (
              <div className="border border-slate-200 rounded-lg divide-y overflow-hidden">
                {pacientes.map(p => (
                  <button key={p.id} type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex justify-between"
                    onClick={() => { setPacSelec(p); set('paciente', p.id); setPacientes([]) }}
                  >
                    <span className="font-medium">{p.nombre_completo}</span>
                    <span className="text-slate-400 text-xs">{p.tipo_identificacion} {p.numero_identificacion}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Datos del ingreso</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha y hora *</label>
              <input type="datetime-local" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.fecha_ingreso} onChange={e => set('fecha_ingreso', e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de atención *</label>
              <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.tipo_atencion} onChange={e => set('tipo_atencion', e.target.value)}>
                {TIPO_ATENCION.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Motivo de ingreso *</label>
            <textarea rows={3} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              value={form.motivo_ingreso} onChange={e => set('motivo_ingreso', e.target.value)} required
              placeholder="Describe el motivo de la consulta o ingreso..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
            <textarea rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
          </div>
        </div>
      </Card>

      {errorMsg && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{errorMsg}</div>}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving} className="flex-1">
          {saving ? <Spinner size="sm" /> : null}
          {saving ? 'Registrando…' : 'Registrar Ingreso'}
        </Button>
        <Link href="/historia-clinica"><Button variant="secondary" type="button">Cancelar</Button></Link>
      </div>
    </form>
  )
}

export default function NuevoIngresoPage() {
  return (
    <div className="page-padding max-w-2xl animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/historia-clinica">
          <Button variant="ghost" className="px-2"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Nuevo Ingreso</h1>
          <p className="text-sm text-slate-500">Registro de admisión del paciente</p>
        </div>
      </div>
      <Suspense fallback={<Spinner />}><NuevoIngresoForm /></Suspense>
    </div>
  )
}
