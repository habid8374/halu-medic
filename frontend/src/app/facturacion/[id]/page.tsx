'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useFactura } from '@/hooks/useFacturas'
import { useAuth } from '@/lib/auth-context'
import { facturasAPI, mensajeError } from '@/lib/api'
import { tipoOperacionLabel, formatFechaFactura } from '@/components/facturacion/helpers'
import { Spinner } from '@/components/ui'
import { ArrowLeft, FileText, Send, RefreshCw, ExternalLink, QrCode } from 'lucide-react'
import toast from 'react-hot-toast'

const COP = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0)

const REGIMEN: Record<string, string> = { C: 'Contributivo', S: 'Subsidiado', V: 'Vinculado', P: 'Particular', A: 'ARL', T: 'SOAT' }
const COB_COD: Record<string, string> = { C: '01', S: '02', V: '03', P: '05', A: '04', T: '06' }

export default function FacturaDetallePage({ params }: { params: { id: string } }) {
  const { id } = params
  const { usuario } = useAuth()
  const { factura, loading, setFactura } = useFactura(id)
  const [reintentando, setReintentando] = useState(false)
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null)

  const refrescar = async () => {
    const { data } = await facturasAPI.get(id)
    setFactura(data)
  }

  const reintentar = async () => {
    if (!factura) return
    setReintentando(true)
    setErrorDetalle(null)
    try {
      await facturasAPI.reintentar(factura.id)
      toast.success('Factura reenvíada a DIAN.')
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
    const items = info.items || []
    const tieneEPS = !!info.eps_nombre
    const fmt = COP
    const itemsHtml = items.map((it: { cups: string; descripcion: string; cantidad: number; valor_unit: number; total: number }) => `
      <tr>
        <td>${it.cups}</td>
        <td>${it.descripcion}</td>
        <td style="text-align:center">${it.cantidad}</td>
        <td style="text-align:right">${fmt(it.valor_unit)}</td>
        <td style="text-align:right">${fmt(it.total)}</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<title>FEV ${factura.numero_factus}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:10px;color:#111;padding:18px;background:#fff}
.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1a56db;padding-bottom:12px;margin-bottom:14px}
.brand h1{font-size:20px;color:#1a56db;font-weight:900}.brand p{font-size:9px;color:#555;margin-top:2px}
.brand .sub{font-size:9px;color:#777;margin-top:6px;line-height:1.5}
.fev-box{text-align:right}.fev-box .badge{background:#1a56db;color:#fff;padding:3px 8px;border-radius:3px;font-size:9px;font-weight:bold}
.fev-box .num{font-size:20px;font-weight:900;margin:4px 0}.fev-box .fecha{font-size:9px;color:#555}
.validada{color:#059669;font-weight:bold;font-size:9px;margin-top:4px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.box{border:1px solid #e2e8f0;border-radius:4px;padding:8px}
.box h3{font-size:9px;color:#888;text-transform:uppercase;margin-bottom:6px;border-bottom:1px solid #f1f5f9;padding-bottom:4px}
.box p{font-size:10px;line-height:1.6}
section{margin-bottom:12px}
section h3{font-size:9px;color:#888;text-transform:uppercase;background:#f8fafc;padding:5px 8px;border-left:3px solid #1a56db;margin-bottom:0}
table{width:100%;border-collapse:collapse}
thead th{background:#1e40af;color:#fff;padding:5px 8px;font-size:9px;text-align:left}
tbody td{padding:5px 8px;border-bottom:1px solid #f1f5f9;font-size:10px}
tbody tr:nth-child(even) td{background:#f8fafc}
.iva-row td{color:#888;font-style:italic}
.tbl td{padding:4px 8px;border:none}
.total-row td{font-weight:bold;font-size:12px;border-top:2px solid #1a56db;padding-top:6px}
.eps-row td{color:#059669;font-weight:bold}
.dian-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:4px;padding:10px;margin-bottom:12px}
.dian-box h3{font-size:9px;color:#059669;text-transform:uppercase;margin-bottom:8px}
.dfield{margin-bottom:6px}.dfield label{font-size:8px;color:#888;display:block}
.dfield span{font-size:8px;font-family:monospace;word-break:break-all}
.dfield .cuv{color:#059669;font-weight:bold}
.brow{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;border-top:1px solid #e2e8f0;padding-top:8px;margin-bottom:10px}
.bcell label{font-size:8px;color:#888;display:block}.bcell span{font-size:9px;font-weight:bold}
.footer{font-size:8px;color:#aaa;text-align:center;border-top:1px solid #e2e8f0;padding-top:8px}
@media print{body{padding:10px}}
</style></head><body>
<div class="top">
  <div class="brand"><h1>HaluMedic</h1><p>Sistema de Gestión Clínica</p>
    <div class="sub"><strong>${info.consultorio_nombre || ''}</strong><br/>
    NIT: ${info.consultorio_nit || ''} &nbsp;|&nbsp; Cód. Prestador: ${info.consultorio_cod_prestador || ''}<br/>
    ${info.consultorio_direccion || ''}<br/>${info.consultorio_tel ? 'Tel: ' + info.consultorio_tel : ''}</div>
  </div>
  <div class="fev-box">
    <div class="badge">${tipoOperacionLabel(factura)} · Sector Salud</div>
    <div class="num">${factura.numero_factus}</div>
    <div class="fecha">Factura electrónica de venta<br/>Fecha: ${formatFechaFactura(factura.fecha_validacion)}</div>
    <div class="validada">✓ Validada DIAN</div>
  </div>
</div>
<div class="grid2">
  <div class="box"><h3>${tieneEPS ? 'Adquirente (EPS)' : 'Paciente (Particular)'}</h3>
    <p><strong>${tieneEPS ? info.eps_nombre : info.paciente}</strong><br/>
    NIT: ${tieneEPS ? info.eps_nit : info.consultorio_nit}<br/>
    Régimen: ${REGIMEN[info.regimen || 'P'] || 'Particular'}<br/>
    ${info.num_contrato ? 'Contrato: ' + info.num_contrato : ''}</p>
  </div>
  <div class="box"><h3>Paciente Beneficiario</h3>
    <p><strong>${info.paciente}</strong><br/>
    ${info.paciente_doc}<br/>
    Período: ${formatFechaFactura(info.fecha)} — ${formatFechaFactura(info.fecha)}<br/>
    ${info.num_autorizacion ? 'Autorización: ' + info.num_autorizacion : ''}</p>
  </div>
</div>
<section><h3>Detalle de Servicios</h3>
  <table><thead><tr><th>CUPS</th><th>Descripción</th><th style="text-align:center">Cant.</th><th style="text-align:right">Vlr. Unit.</th><th style="text-align:right">Total</th></tr></thead>
  <tbody>${itemsHtml}</tbody>
  <tbody><tr class="iva-row"><td colspan="4">IVA: Exento — Servicios de salud Art. 476 E.T.</td><td style="text-align:right">$0</td></tr></tbody>
  </table>
</section>
<div class="grid2">
  <div class="box"><h3>Aportes del Paciente</h3>
    <table class="tbl">
      <tr><td>${info.regimen === 'C' ? 'Cuota moderadora' : info.regimen === 'S' ? 'Copago' : 'Pagos voluntarios'}</td><td style="text-align:right">${fmt(Number(factura.valor_copago)||0)}</td></tr>
      <tr><td>Pagos voluntarios</td><td style="text-align:right">$0</td></tr>
      <tr style="border-top:1px solid #e2e8f0"><td><strong>Total aporte</strong></td><td style="text-align:right"><strong>${fmt(Number(factura.valor_copago)||0)}</strong></td></tr>
    </table>
  </div>
  <div class="box"><h3>Resumen Factura</h3>
    <table class="tbl">
      <tr><td>Subtotal</td><td style="text-align:right">${fmt(Number(factura.subtotal))}</td></tr>
      <tr><td>Descuento</td><td style="text-align:right">${fmt(Number(factura.descuento)||0)}</td></tr>
      <tr><td>IVA (0%)</td><td style="text-align:right">$0</td></tr>
      <tr class="total-row"><td><strong>Total factura</strong></td><td style="text-align:right"><strong>${fmt(Number(factura.total))}</strong></td></tr>
      ${tieneEPS ? `<tr class="eps-row"><td>A cobrar a EPS</td><td style="text-align:right">${fmt(info.a_cobrar_eps ?? Number(factura.total))}</td></tr>` : ''}
    </table>
  </div>
</div>
<div class="dian-box"><h3>Datos de Validación DIAN</h3>
  <div class="dfield"><label>CUFE</label><span>${factura.cufe || ''}</span></div>
  ${info.convenio_cucon ? `<div class="dfield"><label>CUCON (Res. 948/2026)</label><span>${info.convenio_cucon}</span></div>` : ''}
  ${factura.cuv ? `<div class="dfield"><label>CUV MinSalud (MUV)</label><span class="cuv">${factura.cuv}</span></div>` : ''}
</div>
<div class="brow">
  <div class="bcell"><label>Cobertura</label><span>${(REGIMEN[info.regimen||'P']||'Particular')} (${COB_COD[info.regimen||'P']||'05'})</span></div>
  <div class="bcell"><label>Modalidad pago</label><span>Por evento (01)</span></div>
  <div class="bcell"><label>Tipo operación</label><span>${tipoOperacionLabel(factura)}</span></div>
  <div class="bcell"><label>Forma de pago</label><span>Crédito 30 días</span></div>
</div>
<div class="footer">Generado por Halu Medic · Facturación electrónica procesada por Factus API · PT habilitado DIAN</div>
</body></html>`

    const win = window.open('', '_blank')
    if (!win) { toast.error('Permite ventanas emergentes para descargar el PDF'); return }
    win.document.write(html)
    win.document.close()
    setTimeout(() => { win.print() }, 500)
  }

  if (loading) return <div className="page-padding flex justify-center py-20"><Spinner size="lg" /></div>
  if (!factura) return <div className="p-8 text-slate-500">Factura no encontrada.</div>

  const info = factura.consulta_info || {}
  const items = info.items || []
  const tieneEPS = !!info.eps_nombre
  const esValidada = factura.estado === 'validada'

  return (
    <div className="page-padding max-w-3xl animate-fade-in">
      {/* Encabezado nav */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/facturacion">
          <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ArrowLeft className="w-4 h-4" /></button>
        </Link>
        <span className="text-sm text-slate-400">Facturación</span>
      </div>

      {/* Tarjeta principal — simulación de la factura */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

        {/* Header oscuro */}
        <div className="bg-slate-900 text-white p-5">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-blue-400 font-black text-lg">Halu</span><span className="text-white font-black text-lg">Medic</span>
              </div>
              <p className="text-slate-400 text-xs">Sistema de Gestión Clínica</p>
              {info.consultorio_nombre && (
                <div className="mt-2 text-xs text-slate-300 leading-relaxed">
                  <p className="font-semibold text-white">{info.consultorio_nombre}</p>
                  {info.consultorio_nit && <p>NIT: {info.consultorio_nit} | Cód. Prestador: {info.consultorio_cod_prestador}</p>}
                  {info.consultorio_direccion && <p>{info.consultorio_direccion}</p>}
                </div>
              )}
            </div>
            <div className="text-right">
              <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded font-semibold">{tipoOperacionLabel(factura)} · Sector Salud</span>
              <p className="text-white text-2xl font-black mt-2">{factura.numero_factus || '—'}</p>
              <p className="text-slate-400 text-xs">Factura electrónica de venta</p>
              {factura.fecha_validacion && <p className="text-slate-400 text-xs">Fecha: {formatFechaFactura(factura.fecha_validacion)}</p>}
              {esValidada && <p className="text-emerald-400 text-xs font-bold mt-1">✓ Validada DIAN</p>}
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">

          {/* EPS / Paciente */}
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-slate-200 rounded-xl p-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">{tieneEPS ? 'Adquirente (EPS)' : 'Paciente (Particular)'}</p>
              <p className="font-bold text-sm text-slate-900">{tieneEPS ? info.eps_nombre : info.paciente}</p>
              {tieneEPS && <p className="text-xs text-slate-500">NIT: {info.eps_nit}</p>}
              <p className="text-xs text-slate-500">Régimen: {REGIMEN[info.regimen || 'P'] || 'Particular'}</p>
              {info.num_contrato && <p className="text-xs text-slate-500">Contrato: {info.num_contrato}</p>}
            </div>
            <div className="border border-slate-200 rounded-xl p-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Paciente Beneficiario</p>
              <p className="font-bold text-sm text-slate-900">{info.paciente}</p>
              <p className="text-xs text-slate-500">{info.paciente_doc}</p>
              {info.num_autorizacion && <p className="text-xs text-slate-500">Autorización: {info.num_autorizacion}</p>}
            </div>
          </div>

          {/* Tabla servicios */}
          {items.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-2 pl-1 border-l-4 border-blue-600">Detalle de Servicios</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-blue-800 text-white">
                    <th className="text-left px-2 py-1.5">CUPS</th>
                    <th className="text-left px-2 py-1.5">Descripción</th>
                    <th className="text-center px-2 py-1.5">Cant.</th>
                    <th className="text-right px-2 py-1.5">Vlr. Unit.</th>
                    <th className="text-right px-2 py-1.5">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it: { cups: string; descripcion: string; cantidad: number; valor_unit: number; total: number }, i: number) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-2 py-1.5 font-mono">{it.cups}</td>
                      <td className="px-2 py-1.5">{it.descripcion}</td>
                      <td className="px-2 py-1.5 text-center">{it.cantidad}</td>
                      <td className="px-2 py-1.5 text-right">{COP(it.valor_unit)}</td>
                      <td className="px-2 py-1.5 text-right font-semibold">{COP(it.total)}</td>
                    </tr>
                  ))}
                  <tr className="text-slate-400 italic text-xs">
                    <td colSpan={4} className="px-2 py-1">IVA: Exento — Servicios de salud Art. 476 E.T.</td>
                    <td className="px-2 py-1 text-right">$0</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Aportes + Resumen */}
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-slate-200 rounded-xl p-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Aportes del Paciente</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span>{info.regimen === 'C' ? 'Cuota moderadora' : info.regimen === 'S' ? 'Copago' : 'Pagos voluntarios'}</span><span>{COP(Number(factura.valor_copago) || 0)}</span></div>
                <div className="flex justify-between text-slate-400"><span>Pagos voluntarios</span><span>$0</span></div>
                <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>Total aporte</span><span>{COP(Number(factura.valor_copago) || 0)}</span></div>
              </div>
            </div>
            <div className="border border-slate-200 rounded-xl p-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Resumen Factura</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span>Subtotal</span><span>{COP(Number(factura.subtotal))}</span></div>
                <div className="flex justify-between text-slate-400"><span>Descuento</span><span>$0</span></div>
                <div className="flex justify-between text-slate-400"><span>IVA (0%)</span><span>$0</span></div>
                <div className="flex justify-between font-bold text-sm border-t pt-1 mt-1"><span>Total factura</span><span>{COP(Number(factura.total))}</span></div>
                {tieneEPS && <div className="flex justify-between font-bold text-emerald-600"><span>A cobrar a EPS</span><span>{COP(info.a_cobrar_eps ?? Number(factura.total))}</span></div>}
              </div>
            </div>
          </div>

          {/* DIAN */}
          {(factura.cufe || factura.cuv || info.convenio_cucon) && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <p className="text-xs text-emerald-700 uppercase font-bold mb-2">Datos de Validación DIAN</p>
              {factura.cufe && <div className="mb-2"><p className="text-xs text-slate-400">CUFE</p><p className="text-xs font-mono text-slate-700 break-all">{factura.cufe}</p></div>}
              {info.convenio_cucon && (
                <div className="mb-2">
                  <p className="text-xs text-slate-400">CUCON (Res. 948/2026)</p>
                  <p className="text-xs font-mono text-slate-700 break-all">{info.convenio_cucon}</p>
                </div>
              )}
              {factura.cuv && <div><p className="text-xs text-slate-400">CUV MinSalud (MUV)</p><p className="text-xs font-mono text-emerald-700 font-bold">{factura.cuv}</p></div>}
            </div>
          )}

          {/* Fila metadata */}
          <div className="grid grid-cols-4 gap-2 border-t pt-3 text-xs">
            {[
              { label: 'Cobertura', value: `${REGIMEN[info.regimen||'P']||'Particular'} (${COB_COD[info.regimen||'P']||'05'})` },
              { label: 'Modalidad pago', value: 'Por evento (01)' },
              { label: 'Tipo operación', value: tipoOperacionLabel(factura) },
              { label: 'Forma de pago', value: 'Crédito 30 días' },
            ].map(col => (
              <div key={col.label}>
                <p className="text-slate-400">{col.label}</p>
                <p className="font-semibold text-slate-700">{col.value}</p>
              </div>
            ))}
          </div>

          {/* Errores */}
          {factura.errores_dian?.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              {factura.errores_dian.map((e: string, i: number) => (
                <p key={i} className="text-xs text-red-600 font-mono break-all">{e}</p>
              ))}
            </div>
          )}
          {errorDetalle && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-xs text-red-700 font-mono break-all">{errorDetalle}</p>
            </div>
          )}

          {/* Footer */}
          <p className="text-xs text-slate-400 text-center border-t pt-3">
            Generado por Halu Medic · Axentia Technologies S.A.S.<br/>
            Facturación electrónica procesada por Factus API · PT habilitado DIAN
          </p>

          {/* Acciones */}
          {usuario?.permisos.puede_facturar && (
            <div className="flex gap-2 pt-1">
              {(factura.estado === 'error' || factura.estado === 'enviada' || factura.estado === 'borrador') && (
                <button onClick={reintentar} disabled={reintentando}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50">
                  <RefreshCw className={`w-4 h-4 ${reintentando ? 'animate-spin' : ''}`} />
                  {reintentando ? 'Enviando…' : 'Reenviar a Factus'}
                </button>
              )}
              {esValidada && (
                <>
                  <button onClick={descargarPDF}
                    className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold py-2.5 rounded-xl">
                    <ExternalLink className="w-4 h-4" /> PDF
                  </button>
                  {factura.tiene_rips && (
                    <Link href={`/facturacion/${factura.id}/rips`} className="flex-1">
                      <button className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold py-2.5 rounded-xl">
                        <FileText className="w-4 h-4" /> RIPS
                      </button>
                    </Link>
                  )}
                  <button className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 px-4 rounded-xl">
                    <Send className="w-4 h-4" /> Enviar
                  </button>
                </>
              )}
              <Link href={`/pacientes/${factura.consulta}`} className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm py-2.5 px-3 rounded-xl">
                Ver paciente
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
