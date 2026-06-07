'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ingresosAPI, notasMedicasAPI, ayudasDiagnosticasAPI } from '@/lib/api'
import { Ingreso, NotaMedica } from '@/types'

function fmtFecha(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

function fmtFechaHora(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const TIPO_NOTA_LABEL: Record<string, string> = {
  ingreso:        'Nota de Ingreso',
  evolucion:      'Evolución',
  interconsulta:  'Interconsulta',
  valoracion:     'Valoración',
  preoperatoria:  'Nota Preoperatoria',
  postoperatoria: 'Nota Postoperatoria',
  anestesia:      'Nota de Anestesia',
  enfermeria:     'Nota de Enfermería',
  aclaratoria:    'Nota Aclaratoria',
  epicrisis:      'Epicrisis',
}

const TIPO_ATENCION_LABEL: Record<string, string> = {
  urgencias:       'Urgencias',
  hospitalizacion: 'Hospitalización',
  consulta:        'Consulta externa',
  cirugia:         'Cirugía',
}

const TIPO_EGRESO_LABEL: Record<string, string> = {
  alta_medica: 'Alta médica',
  traslado:    'Traslado',
  voluntario:  'Retiro voluntario',
  fallecimiento: 'Fallecimiento',
  fuga:        'Fuga',
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <tr>
      <td className="label-cell">{label}</td>
      <td className="value-cell">{value}</td>
    </tr>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="section">
      <h2 className="section-title">{title}</h2>
      {children}
    </div>
  )
}

export default function ImprimirPage() {
  const params = useParams()
  const id = params.id as string

  const [ingreso, setIngreso] = useState<Ingreso | null>(null)
  const [notas, setNotas] = useState<NotaMedica[]>([])
  const [ayudas, setAyudas] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function cargar() {
      try {
        const [resIngreso, resNotas, resAyudas] = await Promise.all([
          ingresosAPI.get(id),
          notasMedicasAPI.list({ ingreso: id, ordering: 'fecha_hora', page_size: '200' }),
          ayudasDiagnosticasAPI.list({ ingreso: id, page_size: '200' }).catch(() => ({ data: [] })),
        ])
        setIngreso(resIngreso.data)
        const notasData = resNotas.data?.results ?? resNotas.data ?? []
        setNotas(notasData)
        const ayudasData = resAyudas.data?.results ?? resAyudas.data ?? []
        setAyudas(Array.isArray(ayudasData) ? ayudasData : [])
      } catch (e: unknown) {
        setError('No se pudo cargar la historia clínica.')
        console.error(e)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [id])

  useEffect(() => {
    if (!cargando && ingreso) {
      const timer = setTimeout(() => window.print(), 500)
      return () => clearTimeout(timer)
    }
  }, [cargando, ingreso])

  const ahora = new Date().toLocaleString('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const notasOrdinaras = notas.filter(n => n.tipo !== 'epicrisis')
  const epicrisis = notas.find(n => n.tipo === 'epicrisis')

  if (cargando) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        <p>Cargando historia clínica...</p>
      </div>
    )
  }

  if (error || !ingreso) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        <p>{error ?? 'Historia clínica no encontrada.'}</p>
      </div>
    )
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: #000; margin: 0; padding: 0; background: #f5f5f5; }

        @media print {
          .no-print { display: none !important; }
          body { font-size: 11pt; color: #000; background: #fff; }
          .page-break { page-break-before: always; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #999; padding: 4px 8px; }
          .print-container { max-width: none; margin: 0; padding: 15mm 20mm; background: white; box-shadow: none; }
          .section { margin-bottom: 12pt; page-break-inside: avoid; }
        }

        @media screen {
          .print-container { max-width: 800px; margin: 0 auto; padding: 24px; background: white; box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
        }

        .print-container { font-family: 'Times New Roman', Times, serif; }

        /* Header */
        .doc-header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 14pt; display: flex; justify-content: space-between; align-items: flex-start; }
        .doc-header-left { display: flex; align-items: center; gap: 12px; }
        .logo-box { width: 60px; height: 60px; border: 1px solid #ccc; display: flex; align-items: center; justify-content: center; font-size: 8pt; color: #999; text-align: center; flex-shrink: 0; }
        .doc-title { }
        .doc-title h1 { margin: 0; font-size: 16pt; font-weight: bold; letter-spacing: 1px; }
        .doc-title p { margin: 2px 0 0; font-size: 9pt; color: #444; }
        .doc-header-right { text-align: right; font-size: 9pt; color: #444; }
        .doc-header-right strong { font-size: 11pt; color: #000; display: block; }

        /* Sections */
        .section { margin-bottom: 14pt; }
        .section-title { font-size: 11pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; background: #e8e8e8; padding: 3px 8px; margin-bottom: 6pt; border-left: 3px solid #000; }

        /* Data table */
        .data-table { width: 100%; border-collapse: collapse; font-size: 10pt; }
        .label-cell { font-weight: bold; width: 38%; padding: 3px 8px; vertical-align: top; border: 1px solid #ccc; background: #f9f9f9; }
        .value-cell { padding: 3px 8px; vertical-align: top; border: 1px solid #ccc; }

        /* Nota médica card */
        .nota-card { border: 1px solid #ccc; margin-bottom: 8pt; page-break-inside: avoid; }
        .nota-header { background: #e8e8e8; padding: 4px 8px; border-bottom: 1px solid #ccc; display: flex; justify-content: space-between; align-items: center; }
        .nota-tipo { font-weight: bold; font-size: 10pt; }
        .nota-meta { font-size: 8.5pt; color: #555; }
        .nota-body { padding: 6px 8px; font-size: 10pt; }
        .nota-field { margin-bottom: 4pt; }
        .nota-field-label { font-weight: bold; font-size: 9pt; display: inline; }
        .nota-field-value { display: inline; }
        .nota-field-block { margin-bottom: 6pt; }
        .nota-field-block .nota-field-label { display: block; margin-bottom: 2pt; }

        /* Footer */
        .doc-footer { border-top: 1px solid #000; margin-top: 20pt; padding-top: 8px; font-size: 8.5pt; color: #555; display: flex; justify-content: space-between; }

        /* No-print bar */
        .no-print-bar { background: #1e293b; color: white; padding: 12px 24px; display: flex; align-items: center; gap: 12px; font-family: sans-serif; font-size: 13px; }
        .no-print-bar button { background: #3b82f6; color: white; border: none; border-radius: 6px; padding: 7px 18px; font-size: 13px; cursor: pointer; font-weight: 500; }
        .no-print-bar button:hover { background: #2563eb; }
        .no-print-bar a { color: #94a3b8; text-decoration: none; font-size: 12px; }
        .no-print-bar a:hover { color: #cbd5e1; }
      `}</style>

      {/* Action bar — hidden when printing */}
      <div className="no-print-bar no-print">
        <span style={{ flex: 1 }}>Vista de impresión — Historia Clínica #{ingreso.numero_ingreso}</span>
        <button onClick={() => window.print()}>Imprimir / Guardar PDF</button>
        <Link href={`/historia-clinica/ingresos/${id}`}>Volver</Link>
      </div>

      <div className="print-container">

        {/* ── Encabezado ── */}
        <div className="doc-header">
          <div className="doc-header-left">
            <div className="logo-box">LOGO<br/>IPS</div>
            <div className="doc-title">
              <h1>HISTORIA CLÍNICA</h1>
              <p>Documento médico-legal — uso exclusivo profesional</p>
            </div>
          </div>
          <div className="doc-header-right">
            <strong>Ingreso N.° {ingreso.numero_ingreso}</strong>
            <span>Impreso: {ahora}</span>
          </div>
        </div>

        {/* ── Datos del paciente ── */}
        <Section title="Datos del Paciente">
          <table className="data-table">
            <tbody>
              <Row label="Nombre completo" value={ingreso.paciente_nombre} />
              <Row label="Tipo de atención" value={TIPO_ATENCION_LABEL[ingreso.tipo_atencion] ?? ingreso.tipo_atencion} />
              <Row label="Médico tratante" value={ingreso.medico_nombre ?? undefined} />
              <Row label="Fecha de ingreso" value={fmtFechaHora(ingreso.fecha_ingreso)} />
              <Row label="Motivo de ingreso" value={ingreso.motivo_ingreso} />
              {ingreso.observaciones && <Row label="Observaciones" value={ingreso.observaciones} />}
            </tbody>
          </table>
        </Section>

        {/* ── Notas médicas ── */}
        {notasOrdinaras.length > 0 && (
          <Section title={`Notas Médicas (${notasOrdinaras.length})`}>
            {notasOrdinaras.map((nota) => (
              <div key={nota.id} className="nota-card">
                <div className="nota-header">
                  <span className="nota-tipo">{TIPO_NOTA_LABEL[nota.tipo] ?? nota.tipo}</span>
                  <span className="nota-meta">
                    {fmtFechaHora(nota.fecha_hora)}
                    {nota.medico_info && ` — ${nota.medico_info.nombre_completo}`}
                    {nota.especialidad_nota && ` · ${nota.especialidad_nota}`}
                    {nota.servicio && ` · Servicio: ${nota.servicio}`}
                    {nota.firmada && ' · ✓ Firmada'}
                  </span>
                </div>
                <div className="nota-body">
                  {nota.subjetivo && (
                    <div className="nota-field-block">
                      <span className="nota-field-label">Subjetivo (S): </span>
                      <span className="nota-field-value">{nota.subjetivo}</span>
                    </div>
                  )}
                  {nota.objetivo && (
                    <div className="nota-field-block">
                      <span className="nota-field-label">Objetivo (O): </span>
                      <span className="nota-field-value">{nota.objetivo}</span>
                    </div>
                  )}
                  {nota.analisis && (
                    <div className="nota-field-block">
                      <span className="nota-field-label">Análisis (A): </span>
                      <span className="nota-field-value">{nota.analisis}</span>
                    </div>
                  )}
                  {nota.plan && (
                    <div className="nota-field-block">
                      <span className="nota-field-label">Plan (P): </span>
                      <span className="nota-field-value">{nota.plan}</span>
                    </div>
                  )}
                  {nota.medico_info?.tarjeta_profesional && (
                    <div style={{ marginTop: '6pt', paddingTop: '4pt', borderTop: '1px solid #e5e5e5', fontSize: '8.5pt', color: '#666' }}>
                      T.P.: {nota.medico_info.tarjeta_profesional}
                      {nota.medico_info.numero_rethus && ` — RETHUS: ${nota.medico_info.numero_rethus}`}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* ── Ayudas diagnósticas ── */}
        {ayudas.length > 0 && (
          <Section title={`Ayudas Diagnósticas (${ayudas.length})`}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Tipo</th>
                  <th style={{ textAlign: 'left' }}>Descripción</th>
                  <th style={{ textAlign: 'left' }}>Fecha</th>
                  <th style={{ textAlign: 'left' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {ayudas.map((a: any) => (
                  <tr key={a.id}>
                    <td>{a.tipo_label ?? a.tipo ?? '—'}</td>
                    <td>{a.descripcion ?? a.nombre ?? '—'}</td>
                    <td>{fmtFecha(a.fecha ?? a.creado_en)}</td>
                    <td>{a.estado_label ?? a.estado ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* ── Epicrisis ── */}
        {epicrisis && (
          <div className="page-break">
            <Section title="Epicrisis">
              <div className="nota-card">
                <div className="nota-header">
                  <span className="nota-tipo">Epicrisis</span>
                  <span className="nota-meta">
                    {fmtFechaHora(epicrisis.fecha_hora)}
                    {epicrisis.medico_info && ` — ${epicrisis.medico_info.nombre_completo}`}
                    {epicrisis.firmada && ' · ✓ Firmada'}
                  </span>
                </div>
                <div className="nota-body">
                  {epicrisis.resumen_hospitalizacion && (
                    <div className="nota-field-block">
                      <span className="nota-field-label">Resumen de hospitalización: </span>
                      <span className="nota-field-value">{epicrisis.resumen_hospitalizacion}</span>
                    </div>
                  )}
                  {epicrisis.diagnostico_egreso && (
                    <div className="nota-field-block">
                      <span className="nota-field-label">Diagnóstico de egreso: </span>
                      <span className="nota-field-value">
                        {epicrisis.diagnostico_egreso}
                        {epicrisis.desc_diagnostico_egreso && ` — ${epicrisis.desc_diagnostico_egreso}`}
                      </span>
                    </div>
                  )}
                  {epicrisis.condicion_al_egreso && (
                    <div className="nota-field-block">
                      <span className="nota-field-label">Condición al egreso: </span>
                      <span className="nota-field-value">{epicrisis.condicion_al_egreso}</span>
                    </div>
                  )}
                  {epicrisis.recomendaciones_egreso && (
                    <div className="nota-field-block">
                      <span className="nota-field-label">Recomendaciones: </span>
                      <span className="nota-field-value">{epicrisis.recomendaciones_egreso}</span>
                    </div>
                  )}
                  {epicrisis.analisis && (
                    <div className="nota-field-block">
                      <span className="nota-field-label">Análisis clínico: </span>
                      <span className="nota-field-value">{epicrisis.analisis}</span>
                    </div>
                  )}
                  {epicrisis.plan && (
                    <div className="nota-field-block">
                      <span className="nota-field-label">Plan al egreso: </span>
                      <span className="nota-field-value">{epicrisis.plan}</span>
                    </div>
                  )}
                  {epicrisis.medico_info?.tarjeta_profesional && (
                    <div style={{ marginTop: '6pt', paddingTop: '4pt', borderTop: '1px solid #e5e5e5', fontSize: '8.5pt', color: '#666' }}>
                      T.P.: {epicrisis.medico_info.tarjeta_profesional}
                      {epicrisis.medico_info.numero_rethus && ` — RETHUS: ${epicrisis.medico_info.numero_rethus}`}
                    </div>
                  )}
                </div>
              </div>
            </Section>
          </div>
        )}

        {/* ── Egreso ── */}
        {ingreso.egreso_info && (
          <Section title="Datos de Egreso">
            <table className="data-table">
              <tbody>
                <Row label="Fecha de egreso" value={fmtFechaHora(ingreso.egreso_info.fecha_egreso)} />
                <Row label="Tipo de egreso" value={TIPO_EGRESO_LABEL[ingreso.egreso_info.tipo_egreso] ?? ingreso.egreso_info.tipo_egreso} />
                <Row label="Diagnóstico de egreso" value={ingreso.egreso_info.diagnostico_egreso} />
              </tbody>
            </table>
          </Section>
        )}

        {/* ── Pie de página ── */}
        <div className="doc-footer">
          <span>Documento generado por <strong>HaluMedic</strong></span>
          <span>Impreso el {ahora}</span>
        </div>

      </div>
    </>
  )
}
