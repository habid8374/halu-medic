'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ingresosAPI, consultorioAPI } from '@/lib/api'

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

const REGIMEN_LABEL: Record<string, string> = {
  C: 'Contributivo',
  S: 'Subsidiado',
  V: 'Vinculado',
  P: 'Particular',
  A: 'ARP / ARL',
  T: 'SOAT',
  O: 'Otro',
}

const TIPO_EGRESO_LABEL: Record<string, string> = {
  alta_medica:  'Alta médica',
  traslado:     'Traslado',
  voluntario:   'Retiro voluntario',
  fallecimiento:'Fallecimiento',
  fuga:         'Fuga',
}

export default function OrdenEgresoPage() {
  const { id } = useParams<{ id: string }>()
  const [ingreso, setIngreso]     = useState<any>(null)
  const [consultorio, setConsultorio] = useState<any>(null)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    Promise.all([
      ingresosAPI.get(id),
      consultorioAPI.get(),
    ]).then(([{ data: ing }, { data: con }]) => {
      setIngreso(ing)
      setConsultorio(con)
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div style={{ fontFamily: 'sans-serif', padding: 40 }}>Cargando…</div>
  if (!ingreso) return <div style={{ fontFamily: 'sans-serif', padding: 40, color: 'red' }}>Ingreso no encontrado</div>

  const egreso   = ingreso.egreso_info ?? {}
  const paciente = ingreso.paciente_info ?? null
  const ahora  = new Date().toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f1f5f9; }

        /* Media carta: 140mm × 216mm (half letter) */
        @page { size: 140mm 216mm; margin: 0; }

        @media print {
          .no-print { display: none !important; }
          body { background: white; font-size: 8pt; color: #000; }
          .container { width: 140mm !important; max-width: 140mm !important; margin: 0 !important; padding: 8mm 10mm !important; box-shadow: none !important; border-radius: 0 !important; }
          .page-break { page-break-before: always; }
        }

        @media screen {
          .container { max-width: 530px; margin: 24px auto; box-shadow: 0 2px 16px rgba(0,0,0,0.12); }
        }

        .container {
          background: white;
          padding: 20px 24px;
          font-family: 'Times New Roman', Times, serif;
          font-size: 8.5pt;
          color: #111;
          border-radius: 4px;
        }

        /* ── Barra de herramientas ── */
        .toolbar {
          background: #1e293b;
          color: white;
          padding: 10px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-family: sans-serif;
          font-size: 13px;
        }
        .toolbar button {
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 7px 20px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
        }
        .toolbar button:hover { background: #1d4ed8; }
        .toolbar a { color: #94a3b8; text-decoration: none; font-size: 12px; margin-left: auto; }

        /* ── Encabezado del documento ── */
        .doc-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #111;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .logo-wrap {
          width: 48px;
          height: 48px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #ccc;
          overflow: hidden;
        }
        .logo-wrap img { width: 100%; height: 100%; object-fit: contain; }
        .logo-placeholder {
          font-size: 6.5pt;
          color: #999;
          text-align: center;
          line-height: 1.2;
        }
        .ips-name { font-size: 11pt; font-weight: bold; letter-spacing: 0.5px; }
        .ips-meta { font-size: 6.8pt; color: #444; margin-top: 2px; line-height: 1.4; }

        .header-right { text-align: right; font-size: 7pt; color: #444; line-height: 1.5; }
        .header-right .doc-title-badge {
          font-size: 9.5pt;
          font-weight: bold;
          color: #111;
          display: block;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .header-right .doc-num {
          font-size: 8pt;
          font-weight: bold;
          color: #111;
          display: block;
        }

        /* ── Secciones ── */
        .section { margin-bottom: 9pt; }
        .section-title {
          font-size: 7.5pt;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          background: #e5e7eb;
          padding: 2px 8px;
          margin-bottom: 5pt;
          border-left: 3px solid #374151;
        }

        /* ── Grilla de datos ── */
        .data-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid #ccc; }
        .data-grid.one-col { grid-template-columns: 1fr; }
        .data-cell { padding: 3px 7px; border-bottom: 1px solid #ccc; border-right: 1px solid #ccc; font-size: 7.5pt; }
        .data-cell:nth-child(even) { border-right: none; }
        .data-cell.full { grid-column: 1 / -1; border-right: none; }
        .data-cell .lbl { font-weight: bold; font-size: 6.3pt; color: #555; display: block; margin-bottom: 1px; }
        .data-cell .val { font-size: 8pt; }

        /* ── Indicaciones ── */
        .indicaciones-box {
          border: 1px solid #ccc;
          padding: 6px 9px;
          font-size: 7.8pt;
          white-space: pre-wrap;
          min-height: 45px;
          line-height: 1.45;
        }

        /* ── Firma ── */
        .firma-section {
          margin-top: 20pt;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        .firma-box { text-align: center; }
        .firma-line {
          border-top: 1px solid #333;
          margin-bottom: 3px;
          margin-top: 32px;
        }
        .firma-nombre { font-size: 7.8pt; font-weight: bold; }
        .firma-cargo { font-size: 6.8pt; color: #555; }

        /* ── Pie ── */
        .doc-footer {
          margin-top: 14pt;
          border-top: 1px solid #ccc;
          padding-top: 5px;
          font-size: 6pt;
          color: #777;
          text-align: center;
          line-height: 1.5;
        }
      `}</style>

      {/* ── Barra de herramientas (no imprime) ── */}
      <div className="toolbar no-print">
        <span style={{ flex: 1, fontWeight: 500 }}>
          Orden de Egreso — {ingreso.paciente_nombre} · Ingreso #{ingreso.numero_ingreso}
        </span>
        <button onClick={() => window.print()}>Imprimir / Guardar PDF</button>
        <a href={`/historia-clinica/ingresos/${id}`}>← Volver al ingreso</a>
      </div>

      <div className="container">

        {/* ── Encabezado ── */}
        <div className="doc-header">
          <div className="header-left">
            <div className="logo-wrap">
              {consultorio?.logo_url
                ? <img src={consultorio.logo_url} alt="Logo" />
                : <span className="logo-placeholder">LOGO<br />IPS</span>
              }
            </div>
            <div>
              <div className="ips-name">{consultorio?.nombre || 'Institución Prestadora de Salud'}</div>
              <div className="ips-meta">
                {consultorio?.razon_social && <span>{consultorio.razon_social}<br /></span>}
                {consultorio?.nit && <span>NIT: {consultorio.nit} · </span>}
                {consultorio?.codigo_prestador && <span>Cód. Prestador: {consultorio.codigo_prestador}<br /></span>}
                {consultorio?.direccion && <span>{consultorio.direccion}</span>}
                {consultorio?.telefono && <span> · Tel: {consultorio.telefono}</span>}
              </div>
            </div>
          </div>
          <div className="header-right">
            <span className="doc-title-badge">Orden de Egreso</span>
            <span className="doc-num">Ingreso N.° {ingreso.numero_ingreso}</span>
            <span>Expedido: {ahora}</span>
          </div>
        </div>

        {/* ── Datos del paciente ── */}
        <div className="section">
          <div className="section-title">Datos del Paciente</div>
          <div className="data-grid">
            <div className="data-cell">
              <span className="lbl">Nombre completo</span>
              <span className="val">{ingreso.paciente_nombre}</span>
            </div>
            <div className="data-cell">
              <span className="lbl">Documento de identidad</span>
              <span className="val">
                {paciente?.tipo_identificacion && `${paciente.tipo_identificacion} `}{paciente?.numero_identificacion || '—'}
              </span>
            </div>
            <div className="data-cell">
              <span className="lbl">Fecha de nacimiento</span>
              <span className="val">{fmtFecha(paciente?.fecha_nacimiento)}</span>
            </div>
            <div className="data-cell">
              <span className="lbl">Sexo</span>
              <span className="val">{paciente?.sexo === 'M' ? 'Masculino' : paciente?.sexo === 'F' ? 'Femenino' : '—'}</span>
            </div>
            <div className="data-cell">
              <span className="lbl">EPS / Aseguradora</span>
              <span className="val">{paciente?.aseguradora_nombre || 'Particular'}</span>
            </div>
            <div className="data-cell">
              <span className="lbl">Régimen</span>
              <span className="val">{REGIMEN_LABEL[paciente?.regimen ?? ''] || paciente?.regimen || '—'}</span>
            </div>
            {paciente?.telefono && (
              <div className="data-cell">
                <span className="lbl">Teléfono</span>
                <span className="val">{paciente.telefono}</span>
              </div>
            )}
            {paciente?.direccion && (
              <div className="data-cell">
                <span className="lbl">Dirección</span>
                <span className="val">{paciente.direccion}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Datos del episodio ── */}
        <div className="section">
          <div className="section-title">Episodio de Atención</div>
          <div className="data-grid">
            <div className="data-cell">
              <span className="lbl">Tipo de ingreso</span>
              <span className="val">{ingreso.tipo_ingreso_display || ingreso.tipo_ingreso || '—'}</span>
            </div>
            <div className="data-cell">
              <span className="lbl">Médico tratante</span>
              <span className="val">{ingreso.medico_nombre || '—'}</span>
            </div>
            <div className="data-cell">
              <span className="lbl">Fecha y hora de ingreso</span>
              <span className="val">{fmtFechaHora(ingreso.fecha_ingreso)}</span>
            </div>
            <div className="data-cell">
              <span className="lbl">Fecha y hora de egreso</span>
              <span className="val">{fmtFechaHora(egreso.fecha_egreso)}</span>
            </div>
            {ingreso.motivo_ingreso && (
              <div className="data-cell full">
                <span className="lbl">Motivo de ingreso</span>
                <span className="val">{ingreso.motivo_ingreso}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Diagnóstico y condición de egreso ── */}
        <div className="section">
          <div className="section-title">Diagnóstico de Egreso</div>
          <div className="data-grid">
            <div className="data-cell">
              <span className="lbl">Tipo de egreso</span>
              <span className="val">{TIPO_EGRESO_LABEL[egreso.tipo_egreso] || egreso.tipo_egreso || '—'}</span>
            </div>
            <div className="data-cell">
              <span className="lbl">Código CIE-10</span>
              <span className="val" style={{ fontWeight: 'bold' }}>{egreso.diagnostico_egreso || '—'}</span>
            </div>
            {egreso.descripcion_diagnostico && (
              <div className="data-cell full">
                <span className="lbl">Descripción del diagnóstico</span>
                <span className="val">{egreso.descripcion_diagnostico}</span>
              </div>
            )}
            {egreso.condicion_al_egreso && (
              <div className="data-cell full">
                <span className="lbl">Condición al egreso</span>
                <span className="val">{egreso.condicion_al_egreso}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Indicaciones de alta ── */}
        <div className="section">
          <div className="section-title">Indicaciones de Alta</div>
          <div className="indicaciones-box">
            {egreso.indicaciones_alta
              ? egreso.indicaciones_alta
              : <span style={{ color: '#aaa', fontStyle: 'italic' }}>Sin indicaciones registradas.</span>
            }
          </div>
        </div>

        {/* ── Firmas ── */}
        <div className="firma-section">
          <div className="firma-box">
            <div className="firma-line" />
            <div className="firma-nombre">{ingreso.medico_nombre || 'Médico tratante'}</div>
            <div className="firma-cargo">Médico tratante</div>
            {ingreso.medico_reg_medico && (
              <div className="firma-cargo">Reg. médico: {ingreso.medico_reg_medico}</div>
            )}
          </div>
          <div className="firma-box">
            <div className="firma-line" />
            <div className="firma-nombre">{ingreso.paciente_nombre}</div>
            <div className="firma-cargo">Paciente / Responsable</div>
          </div>
        </div>

        {/* ── Pie de página ── */}
        <div className="doc-footer">
          {consultorio?.nombre && <span>{consultorio.nombre} · </span>}
          {consultorio?.direccion && <span>{consultorio.direccion} · </span>}
          {consultorio?.telefono && <span>Tel: {consultorio.telefono} · </span>}
          Documento generado el {ahora} · Este documento tiene validez médico-legal.
        </div>

      </div>
    </>
  )
}
