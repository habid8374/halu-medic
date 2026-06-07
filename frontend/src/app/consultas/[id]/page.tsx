'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useConsulta } from '@/hooks/useConsultas'
import { useAuth } from '@/lib/auth-context'
import { facturasAPI } from '@/lib/api'
import { Badge, Button, Card, Spinner, PageHeader } from '@/components/ui'
import { OrdenesPanel } from '@/components/consultas/OrdenesPanel'
import MedicamentosRIPSPanel from '@/components/consultas/MedicamentosRIPSPanel'
import { ArrowLeft, Receipt, User, Stethoscope, ClipboardList, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

const ESTADO_BADGE: Record<string, 'default' | 'success' | 'warning' | 'info' | 'danger'> = {
  abierta: 'warning', cerrada: 'info', facturada: 'success', anulada: 'danger'
}

export default function ConsultaDetallePage({ params }: { params: { id: string } }) {
  const { id }   = params
  const { usuario } = useAuth()
  const router   = useRouter()
  const { consulta, loading } = useConsulta(id)
  const [facturando, setFacturando] = useState(false)

  const crearFactura = async () => {
    if (!consulta) return
    setFacturando(true)
    try {
      const { data } = await facturasAPI.create({ consulta: consulta.id })
      toast.success('Factura creada — lista para emitir')
      router.push(`/facturacion/${data.id}`)
    } catch { toast.error('Error al crear la factura') }
    finally { setFacturando(false) }
  }

  if (loading) return <div className="page-padding flex justify-center py-20"><Spinner size="lg" /></div>
  if (!consulta) return <div className="p-8"><p className="text-slate-500">Consulta no encontrada.</p></div>

  return (
    <div className="page-padding max-w-3xl animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/consultas"><Button variant="ghost" className="px-2"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <PageHeader title="Consulta clínica" />
      </div>
      <div className="space-y-4">
        {/* Header */}
        <Card>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="font-bold text-slate-900 text-lg">{consulta.paciente_nombre}</p>
              <p className="text-sm text-slate-500">{new Date(consulta.fecha_atencion).toLocaleString('es-CO')}</p>
            </div>
            <Badge variant={ESTADO_BADGE[consulta.estado] ?? 'default'}>{consulta.estado}</Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><p className="text-xs text-slate-400">CUPS</p><p className="font-mono font-medium">{consulta.cups_principal}</p></div>
            <div><p className="text-xs text-slate-400">DX principal</p><p className="font-mono font-medium">{consulta.diagnostico_principal}</p></div>
            <div><p className="text-xs text-slate-400">Valor consulta</p><p className="font-medium">${consulta.valor_consulta?.toLocaleString('es-CO')}</p></div>
            <div><p className="text-xs text-slate-400">Total</p><p className="font-bold text-halu-700">${consulta.valor_total?.toLocaleString('es-CO')}</p></div>
          </div>
        </Card>

        {/* Registro clínico */}
        {(consulta.motivo_consulta || consulta.enfermedad_actual || consulta.examen_fisico || consulta.plan_tratamiento) && (
          <Card>
            <h3 className="font-semibold text-slate-900 text-sm mb-4 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-teal-600" />Registro clínico
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Motivo', val: consulta.motivo_consulta },
                { label: 'Enfermedad actual', val: consulta.enfermedad_actual },
                { label: 'Examen físico', val: consulta.examen_fisico },
                { label: 'Plan de tratamiento', val: consulta.plan_tratamiento },
              ].filter(r => r.val).map(r => (
                <div key={r.label}>
                  <p className="text-xs text-slate-400 mb-0.5">{r.label}</p>
                  <p className="text-sm text-slate-700">{r.val}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Procedimientos */}
        {consulta.procedimientos?.length > 0 && (
          <Card>
            <h3 className="font-semibold text-slate-900 text-sm mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-600" />Procedimientos ({consulta.procedimientos.length})
            </h3>
            <div className="space-y-2">
              {consulta.procedimientos.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl text-sm">
                  <div>
                    <span className="font-mono text-xs text-slate-500 mr-2">{p.cups}</span>
                    <span className="text-slate-800">{p.descripcion}</span>
                    <span className="text-xs text-slate-400 ml-2">x{p.cantidad}</span>
                  </div>
                  <span className="font-medium text-slate-900">${Number(p.valor_facturar).toLocaleString('es-CO')}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Órdenes médicas */}
        <OrdenesPanel consultaId={id} />

        {/* Medicamentos RIPS */}
        <MedicamentosRIPSPanel consultaId={id} />

        {/* Acciones */}
        <div className="flex flex-col gap-2">
          {consulta.estado === 'cerrada' && usuario?.permisos.puede_facturar && (
            <Button onClick={crearFactura} loading={facturando} className="w-full">
              <Receipt className="w-4 h-4" />Crear factura electrónica SS-CUFE
            </Button>
          )}
          <Link href={`/pacientes/${consulta.paciente}`}>
            <Button variant="secondary" className="w-full"><User className="w-4 h-4" />Ver paciente</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
