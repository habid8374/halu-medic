'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { prefacturaAPI, mensajeError } from '@/lib/api'
import BuscadorPacienteIngreso from '@/components/ui/BuscadorPacienteIngreso'
import type { PacienteResumen, IngresoResumen } from '@/components/ui/BuscadorPacienteIngreso'
import toast from 'react-hot-toast'
import { ArrowLeft, User, BedDouble, Search, FileText, Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'

const INPUT = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/20 focus:border-halu-400 bg-white'

export default function NuevaPrefacturaPage() {
  const router = useRouter()

  const [paciente, setPaciente]   = useState<PacienteResumen | null>(null)
  const [ingreso, setIngreso]     = useState<IngresoResumen | null>(null)
  const [showBuscador, setShowBuscador] = useState(false)

  const [form, setForm] = useState({
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin:    new Date().toISOString().split('T')[0],
    observaciones: '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSelect = (p: PacienteResumen, ing: IngresoResumen | null) => {
    setPaciente(p)
    setIngreso(ing)
    if (ing?.fecha_ingreso) {
      const today = new Date().toISOString().split('T')[0]
      setForm(f => ({ ...f, fecha_inicio: ing.fecha_ingreso.split('T')[0], fecha_fin: today }))
    }
    setShowBuscador(false)
  }

  const crear = async () => {
    if (!paciente) { toast.error('Selecciona un paciente'); return }
    if (!ingreso)  { toast.error('Selecciona el ingreso a facturar. La cuenta médica es por episodio.'); return }
    setSaving(true)
    try {
      const { data } = await prefacturaAPI.create({
        paciente: paciente.id,
        ingreso:  ingreso.id,
        fecha_inicio: form.fecha_inicio,
        fecha_fin:    form.fecha_fin,
        observaciones: form.observaciones,
      })
      const prefacturaId: string = data.id

      // Autocargar todos los servicios del ingreso (hotelería, órdenes, ayudas, CX)
      try {
        const { data: auto } = await prefacturaAPI.autocargar(prefacturaId)
        toast.success(auto?.message ? `Prefactura creada · ${auto.message}` : 'Prefactura creada')
      } catch {
        toast.success('Prefactura creada (autocarga pendiente, usa el botón Autocargar)')
      }
      router.push(`/facturacion/prefactura/${prefacturaId}`)
    } catch (e: unknown) {
      // Si ya existe una prefactura activa para el ingreso, llevar al usuario a ella
      const detail = (e as { response?: { data?: { prefactura_existente?: string | string[]; ingreso?: string[] } } })?.response?.data
      const existente = Array.isArray(detail?.prefactura_existente) ? detail?.prefactura_existente[0] : detail?.prefactura_existente
      if (existente) {
        toast(detail?.ingreso?.[0] ?? 'Ya existe una prefactura activa para este ingreso', { icon: 'ℹ️' })
        router.push(`/facturacion/prefactura/${existente}`)
        return
      }
      toast.error(mensajeError(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-padding animate-fade-in max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/facturacion/prefacturas"
          className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="w-10 h-10 bg-violet-100 rounded-2xl flex items-center justify-center">
          <FileText className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Nueva prefactura</h1>
          <p className="text-sm text-slate-500">La cuenta médica se abre por ingreso (episodio)</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">

        {/* Paciente */}
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1.5">Paciente *</label>
          <button
            type="button"
            onClick={() => setShowBuscador(true)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 hover:border-halu-400 transition-colors text-left"
          >
            {paciente ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-halu-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-halu-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{paciente.nombre_completo}</p>
                  <p className="text-xs text-slate-500">{paciente.tipo_documento} {paciente.numero_documento}</p>
                </div>
              </div>
            ) : (
              <span className="text-sm text-slate-400">Buscar paciente por nombre o documento...</span>
            )}
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          </button>
        </div>

        {/* Ingreso asociado (obligatorio) */}
        {paciente && (
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">Ingreso a facturar *</label>
            {ingreso ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
                <BedDouble className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {ingreso.numero_ingreso ? `Ingreso #${ingreso.numero_ingreso}` : 'Ingreso'} · {ingreso.tipo_ingreso_display || ingreso.tipo_ingreso}
                  </p>
                  {ingreso.servicio && <p className="text-xs text-slate-500">{ingreso.servicio}</p>}
                </div>
                <button onClick={() => { setIngreso(null); setShowBuscador(true) }}
                  className="text-xs text-slate-400 hover:text-slate-600">
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  Debes seleccionar el ingreso del paciente. Cada prefactura corresponde a un solo episodio.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Período */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">Fecha inicio período *</label>
            <input type="date" value={form.fecha_inicio} onChange={set('fecha_inicio')} className={INPUT} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">Fecha fin período *</label>
            <input type="date" value={form.fecha_fin} onChange={set('fecha_fin')} className={INPUT} />
          </div>
        </div>

        {/* Observaciones */}
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1.5">Observaciones</label>
          <textarea
            value={form.observaciones}
            onChange={set('observaciones')}
            rows={3}
            placeholder="Notas internas sobre esta preliquidación..."
            className={INPUT}
          />
        </div>

        {/* Botones */}
        <div className="flex gap-3 pt-2">
          <Link href="/facturacion/prefacturas"
            className="flex-1 text-center px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </Link>
          <button
            onClick={crear}
            disabled={saving || !paciente || !ingreso}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Crear y autocargar
          </button>
        </div>
      </div>

      {showBuscador && (
        <BuscadorPacienteIngreso
          onSelect={handleSelect}
          onClose={() => setShowBuscador(false)}
          titulo="Seleccionar paciente"
        />
      )}
    </div>
  )
}
