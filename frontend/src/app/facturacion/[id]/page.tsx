'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useFactura } from '@/hooks/useFacturas'
import { useAuth } from '@/lib/auth-context'
import { facturasAPI, mensajeError } from '@/lib/api'
import { ESTADO_FACTURA, formatCOP, formatFechaFactura, tipoOperacionLabel } from '@/components/facturacion/helpers'
import { Badge, Button, Card, Spinner, PageHeader } from '@/components/ui'
import {
  ArrowLeft, CheckCircle, AlertCircle, Send, FileText,
  Download, RefreshCw, User,
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function FacturaDetallePage({ params }: { params: { id: string } }) {
  const { id } = params
  const { usuario } = useAuth()
  const { factura, loading, setFactura } = useFactura(id)
  const [emitiendo, setEmitiendo] = useState(false)
  const [reintentando, setReintentando] = useState(false)
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null)

  const refrescar = async () => {
    const { data } = await facturasAPI.get(id)
    setFactura(data)
  }

  const emitir = async () => {
    if (!factura) return
    setEmitiendo(true)
    setErrorDetalle(null)
    try {
      await facturasAPI.emitir(factura.id)
      toast.success('Factura enviada a DIAN.')
      await refrescar()
    } catch (err) {
      const msg = mensajeError(err)
      setErrorDetalle(msg)
      toast.error(msg, { duration: 6000 })
    } finally {
      setEmitiendo(false)
    }
  }

  const reintentar = async () => {
    if (!factura) return
    setReintentando(true)
    setErrorDetalle(null)
    try {
      const { data } = await facturasAPI.reintentar(factura.id)
      if (data.estado === 'validada') {
        toast.success(`✓ Factura validada — ${data.numero}`)
      } else {
        toast.success('Reenvío procesado.')
      }
      await refrescar()
    } catch (err) {
      const msg = mensajeError(err)
      setErrorDetalle(msg)
      toast.error(msg, { duration: 8000 })
      await refrescar()
    } finally {
      setReintentando(false)
    }
  }

  const descargarPDF = () => {
    if (!factura) return
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Factura ${factura.numero_factus}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 0; padding: 20px; }
  .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0d6efd; padding-bottom: 12px; margin-bottom: 16px; }
  .logo-area h1 { font-size: 18px; color: #0d6efd; margin: 0; }
  .logo-area p { margin: 2px 0; font-size: 10px; color: #555; }
  .badge { background: #198754; color: #fff; padding: 4px 10px; border-radius: 4px; font-size: 10px; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { background: #f1f5f9; text-align: left; padding: 6px 8px; font-size: 10px; color: #444; }
  td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
  .totales td { border: none; }
  .total-final td { font-weight: bold; font-size: 13px; border-top: 2px solid #0d6efd; }
  .cufe { font-size: 8px; color: #555; word-break: break-all; background: #f8fafc; padding: 8px; border-radius: 4px; margin-top: 8px; }
  .footer { margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 9px; color: #888; text-align: center; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<div class="header">
  <div class="logo-area">
    <h1>FACTURA ELECTRÓNICA DE SALUD</h1>
    <p>Resolución 948/2026 · Factus API DIAN</p>
    <p><strong>No. FEV:</strong> ${factura.numero_factus}</p>
    <p><strong>Tipo:</strong> ${tipoOperacionLabel(factura)}</p>
  </div>
  <div>
    <span class="badge">VALIDADA DIAN</span>
    <p style="margin-top:8px;font-size:10px;">Fecha: ${formatFechaFactura(factura.fecha_validacion)}</p>
  </div>
</div>

<table>
  <tr><th colspan="2">PACIENTE</th></tr>
  <tr><td><strong>${factura.consulta_info?.paciente || ''}</strong></td><td>CUPS: ${factura.consulta_info?.cups || ''}</td></tr>
</table>

<table>
  <thead><tr><th>Descripción</th><th style="text-align:right">Valor</th></tr></thead>
  <tbody class="totales">
    <tr><td>Subtotal</td><td style="text-align:right">${formatCOP(factura.subtotal)}</td></tr>
    <tr><td>Descuento</td><td style="text-align:right">${formatCOP(factura.descuento)}</td></tr>
    <tr><td>IVA (exento servicios salud)</td><td style="text-align:right">${formatCOP(factura.iva)}</td></tr>
    <tr><td>Copago / Cuota moderadora</td><td style="text-align:right">${formatCOP(factura.valor_copago)}</td></tr>
  </tbody>
  <tbody class="total-final">
    <tr><td><strong>TOTAL</strong></td><td style="text-align:right"><strong>${formatCOP(factura.total)}</strong></td></tr>
  </tbody>
</table>

<div class="cufe">
  <strong>CUFE:</strong> ${factura.cufe}
</div>

<div class="footer">
  Documento tributario válido ante la DIAN — Generado por Halu Medic
</div>
</body>
</html>`

    const win = window.open('', '_blank')
    if (!win) { toast.error('Permite ventanas emergentes para descargar el PDF'); return }
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 500)
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

        {/* Error de operación (HTTP / red / Factus) */}
        {errorDetalle && (
          <Card>
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-600 mb-1">Error al procesar</p>
                <p className="text-xs text-red-700 font-mono break-all">{errorDetalle}</p>
              </div>
            </div>
          </Card>
        )}

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

        {/* Errores DIAN guardados en la factura */}
        {factura.errores_dian?.length > 0 && (
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <h3 className="font-semibold text-red-600 text-sm">Errores de validación DIAN</h3>
            </div>
            <div className="space-y-1.5">
              {factura.errores_dian.map((e: string, i: number) => (
                <p key={i} className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg font-mono break-all">{e}</p>
              ))}
            </div>
          </Card>
        )}

        {/* Acciones */}
        {usuario?.permisos.puede_facturar && (
          <div className="flex flex-col gap-2">
            {(factura.estado === 'borrador') && (
              <Button onClick={emitir} loading={emitiendo} className="w-full">
                <Send className="w-4 h-4" />
                Emitir ante DIAN (SS-CUFE)
              </Button>
            )}
            {(factura.estado === 'error' || factura.estado === 'enviada') && (
              <Button onClick={reintentar} loading={reintentando} className="w-full">
                <RefreshCw className="w-4 h-4" />
                Reenviar a Factus
              </Button>
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
