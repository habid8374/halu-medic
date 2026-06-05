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
    const info = factura.consulta_info || {}
    const items: Array<{cups:string;descripcion:string;cantidad:number;valor_unit:number;total:number}> = info.items || []
    const tieneEPS = !!info.eps_nombre
    const regimen: Record<string,string> = { C:'Contributivo', S:'Subsidiado', V:'Vinculado', P:'Particular', A:'ARL', T:'SOAT' }
    const fmt = (v: number) => new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 }).format(v)
    const itemsHtml = items.map(it => `
      <tr>
        <td>${it.cups}</td>
        <td>${it.descripcion}</td>
        <td style="text-align:center">${it.cantidad}</td>
        <td style="text-align:right">${fmt(it.valor_unit)}</td>
        <td style="text-align:right">${fmt(it.total)}</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>FEV ${factura.numero_factus}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:10px;color:#111;padding:18px;background:#fff}
  .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1a56db;padding-bottom:12px;margin-bottom:14px}
  .brand h1{font-size:20px;color:#1a56db;font-weight:900;letter-spacing:-0.5px}
  .brand p{font-size:9px;color:#555;margin-top:2px}
  .brand .sub{font-size:9px;color:#777;margin-top:6px;line-height:1.5}
  .fev-box{text-align:right}
  .fev-box .badge{background:#1a56db;color:#fff;padding:3px 8px;border-radius:3px;font-size:9px;font-weight:bold}
  .fev-box .num{font-size:20px;font-weight:900;color:#111;margin:4px 0}
  .fev-box .fecha{font-size:9px;color:#555}
  .validada{color:#059669;font-weight:bold;font-size:9px;margin-top:4px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
  .box{border:1px solid #e2e8f0;border-radius:4px;padding:8px}
  .box h3{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;border-bottom:1px solid #f1f5f9;padding-bottom:4px}
  .box p{font-size:10px;line-height:1.6}
  .box strong{color:#111}
  section{margin-bottom:12px}
  section h3{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.5px;background:#f8fafc;padding:5px 8px;border-left:3px solid #1a56db;margin-bottom:0}
  table{width:100%;border-collapse:collapse}
  thead th{background:#1e40af;color:#fff;padding:5px 8px;font-size:9px;text-align:left}
  tbody td{padding:5px 8px;border-bottom:1px solid #f1f5f9;font-size:10px}
  tbody tr:nth-child(even) td{background:#f8fafc}
  .iva-row td{color:#888;font-style:italic}
  .grid3{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
  .totales-table td{padding:4px 8px;border:none}
  .total-row td{font-weight:bold;font-size:12px;border-top:2px solid #1a56db;padding-top:6px}
  .eps-row td{color:#059669;font-weight:bold}
  .dian-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:4px;padding:10px;margin-bottom:12px}
  .dian-box h3{font-size:9px;color:#059669;text-transform:uppercase;margin-bottom:8px}
  .dian-field{margin-bottom:6px}
  .dian-field label{font-size:8px;color:#888;display:block}
  .dian-field span{font-size:8px;font-family:monospace;color:#111;word-break:break-all}
  .bottom-row{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;border-top:1px solid #e2e8f0;padding-top:8px;margin-bottom:10px}
  .bottom-cell label{font-size:8px;color:#888;display:block}
  .bottom-cell span{font-size:9px;font-weight:bold}
  .footer{font-size:8px;color:#aaa;text-align:center;border-top:1px solid #e2e8f0;padding-top:8px}
  @media print{body{padding:10px}}
</style>
</head>
<body>

<!-- ENCABEZADO -->
<div class="top">
  <div class="brand">
    <h1>HaluMedic</h1>
    <p>Sistema de Gestión Clínica</p>
    <div class="sub">
      ${info.consultorio_nombre || 'Consultorio'}<br/>
      NIT: ${info.consultorio_nit || ''} &nbsp;|&nbsp; Cód. Prestador: ${info.consultorio_cod_prestador || ''}<br/>
      ${info.consultorio_direccion || ''}<br/>
      ${info.consultorio_tel ? 'Tel: ' + info.consultorio_tel : ''}
    </div>
  </div>
  <div class="fev-box">
    <div class="badge">${tipoOperacionLabel(factura)} · Sector Salud</div>
    <div class="num">${factura.numero_factus}</div>
    <div class="fecha">Factura electrónica de venta<br/>Fecha: ${formatFechaFactura(factura.fecha_validacion)}</div>
    <div class="validada">✓ Validada DIAN</div>
  </div>
</div>

<!-- EPS / PACIENTE -->
<div class="grid2">
  ${tieneEPS ? `
  <div class="box">
    <h3>Adquirente (EPS)</h3>
    <p><strong>${info.eps_nombre}</strong><br/>
    NIT: ${info.eps_nit}<br/>
    Régimen: ${regimen[info.regimen] || info.regimen}<br/>
    ${info.num_contrato ? 'Contrato: ' + info.num_contrato : ''}
    ${factura.convenio_cucon ? '<br/>CUCON: ' + factura.convenio_cucon : ''}</p>
  </div>` : `
  <div class="box">
    <h3>Paciente (Particular)</h3>
    <p><strong>${info.paciente}</strong><br/>
    ${info.paciente_doc}<br/>
    Régimen: ${regimen[info.regimen] || 'Particular'}</p>
  </div>`}
  <div class="box">
    <h3>Paciente Beneficiario</h3>
    <p><strong>${info.paciente}</strong><br/>
    ${info.paciente_doc}<br/>
    ${info.num_autorizacion ? 'Autorización: ' + info.num_autorizacion : 'Sin autorización'}</p>
  </div>
</div>

<!-- DETALLE DE SERVICIOS -->
<section>
  <h3>Detalle de Servicios</h3>
  <table>
    <thead><tr><th>CUPS</th><th>Descripción</th><th style="text-align:center">Cant.</th><th style="text-align:right">Vlr. Unit.</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${itemsHtml}</tbody>
    <tbody><tr class="iva-row"><td colspan="4">IVA: Exento — Servicios de salud Art. 476 E.T.</td><td style="text-align:right">$0</td></tr></tbody>
  </table>
</section>

<!-- APORTES + RESUMEN -->
<div class="grid3">
  <div class="box">
    <h3>Aportes del Paciente</h3>
    <table class="totales-table">
      <tr><td>${info.regimen === 'C' ? 'Cuota moderadora' : info.regimen === 'S' ? 'Copago' : 'Pagos voluntarios'}</td><td style="text-align:right">${fmt(Number(factura.valor_copago) || 0)}</td></tr>
      <tr><td>Pagos voluntarios</td><td style="text-align:right">$0</td></tr>
      <tr style="border-top:1px solid #e2e8f0"><td><strong>Total aporte</strong></td><td style="text-align:right"><strong>${fmt(Number(factura.valor_copago) || 0)}</strong></td></tr>
    </table>
  </div>
  <div class="box">
    <h3>Resumen Factura</h3>
    <table class="totales-table">
      <tr><td>Subtotal</td><td style="text-align:right">${fmt(Number(factura.subtotal))}</td></tr>
      <tr><td>Descuento</td><td style="text-align:right">${fmt(Number(factura.descuento) || 0)}</td></tr>
      <tr><td>IVA (0%)</td><td style="text-align:right">$0</td></tr>
      <tr class="total-row"><td><strong>Total factura</strong></td><td style="text-align:right"><strong>${fmt(Number(factura.total))}</strong></td></tr>
      ${tieneEPS ? `<tr class="eps-row"><td>A cobrar a EPS</td><td style="text-align:right">${fmt((info.a_cobrar_eps ?? Number(factura.total)))}</td></tr>` : ''}
    </table>
  </div>
</div>

<!-- DATOS DIAN -->
<div class="dian-box">
  <h3>Datos de Validación DIAN</h3>
  <div class="dian-field"><label>CUFE</label><span>${factura.cufe || ''}</span></div>
  ${factura.cuv ? `<div class="dian-field"><label>CUV MinSalud (MUV)</label><span style="color:#059669">${factura.cuv}</span></div>` : ''}
</div>

<!-- FILA INFERIOR -->
<div class="bottom-row">
  <div class="bottom-cell"><label>Cobertura</label><span>${tieneEPS ? (regimen[info.regimen] || info.regimen) + ' (0' + ({C:'1',S:'2',V:'3',P:'5',A:'4',T:'6'}[info.regimen]||'5') + ')' : 'Particular (05)'}</span></div>
  <div class="bottom-cell"><label>Modalidad pago</label><span>Por evento (01)</span></div>
  <div class="bottom-cell"><label>Tipo operación</label><span>${tipoOperacionLabel(factura)}</span></div>
  <div class="bottom-cell"><label>Forma de pago</label><span>Crédito 30 días</span></div>
</div>

<div class="footer">
  Generado por Halu Medic · Facturación electrónica procesada por Factus API · PT habilitado DIAN
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
