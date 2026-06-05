'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { facturasPGPAPI, mensajeError } from '@/lib/api'
import { FacturaPGP } from '@/types'
import { Spinner } from '@/components/ui'
import { ArrowLeft, FileText, RefreshCw, QrCode, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const COP = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0)

function fmtFecha(s: string) {
  if (!s) return ''
  return new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

const ESTADO_CONFIG = {
  borrador: { label: 'Borrador',         color: 'bg-slate-100 text-slate-700',  icon: null },
  enviada:  { label: 'Enviada a DIAN',   color: 'bg-blue-100 text-blue-700',    icon: null },
  validada: { label: 'Validada DIAN',    color: 'bg-green-100 text-green-700',  icon: CheckCircle2 },
  error:    { label: 'Error validación', color: 'bg-red-100 text-red-700',      icon: XCircle },
  anulada:  { label: 'Anulada',          color: 'bg-gray-100 text-gray-500',    icon: null },
}

export default function FacturaPGPDetallePage({ params }: { params: { id: string } }) {
  const { id } = params
  const [factura, setFactura] = useState<FacturaPGP | null>(null)
  const [loading, setLoading] = useState(true)
  const [reintentando, setReintentando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = () => {
    facturasPGPAPI.get(id)
      .then(({ data }) => setFactura(data))
      .catch(err => setError(mensajeError(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [id])

  const reintentar = async () => {
    if (!factura) return
    setReintentando(true)
    setError(null)
    try {
      await facturasPGPAPI.reintentar(factura.id)
      toast.success('Factura PGP enviada a DIAN.')
      const { data } = await facturasPGPAPI.get(id)
      setFactura(data)
    } catch (err) {
      const msg = mensajeError(err)
      setError(msg)
      toast.error(msg, { duration: 8000 })
      const { data } = await facturasPGPAPI.get(id).catch(() => ({ data: factura }))
      setFactura(data)
    } finally {
      setReintentando(false)
    }
  }

  const descargarPDF = () => {
    if (!factura) return
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<title>PGP ${factura.numero_factus || factura.id}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:10px;color:#111;padding:18px;background:#fff}
.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1a56db;padding-bottom:12px;margin-bottom:14px}
.brand h1{font-size:20px;color:#1a56db;font-weight:900}.brand p{font-size:9px;color:#555}
.fev-box{text-align:right}.badge{background:#0e7490;color:#fff;padding:2px 7px;border-radius:3px;font-size:8px;font-weight:bold}
.num{font-size:20px;font-weight:900;margin:4px 0}.fecha{font-size:9px;color:#555}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.box{border:1px solid #e2e8f0;border-radius:4px;padding:8px}
.box h3{font-size:9px;color:#888;text-transform:uppercase;margin-bottom:5px;border-bottom:1px solid #f1f5f9;padding-bottom:4px}
.box p{font-size:10px;line-height:1.7}
.big-value{font-size:28px;font-weight:900;color:#0e7490;margin:8px 0}
.dian{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:4px;padding:8px;margin-top:12px}
.dian h3{font-size:9px;color:#166534;text-transform:uppercase;margin-bottom:6px}
.dian p{font-size:9px;color:#15803d;line-height:1.8;word-break:break-all}
.label{font-size:8px;color:#94a3b8;text-transform:uppercase}
</style></head><body>
<div class="top">
  <div class="brand">
    <h1>HaluMedic</h1>
    <p style="margin-top:6px;line-height:1.5">Sistema de Facturación Electrónica en Salud</p>
  </div>
  <div class="fev-box">
    <span class="badge">PGP · MODALIDAD GLOBAL PROSPECTIVO</span>
    <div class="num">${factura.numero_factus || 'BORRADOR'}</div>
    <div class="fecha">Período: ${fmtFecha(factura.periodo_desde)} — ${fmtFecha(factura.periodo_hasta)}</div>
    ${factura.estado === 'validada' ? '<div style="color:#059669;font-weight:bold;font-size:9px;margin-top:4px">✓ VALIDADA POR LA DIAN</div>' : ''}
  </div>
</div>

<div class="grid2">
  <div class="box">
    <h3>EPS / Aseguradora</h3>
    <p><strong>${factura.convenio_info?.aseguradora_nombre || ''}</strong></p>
    <p class="label">NIT</p><p>${factura.convenio_info?.aseguradora_nit || ''}</p>
    <p class="label">Contrato EPS</p><p>${factura.numero_contrato_eps || factura.convenio_info?.numero_contrato || ''}</p>
  </div>
  <div class="box">
    <h3>Concepto de facturación</h3>
    <p style="line-height:1.8">${factura.descripcion_contrato}</p>
  </div>
</div>

<div class="box" style="margin-bottom:12px;text-align:center">
  <p class="label">Valor Global del Contrato</p>
  <div class="big-value">${COP(Number(factura.valor_total))}</div>
  <p style="font-size:9px;color:#475569">Los valores de los RIPS van en cero (0) según modalidad PGP</p>
</div>

${factura.cufe ? `<div class="dian">
  <h3>✓ Validación DIAN</h3>
  ${factura.cufe ? `<p class="label">CUFE</p><p>${factura.cufe}</p>` : ''}
  ${factura.convenio_info?.cucon ? `<p class="label" style="margin-top:4px">CUCON</p><p>${factura.convenio_info.cucon}</p>` : ''}
  ${factura.cuv ? `<p class="label" style="margin-top:4px">CUV (MinSalud)</p><p>${factura.cuv}</p>` : ''}
  ${factura.fecha_validacion ? `<p class="label" style="margin-top:4px">Fecha validación</p><p>${fmtFecha(factura.fecha_validacion)}</p>` : ''}
</div>` : ''}
</body></html>`

    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400) }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (!factura) return <div className="page-padding"><p className="text-red-600">{error || 'No encontrada'}</p></div>

  const est = ESTADO_CONFIG[factura.estado] ?? ESTADO_CONFIG.borrador
  const EstIcon = est.icon
  const puedeReintentar = ['borrador', 'error', 'enviada'].includes(factura.estado)
  const convenio = factura.convenio_info || {}

  return (
    <div className="page-padding max-w-4xl animate-fade-in">
      {/* Header */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Link href="/facturacion/pgp">
              <button className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </Link>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Factura PGP · Pago Global Prospectivo</p>
              <h1 className="text-2xl font-black tracking-tight">
                {factura.numero_factus || <span className="text-slate-400 italic">Sin número</span>}
              </h1>
              <p className="text-sm text-slate-300 mt-1">
                {fmtFecha(factura.periodo_desde)} — {fmtFecha(factura.periodo_hasta)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${est.color}`}>
              {EstIcon && <EstIcon className="w-3 h-3" />}
              {est.label}
            </div>
            <div className="text-3xl font-black mt-3">{COP(Number(factura.valor_total))}</div>
            <p className="text-xs text-slate-400 mt-1">Valor global del contrato</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* EPS */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">EPS / Aseguradora</p>
          <p className="text-base font-bold text-slate-900">{convenio.aseguradora_nombre || '—'}</p>
          <div className="grid grid-cols-2 gap-x-4 mt-3 text-sm">
            <div>
              <p className="text-xs text-slate-400">NIT</p>
              <p className="font-medium text-slate-800">{convenio.aseguradora_nit || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Contrato EPS</p>
              <p className="font-medium text-slate-800">{factura.numero_contrato_eps || convenio.numero_contrato || '—'}</p>
            </div>
          </div>
        </div>

        {/* Concepto */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Concepto facturado</p>
          <p className="text-sm text-slate-800 leading-relaxed">{factura.descripcion_contrato}</p>
          <div className="mt-3 bg-cyan-50 border border-cyan-100 rounded-lg px-3 py-2">
            <p className="text-xs text-cyan-700 font-medium">
              Modalidad: <strong>Global Prospectivo (PGP/Capitado)</strong>
            </p>
            <p className="text-xs text-cyan-600 mt-0.5">Los valores de los RIPS se reportan en cero</p>
          </div>
        </div>
      </div>

      {/* DIAN block */}
      {(factura.cufe || factura.errores_dian?.length > 0) && (
        <div className={`rounded-xl p-4 mb-4 ${factura.estado === 'validada' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2 ${factura.estado === 'validada' ? 'text-green-700' : 'text-red-700'}`}>
            {factura.estado === 'validada' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {factura.estado === 'validada' ? 'Validado por la DIAN' : 'Errores de validación'}
          </p>
          {factura.cufe && (
            <div className="mb-2">
              <p className="text-xs text-green-600 font-medium">CUFE</p>
              <p className="text-xs font-mono text-green-800 break-all">{factura.cufe}</p>
            </div>
          )}
          {convenio.cucon && (
            <div className="mb-2">
              <p className="text-xs text-green-600 font-medium">CUCON (Res. 948/2026)</p>
              <p className="text-xs font-mono text-green-800 break-all">{convenio.cucon}</p>
            </div>
          )}
          {factura.cuv && (
            <div className="mb-2">
              <p className="text-xs text-green-600 font-medium">CUV MinSalud</p>
              <p className="text-xs font-mono text-green-800 break-all">{factura.cuv}</p>
            </div>
          )}
          {factura.errores_dian?.length > 0 && (
            <ul className="text-xs text-red-700 space-y-1 mt-2">
              {factura.errores_dian.map((e, i) => <li key={i}>• {e}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Error de sesión */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700">{error}</div>
      )}

      {/* Acciones */}
      <div className="flex flex-wrap gap-3">
        {puedeReintentar && (
          <button
            onClick={reintentar}
            disabled={reintentando}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {reintentando ? <Spinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
            {reintentando ? 'Enviando…' : (factura.estado === 'borrador' ? 'Enviar a DIAN' : 'Reintentar')}
          </button>
        )}

        <button
          onClick={descargarPDF}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <FileText className="w-4 h-4" />
          Representación gráfica
        </button>

        {factura.tiene_rips && (
          <Link href={`/facturacion/pgp/${factura.id}/rips`}>
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
              <QrCode className="w-4 h-4" />
              Ver RIPS
            </button>
          </Link>
        )}

        {factura.qr_url && (
          <a href={factura.qr_url} target="_blank" rel="noopener noreferrer">
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
              <QrCode className="w-4 h-4" />
              QR DIAN
            </button>
          </a>
        )}
      </div>

      <p className="text-xs text-slate-400 mt-4">
        Creada: {fmtFecha(factura.creado_en)}
        {factura.fecha_validacion && ` · Validada: ${fmtFecha(factura.fecha_validacion)}`}
      </p>
    </div>
  )
}
