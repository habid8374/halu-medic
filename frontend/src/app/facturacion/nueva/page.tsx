'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { consultasAPI, facturasAPI } from '@/lib/api'
import { PageHeader, Button, Card, Input } from '@/components/ui'
import { ArrowLeft, Receipt, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { Consulta } from '@/types'

export default function NuevaFacturaPage() {
  const router = useRouter()
  const [busq, setBusq]   = useState('')
  const [consultaId, setConsultaId] = useState('')
  const [resultados, setResultados] = useState<Consulta[]>([])
  const [consultaSeleccionada, setConsultaSeleccionada] = useState<Consulta | null>(null)
  const [creando, setCreando] = useState(false)

  const buscar = async () => {
    if (!busq.trim()) return
    try {
      const { data } = await consultasAPI.list({ search: busq, estado: 'cerrada' })
      setResultados(data.results)
    } catch { toast.error('Error al buscar consultas') }
  }

  const crear = async () => {
    if (!consultaSeleccionada) return
    setCreando(true)
    try {
      const { data } = await facturasAPI.create({ consulta: consultaSeleccionada.id })
      toast.success('Factura creada')
      router.push(`/facturacion/${data.id}`)
    } catch { toast.error('Error al crear la factura') }
    finally { setCreando(false) }
  }

  return (
    <div className="page-padding max-w-2xl animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/facturacion"><Button variant="ghost" className="px-2"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <PageHeader title="Nueva factura" description="Selecciona la consulta a facturar" />
      </div>
      <div className="space-y-4">
        <Card>
          <h3 className="font-semibold text-slate-900 text-sm mb-4">Buscar consulta</h3>
          <div className="flex gap-2">
            <Input value={busq} onChange={e => setBusq(e.target.value)}
              placeholder="Nombre del paciente o cédula..." className="flex-1"
              onKeyDown={e => e.key === 'Enter' && buscar()} />
            <Button onClick={buscar} variant="secondary">
              <Search className="w-4 h-4" />
            </Button>
          </div>
          {resultados.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {resultados.map(c => (
                <button key={c.id} onClick={() => setConsultaSeleccionada(c)}
                  className={`w-full text-left p-3 rounded-xl border text-sm transition-all ${
                    consultaSeleccionada?.id === c.id
                      ? 'border-halu-400 bg-halu-50'
                      : 'border-slate-100 hover:border-slate-200'}`}>
                  <p className="font-medium text-slate-900">{c.paciente_nombre}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    CUPS: {c.cups_principal} · DX: {c.diagnostico_principal}
                    {' · '}{new Date(c.fecha_atencion).toLocaleDateString('es-CO')}
                  </p>
                </button>
              ))}
            </div>
          )}
        </Card>
        {consultaSeleccionada && (
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Receipt className="w-4 h-4 text-halu-600" />
              <h3 className="font-semibold text-slate-900 text-sm">Operación SS</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              El tipo de operación (SS-CUFE o SS-SinAporte) se determina automáticamente
              según el régimen del paciente y si tiene convenio EPS.
            </p>
            <Button onClick={crear} loading={creando} className="w-full">
              <Receipt className="w-4 h-4" />
              Crear factura electrónica
            </Button>
          </Card>
        )}
      </div>
    </div>
  )
}
