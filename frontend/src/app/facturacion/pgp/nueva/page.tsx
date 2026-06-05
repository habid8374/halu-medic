'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { conveniosAPI, facturasPGPAPI, mensajeError } from '@/lib/api'
import { ConvenioEPS } from '@/types'
import { Button, Card, Spinner } from '@/components/ui'
import { ArrowLeft, FileText } from 'lucide-react'

const MESES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
]

function autoDescripcion(desde: string, hasta: string, numContrato: string): string {
  if (!desde || !hasta) return ''
  const d = new Date(desde + 'T12:00:00')
  const h = new Date(hasta + 'T12:00:00')
  const mes = MESES[d.getMonth()]
  const anio = d.getFullYear()
  const diaD = d.getDate()
  const diaH = h.getDate()
  const contrato = numContrato ? ` Contrato N° ${numContrato}` : ''
  return `Contrato PGP que comprende el mes de ${mes} del ${diaD} al ${diaH} de ${mes} de ${anio}.${contrato}`
}

export default function NuevaFacturaPGPPage() {
  const router = useRouter()
  const [convenios, setConvenios] = useState<ConvenioEPS[]>([])
  const [loadingConvenios, setLoadingConvenios] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [form, setForm] = useState({
    convenio: '',
    periodo_desde: '',
    periodo_hasta: '',
    descripcion_contrato: '',
    numero_contrato_eps: '',
    valor_total: '',
  })

  useEffect(() => {
    conveniosAPI.list()
      .then(({ data }) => setConvenios(Array.isArray(data) ? data : data.results ?? []))
      .catch(() => {})
      .finally(() => setLoadingConvenios(false))
  }, [])

  // Auto-generar descripción cuando cambia periodo o contrato
  useEffect(() => {
    if (form.periodo_desde && form.periodo_hasta) {
      setForm(f => ({
        ...f,
        descripcion_contrato: autoDescripcion(f.periodo_desde, f.periodo_hasta, f.numero_contrato_eps),
      }))
    }
  }, [form.periodo_desde, form.periodo_hasta, form.numero_contrato_eps])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    if (!form.convenio) { setErrorMsg('Selecciona un convenio EPS'); return }
    if (!form.periodo_desde || !form.periodo_hasta) { setErrorMsg('Indica el período'); return }
    if (!form.valor_total || isNaN(Number(form.valor_total.replace(/[.,]/g, '')))) {
      setErrorMsg('Ingresa un valor total válido'); return
    }
    setSaving(true)
    try {
      const { data } = await facturasPGPAPI.create({
        convenio: form.convenio,
        periodo_desde: form.periodo_desde,
        periodo_hasta: form.periodo_hasta,
        descripcion_contrato: form.descripcion_contrato,
        numero_contrato_eps: form.numero_contrato_eps,
        valor_total: parseFloat(form.valor_total.replace(/\./g, '').replace(',', '.')),
      })
      router.push(`/facturacion/pgp/${data.id}`)
    } catch (err) {
      setErrorMsg(mensajeError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-padding max-w-2xl animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/facturacion/pgp">
          <Button variant="ghost" className="px-2"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Nueva Factura PGP</h1>
          <p className="text-sm text-slate-500">Pago Global Prospectivo / Capitación</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Convenio EPS
          </h2>
          {loadingConvenios ? (
            <Spinner />
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Convenio *</label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.convenio}
                onChange={e => set('convenio', e.target.value)}
                required
              >
                <option value="">Seleccionar convenio...</option>
                {convenios.filter(c => c.activo).map(c => (
                  <option key={c.id} value={c.id}>
                    {c.aseguradora_nombre} — Contrato {c.numero_contrato}
                  </option>
                ))}
              </select>
              {convenios.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No hay convenios activos. <Link href="/configuracion/convenios" className="underline">Crear convenio</Link>
                </p>
              )}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Período del contrato</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Desde *</label>
              <input
                type="date"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.periodo_desde}
                onChange={e => set('periodo_desde', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Hasta *</label>
              <input
                type="date"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.periodo_hasta}
                onChange={e => set('periodo_hasta', e.target.value)}
                required
              />
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Datos del contrato</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                N° Contrato EPS (en sistema de la EPS)
              </label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.numero_contrato_eps}
                onChange={e => set('numero_contrato_eps', e.target.value)}
                placeholder="Ej: CON-2026-001"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Descripción del contrato *
              </label>
              <textarea
                rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                value={form.descripcion_contrato}
                onChange={e => set('descripcion_contrato', e.target.value)}
                required
                placeholder="Contrato PGP que comprende el mes de..."
              />
              <p className="text-xs text-slate-400 mt-1">Se genera automáticamente al seleccionar período. Puedes editarla.</p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Valor global del contrato</h2>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Valor total (COP) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input
                type="number"
                min="0"
                step="1"
                className="w-full border border-slate-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.valor_total}
                onChange={e => set('valor_total', e.target.value)}
                required
                placeholder="100000000"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Valor global independiente de la frecuencia de atención en el período.
            </p>
          </div>
        </Card>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={saving} className="flex-1">
            {saving ? <Spinner size="sm" /> : null}
            {saving ? 'Guardando…' : 'Crear Factura PGP'}
          </Button>
          <Link href="/facturacion/pgp">
            <Button variant="secondary" type="button">Cancelar</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
