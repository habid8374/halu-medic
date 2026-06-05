'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useFactura } from '@/hooks/useFacturas'
import { useAuth } from '@/lib/auth-context'
import { facturasAPI } from '@/lib/api'
import { ESTADO_FACTURA, formatCOP, formatFechaFactura, tipoOperacionLabel } from '@/components/facturacion/helpers'
import { Badge, Button, Card, Spinner, PageHeader } from '@/components/ui'
import {
  ArrowLeft, CheckCircle, AlertCircle, Send, FileText,
  Download, QrCode, RefreshCw, User, Receipt
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function FacturaDetallePage({ params }: { params: { id: string } }) {
  const { id }   = params
  const { usuario } = useAuth()
  const { factura, loading, setFactura } = useFactura(id)
  const [emitiendo, setEmitiendo] = useState(false)
  const [reintentando, setReintentando] = useState(false)

  const emitir = async () => {
    if (!factura) return
    setEmitiendo(true)
    try {
      await facturasAPI.emitir(factura.id)
      toast.success('Factura enviada a DIAN. Recibirás el CUFE en breve.')
      const { data } = await facturasAPI.get(factura.id)
      setFactura(data)
    } catch {
      toast.error('Error al emitir la factura')
    } finally { setEmitiendo(false) }
  }

  const reintentar = async () => {
    if (!factura) return
    setReintentando(true)
    try {
      await facturasAPI.reintentar(factura.id)
      toast.success('Reintentando envío a DIAN...')
      setTimeout(async () => {
        const { data } = await facturasAPI.get(factura.id)
        setFactura(data)
        setReintentando(false)
      }, 3000)
    } catch {
      toast.error('Error al reintentar')
      setReintentando(false)
    }
  }

  const descargarPDF = async () => {
    if (!factura) return
    try {
      const { data } = await facturasAPI.pdf(factura.id)
      const link = document.createElement('a')
      link.href = `data:application/pdf;base64,${data.pdf_base64}`
      link.download = `factura-${data.numero}.pdf`
      link.click()
    } catch {
      toast.error('PDF no disponible aún')
    }
  }

  if (loading) return <div className="page-padding flex justify-center py-20"><Spinner size="lg" /></div>
  if (!factura) return <div className="p-8"><p className="text-slate-500">Factura no encontrada.</p></div>

  const est = ESTADO_FACTURA[factura.estado]

  return (
    <div className="page-padding max-w-3xl animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/facturacion"><Button variant="ghost" className="px-2"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <PageHeader title="Factura electrónica" description={factura.numero_factus || 'En proceso'} />
      </div>

      <div className="space-y-4">
        {/* Estado y tipo */}
        <Card>
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-xs text-slate-400 mb-1">Tipo de operación</p>
              <p className="font-semibold text-slate-900">{tipoOperacionLabel(factura)}</p>
              <p className="text-xs text-slate-500 mt-1">Resolución 948/2026 · Factus API DIAN</p>
            </div>
            <Badge variant={est.badge}>{est.label}</Badge>
          </div>

          {/* Paciente */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl mb-4">
            <User className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-400">Paciente</p>
              <p className="text-sm font-medium text-slate-800">{factura.consulta_info?.paciente}</p>
            </div>
            <div className="ml-auto">
              <p className="text-xs text-slate-400">CUPS</p>
              <p className="text-sm font-mono text-slate-700">{factura.consulta_info?.cups}</p>
            </div>
          </div>

          {/* Totales */}
          <div className="space-y-2">
            {[
              { label: 'Subtotal', valor: factura.subtotal },
              { label: 'Descuento', valor: factura.descuento },
              { label: 'IVA (exento servicios salud)', valor: factura.iva },
              { label: 'Copago / Cuota moderadora', valor: factura.valor_copago },
            ].map(row => (
              <div key={row.label} className="flex justify-between text-sm">
                <span className="text-slate-500">{row.label}</span>
                <span className="text-slate-800">{formatCOP(row.valor)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-3 border-t border-slate-100">
              <span className="font-bold text-slate-900">Total</span>
              <span className="font-bold text-slate-900 text-lg">{formatCOP(factura.total)}</span>
            </div>
          </div>
        </Card>

        {/* DIAN info */}
        {(factura.cufe || factura.cuv || factura.numero_factus) && (
          <Card>
            <h3 className="font-semibold text-slate-900 text-sm mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              Información DIAN / MinSalud
            </h3>
            <div className="space-y-3">
              {factura.numero_factus && (
                <div>
                  <p className="text-xs text-slate-400">Número FEV</p>
                  <p className="text-sm font-mono text-slate-800">{factura.numero_factus}</p>
                </div>
              )}
              {factura.cufe && (
                <div>
                  <p className="text-xs text-slate-400">CUFE</p>
                  <p className="text-xs font-mono text-slate-600 break-all">{factura.cufe}</p>
                </div>
              )}
              {factura.cuv && (
                <div>
                  <p className="text-xs text-slate-400">CUV (MUV MinSalud)</p>
                  <p className="text-xs font-mono text-teal-700 break-all">{factura.cuv}</p>
                </div>
              )}
              {factura.fecha_validacion && (
                <div>
                  <p className="text-xs text-slate-400">Validada el</p>
                  <p className="text-sm text-slate-700">{formatFechaFactura(factura.fecha_validacion)}</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Errores DIAN */}
        {factura.errores_dian?.length > 0 && (
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <h3 className="font-semibold text-red-600 text-sm">Errores de validación DIAN</h3>
            </div>
            <div className="space-y-1.5">
              {factura.errores_dian.map((e, i) => (
                <p key={i} className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{e}</p>
              ))}
            </div>
          </Card>
        )}

        {/* Acciones */}
        {usuario?.permisos.puede_facturar && (
          <div className="flex flex-col gap-2">
            {(factura.estado === 'borrador' || factura.estado === 'error') && (
              <Button onClick={emitir} loading={emitiendo} className="w-full">
                <Send className="w-4 h-4" />
                {factura.estado === 'error' ? 'Reintentar emisión DIAN' : 'Emitir ante DIAN (SS-CUFE)'}
              </Button>
            )}
            {factura.estado === 'enviada' && (
              <div className="space-y-2">
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 text-center">
                  ⏳ Procesando en DIAN... Si lleva más de 5 min, usa los botones de abajo.
                </p>
                <Button onClick={reintentar} loading={reintentando} variant="secondary" className="w-full">
                  <RefreshCw className="w-4 h-4" />
                  Reenviar a Factus
                </Button>
              </div>
            )}
            {factura.estado === 'validada' && (
              <>
                <Button onClick={descargarPDF} variant="secondary" className="w-full">
                  <Download className="w-4 h-4" />
                  Descargar PDF
                </Button>
                {factura.tiene_rips && (
                  <Link href={`/facturacion/${factura.id}/rips`}>
                    <Button variant="secondary" className="w-full">
                      <FileText className="w-4 h-4" />
                      Ver RIPS JSON (Res. 948/2026)
                    </Button>
                  </Link>
                )}
              </>
            )}
            <Link href={`/pacientes/${factura.consulta}`}>
              <Button variant="ghost" className="w-full">
                <User className="w-4 h-4" />
                Ver paciente
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
