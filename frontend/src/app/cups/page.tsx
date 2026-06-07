'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { cupsAPI, cupsRipsAPI, mensajeError } from '@/lib/api'
import { PageHeader, Badge, EmptyState, Button, Card } from '@/components/ui'
import toast from 'react-hot-toast'
import { Search, Stethoscope, Copy, CheckCircle, ListTree, Upload, Download, FileSpreadsheet, Info, CheckCircle2, AlertCircle } from 'lucide-react'

interface CodigoCUPS {
  codigo: string
  descripcion: string
  nombre_servicio: string
  grupo_servicio: string
  cobertura: string
  codigo_reps: string
  grupo_rips: string
  modalidad_rips: string
  grupo_servicios_rips: string
  finalidad_rips: string
  via_ingreso_rips: string
  cod_servicio_rips: string
}

type Tab = 'buscador' | 'rips'

export default function CupsPage() {
  const [tab, setTab] = useState<Tab>('buscador')
  // buscador state
  const [items, setItems] = useState<CodigoCUPS[]>([])
  const [count, setCount] = useState(0)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [copiado, setCopiado] = useState<string | null>(null)
  // rips upload state
  const [uploading, setUploading] = useState(false)
  const [resultado, setResultado] = useState<{ actualizados: number; errores: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const cargar = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const { data } = q.trim()
        ? await cupsAPI.buscar(q.trim())
        : await cupsAPI.list({ page_size: 50 })
      const results = data.results ?? data
      setItems(results)
      setCount(data.count ?? results.length)
    } catch (err) { toast.error(mensajeError(err)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { cargar('') }, [cargar])
  useEffect(() => {
    const t = setTimeout(() => cargar(query), 350)
    return () => clearTimeout(t)
  }, [query, cargar])

  const copiar = (codigo: string) => {
    navigator.clipboard.writeText(codigo)
    setCopiado(codigo)
    toast.success(`CUPS ${codigo} copiado`)
    setTimeout(() => setCopiado(null), 1500)
  }

  const descargarPlantilla = async () => {
    try {
      const { data } = await cupsRipsAPI.descargarPlantilla()
      const blob = data instanceof Blob ? data : new Blob([data], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'plantilla_cups_rips.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Plantilla descargada')
    } catch (e) { toast.error(mensajeError(e)) }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setResultado(null)
    try {
      const { data } = await cupsRipsAPI.importar(file)
      setResultado(data)
      if (data.errores?.length === 0) toast.success(`${data.actualizados} CUPS actualizados correctamente`)
      else toast.success(`${data.actualizados} actualizados — ${data.errores.length} con error`)
    } catch (err) { toast.error(mensajeError(err)) }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="Homologador CUPS"
        description="Catálogo CUPS con homologación REPS y campos RIPS (Res. 948/2026)"
      />

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-6">
        {([['buscador', 'Buscador CUPS'], ['rips', 'Configuración RIPS']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id ? 'bg-white shadow text-halu-700' : 'text-slate-500 hover:text-slate-700'
            }`}>{label}</button>
        ))}
      </div>

      {tab === 'buscador' && (
        <>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Buscar por código o descripción (ej: 890201, consulta, ecografía)…"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/30 focus:border-halu-400 bg-slate-50 placeholder:text-slate-400 transition-all"
              />
            </div>
            {!query && (
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                <ListTree className="w-3.5 h-3.5" />
                {count.toLocaleString('es-CO')} códigos CUPS · escribe para buscar
              </p>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-slate-100 animate-pulse rounded-xl" />)}</div>
            ) : items.length === 0 ? (
              <EmptyState title="Sin resultados" description="No se encontraron códigos CUPS para esa búsqueda." />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                    <th className="px-5 py-3 font-medium">CUPS</th>
                    <th className="px-5 py-3 font-medium">Descripción</th>
                    <th className="px-5 py-3 font-medium">Grupo</th>
                    <th className="px-5 py-3 font-medium">Cobertura</th>
                    <th className="px-5 py-3 font-medium">Modalidad RIPS</th>
                    <th className="px-5 py-3 font-medium">Grupo RIPS</th>
                    <th className="px-5 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(c => (
                    <tr key={c.codigo} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="px-5 py-3"><span className="font-mono font-semibold text-halu-700">{c.codigo}</span></td>
                      <td className="px-5 py-3 text-slate-700 max-w-xs">
                        <p>{c.descripcion}</p>
                        {c.nombre_servicio && <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><Stethoscope className="w-3 h-3" />{c.nombre_servicio}</p>}
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-xs">{c.grupo_servicio || '—'}</td>
                      <td className="px-5 py-3">
                        {c.cobertura ? <Badge variant={c.cobertura.toUpperCase().includes('NO') ? 'warning' : 'success'}>{c.cobertura}</Badge> : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3 text-xs font-mono text-slate-500">{c.modalidad_rips || <span className="text-red-400">⚠ sin config</span>}</td>
                      <td className="px-5 py-3 text-xs font-mono text-slate-500">{c.grupo_servicios_rips || '—'}</td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => copiar(c.codigo)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-halu-600 hover:bg-halu-50 transition-all">
                          {copiado === c.codigo ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          Copiar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'rips' && (
        <div className="max-w-2xl space-y-6">
          {/* Instrucciones */}
          <Card>
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Info className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 text-sm mb-1">Cómo configurar CUPS para RIPS limpio</h3>
                <ol className="text-sm text-slate-600 space-y-1 list-decimal list-inside">
                  <li>Descarga la plantilla CSV con los campos requeridos</li>
                  <li>Completa los valores RIPS para cada CUPS que uses en tu consultorio</li>
                  <li>Sube el archivo — el sistema actualiza los códigos automáticamente</li>
                  <li>Al generar RIPS, se usan los valores configurados aquí (no defaults)</li>
                </ol>
              </div>
            </div>
          </Card>

          {/* Campos referencia */}
          <Card>
            <h3 className="font-semibold text-slate-800 text-sm mb-3">Referencia de campos (Res. 948/2026)</h3>
            <div className="space-y-2 text-xs">
              {[
                ['modalidad_rips', 'Modalidad', '01=Intramural · 02=Extramural · 05=Telemedicina interactiva · 06=No interactiva'],
                ['grupo_servicios_rips', 'Grupo servicios', '01=Consulta externa · 02=Urgencias · 03=Hospitalización · 04=Cirugía · 05=Procedimientos'],
                ['finalidad_rips', 'Finalidad tecnología', '10=Dx · 11=Tto · 12=Rehab · 13=Dx+Tto · 14=Detección · 15=Protección específica'],
                ['via_ingreso_rips', 'Vía ingreso', '1=Urgencias · 2=Consulta externa · 3=Remitido · 4=Nacimiento · 5=Electiva'],
                ['cod_servicio_rips', 'Cod. servicio REPS', 'Código del servicio habilitado en tu REPS (ej: 1 para consulta externa)'],
                ['personal_atiende', 'Personal que atiende', '01=Médico especialista · 02=Médico general · 03=Enfermería · 04=Otro'],
                ['ambito_rips', 'Ámbito', '1=Ambulatorio · 2=Hospitalario · 3=Urgencias'],
              ].map(([campo, label, desc]) => (
                <div key={campo} className="flex gap-3 p-2 bg-slate-50 rounded-lg">
                  <span className="font-mono text-halu-700 w-36 flex-shrink-0">{campo}</span>
                  <div>
                    <span className="font-medium text-slate-700">{label}: </span>
                    <span className="text-slate-500">{desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Descargar plantilla */}
          <Card>
            <h3 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2">
              <Download className="w-4 h-4 text-halu-600" /> Paso 1 — Descargar plantilla
            </h3>
            <p className="text-sm text-slate-600 mb-4">La plantilla incluye los encabezados correctos y 4 filas de ejemplo con valores reales para consultas de medicina general y especializada.</p>
            <Button variant="secondary" onClick={descargarPlantilla}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Descargar plantilla_cups_rips.csv
            </Button>
          </Card>

          {/* Subir CSV */}
          <Card>
            <h3 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2">
              <Upload className="w-4 h-4 text-halu-600" /> Paso 2 — Subir archivo completado
            </h3>
            <p className="text-sm text-slate-600 mb-4">El sistema actualiza los campos RIPS de los CUPS existentes. Los códigos que no existan se reportan como error.</p>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleUpload} className="hidden" />
            <Button onClick={() => fileRef.current?.click()} loading={uploading}>
              <Upload className="w-4 h-4 mr-2" /> {uploading ? 'Procesando...' : 'Seleccionar archivo CSV'}
            </Button>

            {resultado && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {resultado.actualizados} CUPS actualizados correctamente
                </div>
                {resultado.errores.length > 0 && (
                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-red-700 mb-2">
                      <AlertCircle className="w-4 h-4" />
                      {resultado.errores.length} errores:
                    </div>
                    <ul className="text-xs text-red-600 space-y-1">
                      {resultado.errores.map((e, i) => <li key={i}>• {e}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
