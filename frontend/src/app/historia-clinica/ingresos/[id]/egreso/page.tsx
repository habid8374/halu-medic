'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ingresosAPI, consultorioAPI, mensajeError } from '@/lib/api'
import toast from 'react-hot-toast'

function fmtFechaHora(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
function fmtFecha(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

const REGIMEN: Record<string, string> = {
  C: 'Contributivo', S: 'Subsidiado', V: 'Vinculado',
  P: 'Particular', A: 'ARP / ARL', T: 'SOAT', O: 'Otro',
}
const TIPO_EGRESO: Record<string, string> = {
  alta_medica: 'Alta médica', traslado: 'Traslado',
  voluntario: 'Retiro voluntario', fallecimiento: 'Fallecimiento', fuga: 'Fuga',
}

export default function OrdenEgresoPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const [ingreso, setIngreso]       = useState<any>(null)
  const [consultorio, setConsultorio] = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [reversando, setReversando] = useState(false)
  const [confirmarReversar, setConfirmarReversar] = useState(false)

  useEffect(() => {
    Promise.all([ingresosAPI.get(id), consultorioAPI.get()])
      .then(([{ data: ing }, { data: con }]) => { setIngreso(ing); setConsultorio(con) })
      .finally(() => setLoading(false))
  }, [id])

  const reversarEgreso = async () => {
    setReversando(true)
    try {
      await ingresosAPI.reversarEgreso(id)
      toast.success('Egreso reversado. El ingreso volvió a estado activo.')
      router.push(`/historia-clinica/ingresos/${id}`)
    } catch (e) {
      toast.error(mensajeError(e))
    } finally {
      setReversando(false); setConfirmarReversar(false)
    }
  }

  if (loading) return <div style={{ fontFamily: 'sans-serif', padding: 40 }}>Cargando…</div>
  if (!ingreso) return <div style={{ fontFamily: 'sans-serif', padding: 40, color: 'red' }}>Ingreso no encontrado</div>

  const e   = ingreso.egreso_info ?? {}
  const pac = ingreso.paciente_info ?? {}
  const ahora = new Date().toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #e2e8f0; }

        /* ─── Página media carta (140 × 216 mm) ─── */
        @page {
          size: 140mm 216mm;
          margin: 7mm 9mm;
        }

        @media print {
          html, body { background: white !important; }
          .no-print { display: none !important; }
          .card {
            width: 122mm !important;      /* 140 - 2×9 = 122 */
            max-width: 122mm !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          .card * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }

        @media screen {
          .card {
            max-width: 530px;
            margin: 20px auto 40px;
            border-radius: 4px;
            box-shadow: 0 2px 18px rgba(0,0,0,.14);
          }
        }

        /* ─── Card ─── */
        .card {
          background: white;
          padding: 14px 16px 12px;
          font-family: 'Times New Roman', Times, serif;
          font-size: 7.2pt;
          color: #111;
          line-height: 1.35;
        }

        /* ─── Toolbar ─── */
        .toolbar {
          background: #1e293b; color: white;
          padding: 8px 16px; display: flex; align-items: center; gap: 10px;
          font-family: sans-serif; font-size: 12px;
        }
        .toolbar span { flex: 1; font-weight: 500; }
        .toolbar .btn-print {
          background: #2563eb; color: white; border: none;
          border-radius: 5px; padding: 5px 16px; cursor: pointer; font-size: 12px; font-weight: 500;
        }
        .toolbar .btn-print:hover { background: #1d4ed8; }
        .toolbar .btn-rev {
          background: #dc2626; color: white; border: none;
          border-radius: 5px; padding: 5px 14px; cursor: pointer; font-size: 12px; font-weight: 500;
        }
        .toolbar .btn-rev:hover { background: #b91c1c; }
        .toolbar .btn-rev:disabled { opacity: .6; cursor: default; }
        .toolbar a { color: #94a3b8; text-decoration: none; font-size: 11px; }

        /* ─── Header ─── */
        .dh { display: flex; justify-content: space-between; align-items: flex-start;
              border-bottom: 1.5px solid #111; padding-bottom: 6px; margin-bottom: 8px; }
        .dh-left { display: flex; align-items: center; gap: 7px; flex: 1; min-width: 0; }
        .logo { width: 38px; height: 38px; flex-shrink: 0; border: 1px solid #ccc;
                overflow: hidden; display: flex; align-items: center; justify-content: center; }
        .logo img { width: 100%; height: 100%; object-fit: contain; }
        .logo-ph { font-size: 5.5pt; color: #aaa; text-align: center; line-height: 1.2; }
        .ips-n { font-size: 8.5pt; font-weight: bold; line-height: 1.2; }
        .ips-m { font-size: 5.8pt; color: #555; margin-top: 1px; }
        .dh-right { text-align: right; flex-shrink: 0; padding-left: 6px; }
        .badge { font-size: 8pt; font-weight: bold; text-transform: uppercase; letter-spacing: .4px; display: block; }
        .num   { font-size: 7pt; font-weight: bold; display: block; }
        .exp   { font-size: 5.8pt; color: #555; }

        /* ─── Secciones ─── */
        .sec { margin-bottom: 7px; }
        .sec-t {
          font-size: 6.3pt; font-weight: bold; text-transform: uppercase; letter-spacing: .3px;
          background: #e5e7eb; padding: 1.5px 6px; margin-bottom: 4px;
          border-left: 2.5px solid #374151;
        }

        /* ─── Grid de celdas ─── */
        .grid { display: grid; grid-template-columns: 1fr 1fr; border: .6px solid #bbb; }
        .cell { padding: 2.5px 6px; border-bottom: .6px solid #bbb; border-right: .6px solid #bbb; }
        .cell:nth-child(even) { border-right: none; }
        .cell.full { grid-column: 1 / -1; border-right: none; }
        .lbl { font-size: 5.5pt; font-weight: bold; color: #666; display: block; margin-bottom: .5px; }
        .val { font-size: 7.5pt; }

        /* ─── Indicaciones ─── */
        .ind {
          border: .6px solid #bbb; padding: 5px 7px;
          font-size: 7.2pt; white-space: pre-wrap; min-height: 38px; line-height: 1.4;
        }

        /* ─── Firmas ─── */
        .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 14px; }
        .firma-box { text-align: center; }
        .firma-line { border-top: .8px solid #333; margin-top: 26px; margin-bottom: 3px; }
        .firma-n { font-size: 6.8pt; font-weight: bold; }
        .firma-c { font-size: 5.8pt; color: #666; }

        /* ─── Pie ─── */
        .footer { margin-top: 10px; border-top: .6px solid #ccc; padding-top: 4px;
                  font-size: 5.2pt; color: #888; text-align: center; line-height: 1.5; }

        /* ─── Modal confirmación reversar ─── */
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45);
                   display: flex; align-items: center; justify-content: center; z-index: 100; }
        .modal { background: white; border-radius: 14px; padding: 24px 28px; max-width: 360px;
                 width: 100%; box-shadow: 0 8px 32px rgba(0,0,0,.2); font-family: sans-serif; }
        .modal h3 { font-size: 15px; font-weight: 700; color: #111; margin-bottom: 8px; }
        .modal p  { font-size: 13px; color: #555; margin-bottom: 20px; line-height: 1.5; }
        .modal-btns { display: flex; gap: 10px; }
        .modal-btns .b-red {
          flex: 1; background: #dc2626; color: white; border: none;
          border-radius: 8px; padding: 9px 0; font-size: 13px; font-weight: 600; cursor: pointer;
        }
        .modal-btns .b-red:hover { background: #b91c1c; }
        .modal-btns .b-red:disabled { opacity: .6; cursor: default; }
        .modal-btns .b-sec {
          flex: 1; background: white; color: #444; border: 1px solid #d1d5db;
          border-radius: 8px; padding: 9px 0; font-size: 13px; font-weight: 500; cursor: pointer;
        }
        .modal-btns .b-sec:hover { background: #f8fafc; }
      `}</style>

      {/* ─── Toolbar (no imprime) ─── */}
      <div className="toolbar no-print">
        <span>Orden de Egreso — {ingreso.paciente_nombre} · Ingreso #{ingreso.numero_ingreso}</span>
        <button className="btn-print" onClick={() => window.print()}>Imprimir / PDF</button>
        {ingreso.egreso_info && (
          <button className="btn-rev" disabled={reversando} onClick={() => setConfirmarReversar(true)}>
            {reversando ? 'Reversando…' : '↩ Reversar egreso'}
          </button>
        )}
        <a href={`/historia-clinica/ingresos/${id}`}>← Volver</a>
      </div>

      {/* ─── Modal confirmar reversar ─── */}
      {confirmarReversar && (
        <div className="overlay no-print">
          <div className="modal">
            <h3>¿Reversar este egreso?</h3>
            <p>
              Se eliminarán los datos de egreso de <strong>{ingreso.paciente_nombre}</strong> y el ingreso #{ingreso.numero_ingreso} volverá a estado <strong>Activo</strong>.<br /><br />
              Úsalo solo si el egreso fue un error o si el paciente reingresa de inmediato.
            </p>
            <div className="modal-btns">
              <button className="b-red" disabled={reversando} onClick={reversarEgreso}>
                {reversando ? 'Reversando…' : 'Sí, reversar'}
              </button>
              <button className="b-sec" onClick={() => setConfirmarReversar(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Documento imprimible ─── */}
      <div className="card">

        {/* Encabezado */}
        <div className="dh">
          <div className="dh-left">
            <div className="logo">
              {consultorio?.logo_url
                ? <img src={consultorio.logo_url} alt="Logo" />
                : <span className="logo-ph">LOGO<br />IPS</span>}
            </div>
            <div>
              <div className="ips-n">{consultorio?.nombre || 'Institución Prestadora de Salud'}</div>
              <div className="ips-m">
                {consultorio?.nit && `NIT: ${consultorio.nit}`}
                {consultorio?.codigo_prestador && ` · Cód: ${consultorio.codigo_prestador}`}
                {(consultorio?.nit || consultorio?.codigo_prestador) && <br />}
                {consultorio?.direccion}
                {consultorio?.telefono && ` · Tel: ${consultorio.telefono}`}
              </div>
            </div>
          </div>
          <div className="dh-right">
            <span className="badge">Orden de Egreso</span>
            <span className="num">Ingreso N.° {ingreso.numero_ingreso}</span>
            <span className="exp">Expedido: {ahora}</span>
          </div>
        </div>

        {/* Paciente */}
        <div className="sec">
          <div className="sec-t">Datos del Paciente</div>
          <div className="grid">
            <div className="cell">
              <span className="lbl">Nombre completo</span>
              <span className="val">{ingreso.paciente_nombre}</span>
            </div>
            <div className="cell">
              <span className="lbl">Documento</span>
              <span className="val">{pac.tipo_identificacion} {pac.numero_identificacion || '—'}</span>
            </div>
            <div className="cell">
              <span className="lbl">Fecha de nacimiento</span>
              <span className="val">{fmtFecha(pac.fecha_nacimiento)}</span>
            </div>
            <div className="cell">
              <span className="lbl">Sexo</span>
              <span className="val">{pac.sexo === 'M' ? 'Masculino' : pac.sexo === 'F' ? 'Femenino' : '—'}</span>
            </div>
            <div className="cell">
              <span className="lbl">EPS / Aseguradora</span>
              <span className="val">{pac.aseguradora_nombre || 'Particular'}</span>
            </div>
            <div className="cell">
              <span className="lbl">Régimen</span>
              <span className="val">{REGIMEN[pac.regimen] || pac.regimen || '—'}</span>
            </div>
            {pac.telefono && <div className="cell"><span className="lbl">Teléfono</span><span className="val">{pac.telefono}</span></div>}
            {pac.direccion && <div className="cell"><span className="lbl">Dirección</span><span className="val">{pac.direccion}</span></div>}
          </div>
        </div>

        {/* Episodio */}
        <div className="sec">
          <div className="sec-t">Episodio de Atención</div>
          <div className="grid">
            <div className="cell">
              <span className="lbl">Tipo ingreso</span>
              <span className="val">{ingreso.tipo_atencion || '—'}</span>
            </div>
            <div className="cell">
              <span className="lbl">Médico tratante</span>
              <span className="val">{ingreso.medico_nombre || '—'}</span>
            </div>
            <div className="cell">
              <span className="lbl">Fecha de ingreso</span>
              <span className="val">{fmtFechaHora(ingreso.fecha_ingreso)}</span>
            </div>
            <div className="cell">
              <span className="lbl">Fecha de egreso</span>
              <span className="val">{fmtFechaHora(e.fecha_egreso)}</span>
            </div>
            {ingreso.motivo_ingreso && (
              <div className="cell full">
                <span className="lbl">Motivo de ingreso</span>
                <span className="val">{ingreso.motivo_ingreso}</span>
              </div>
            )}
          </div>
        </div>

        {/* Diagnóstico */}
        <div className="sec">
          <div className="sec-t">Diagnóstico de Egreso</div>
          <div className="grid">
            <div className="cell">
              <span className="lbl">Tipo de egreso</span>
              <span className="val">{TIPO_EGRESO[e.tipo_egreso] || e.tipo_egreso || '—'}</span>
            </div>
            <div className="cell">
              <span className="lbl">Código CIE-10</span>
              <span className="val" style={{ fontWeight: 'bold' }}>{e.diagnostico_egreso || '—'}</span>
            </div>
            {e.descripcion_diagnostico && (
              <div className="cell full">
                <span className="lbl">Diagnóstico</span>
                <span className="val">{e.descripcion_diagnostico}</span>
              </div>
            )}
            {e.condicion_al_egreso && (
              <div className="cell full">
                <span className="lbl">Condición al egreso</span>
                <span className="val">{e.condicion_al_egreso}</span>
              </div>
            )}
          </div>
        </div>

        {/* Indicaciones */}
        <div className="sec">
          <div className="sec-t">Indicaciones de Alta</div>
          <div className="ind">
            {e.indicaciones_alta || <span style={{ color: '#bbb', fontStyle: 'italic' }}>Sin indicaciones registradas.</span>}
          </div>
        </div>

        {/* Firmas */}
        <div className="firmas">
          <div className="firma-box">
            <div className="firma-line" />
            <div className="firma-n">{ingreso.medico_nombre || 'Médico tratante'}</div>
            <div className="firma-c">Médico tratante</div>
          </div>
          <div className="firma-box">
            <div className="firma-line" />
            <div className="firma-n">{ingreso.paciente_nombre}</div>
            <div className="firma-c">Paciente / Responsable</div>
          </div>
        </div>

        {/* Pie */}
        <div className="footer">
          {consultorio?.nombre && `${consultorio.nombre} · `}
          {consultorio?.direccion && `${consultorio.direccion} · `}
          {consultorio?.telefono && `Tel: ${consultorio.telefono} · `}
          Expedido el {ahora} · Documento médico-legal
        </div>

      </div>
    </>
  )
}
