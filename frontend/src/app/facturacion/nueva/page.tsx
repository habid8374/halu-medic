'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { consultasAPI, facturasAPI, mensajeError } from '@/lib/api'
import { PageHeader, Button, Card, Input } from '@/components/ui'
import { ArrowLeft, Receipt, Search, FileText, ClipboardList, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { Consulta } from '@/types'
import clsx from 'clsx'

interface HCPendiente {
  id: string
  numero_hc: number
  fecha_atencion: string
  tipo_registro: string
  diagnostico_principal: string
  paciente_nombre: string
  paciente_doc: string
}

export default function NuevaFacturaPage() {
  const router = useRouter()
  const [modo, setModo] = useState<'consulta' | 'hc'>('hc')
  const [busq, setBusq] = useState('')
  const [resultadosConsulta, setResultadosConsulta] = useState<Consulta[]>([])
  const [resultadosHC, setResultadosHC] = useState<HCPendiente[]>([])
  const [selConsulta, setSelConsulta] = useState<Consulta | null>(null)
  const [selHC, setSelHC] = useState<HCPendiente | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [creando, setCreando] = useState(false)

  const buscar = async () => {
    if (!busq.trim()) return
    setBuscando(true)
    setResultadosConsulta([]); setResultadosHC([])
    setSelConsulta(null); setSelHC(null)
    try {
      if (modo === 'consulta') {
        const { data } = await consultasAPI.list({ search: busq, estado: 'cerrada' })
        setResultadosConsulta(data.results ?? data)
      } else {
        // buscar por documento o número HC
        const params: Record<string, string> = {}
        if (/^\d+$/.test(busq) && busq.length <= 7) {
          params.numero_hc = busq
        } else {
          params.documento = busq
        }
        const { data } = await facturasAPI.pendientes(params)
        setResultadosHC(Array.isArray(data) ? data : data.results ?? [])
      }
    } catch (err) { toast.error(mensajeError(err)) }
    finally { setBuscando(false) }
  }

  const crear = async () => {
    setCreando(true)
    try {
      let payload: Record<string, unknown> = {}
      if (modo === 'consulta' && selConsulta) {
        payload = { consulta: selConsulta.id }
      } else if (modo === 'hc' && selHC) {
        payload = { historia: selHC.id }
      } else { toast.error('Selecciona un registro'); setCreando(false); return }

      const { data } = await facturasAPI.create(payload)
      toast.success('Factura creada')
      router.push(`/facturacion/${data.id}`)
    } catch (err) { toast.error(mensajeError(err)) }
    finally { setCreando(false) }
  }

  const seleccionado = modo === 'hc' ? selHC : selConsulta

  return (
    <div className="page-padding max-w-2xl animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/facturacion">
          <Button variant="ghost" className="px-2"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <PageHeader title="Nueva factura por evento" description="Busca el registro para facturar" />
      </div>

      <div className="space-y-4">
        {/* Selector de modo */}
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
          <button onClick={() => setModo('hc')}
            className={clsx('flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all',
              modo === 'hc' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            <ClipboardList className="w-4 h-4" />
            Por Historia Clínica
          </button>
          <button onClick={() => setModo('consulta')}
            className={clsx('flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all',
              modo === 'consulta' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            <FileText className="w-4 h-4" />
            Por Consulta
          </button>
        </div>

        <Card>
          {modo === 'hc' && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-xl mb-4 border border-blue-100">
              <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700">
                Busca por <strong>documento del paciente</strong> o <strong>número de HC</strong> (ej: 12345).
                Solo aparecen historias <strong>sin factura</strong>.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={busq}
              onChange={e => setBusq(e.target.value)}
              placeholder={modo === 'hc'
                ? 'Cédula del paciente o número HC...'
                : 'Nombre del paciente o cédula...'}
              className="flex-1"
              onKeyDown={e => e.key === 'Enter' && buscar()}
            />
            <Button onClick={buscar} loading={buscando} variant="secondary">
              <Search className="w-4 h-4" />
            </Button>
          </div>

          {/* Resultados HC */}
          {modo === 'hc' && resultadosHC.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {resultadosHC.map(hc => (
                <button key={hc.id} onClick={() => setSelHC(hc)}
                  className={clsx('w-full text-left p-3 rounded-xl border text-sm transition-all',
                    selHC?.id === hc.id ? 'border-halu-400 bg-halu-50' : 'border-slate-100 hover:border-slate-200')}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-halu-700 bg-halu-50 border border-halu-200 px-2 py-0.5 rounded-full">
                      HC-{String(hc.numero_hc).padStart(5, '0')}
                    </span>
                    <span className="font-semibold text-slate-900">{hc.paciente_nombre}</span>
                    <span className="text-xs text-slate-400 ml-auto">{new Date(hc.fecha_atencion).toLocaleDateString('es-CO')}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span>Doc: {hc.paciente_doc}</span>
                    {hc.diagnostico_principal && <span>Dx: {hc.diagnostico_principal}</span>}
                    <span className="capitalize">{hc.tipo_registro?.replace('_', ' ')}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Resultados consulta */}
          {modo === 'consulta' && resultadosConsulta.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {resultadosConsulta.map(c => (
                <button key={c.id} onClick={() => setSelConsulta(c)}
                  className={clsx('w-full text-left p-3 rounded-xl border text-sm transition-all',
                    selConsulta?.id === c.id ? 'border-halu-400 bg-halu-50' : 'border-slate-100 hover:border-slate-200')}>
                  <p className="font-medium text-slate-900">{c.paciente_nombre}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    CUPS: {c.cups_principal} · DX: {c.diagnostico_principal}
                    {' · '}{new Date(c.fecha_atencion).toLocaleDateString('es-CO')}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Sin resultados */}
          {busq && !buscando && resultadosHC.length === 0 && resultadosConsulta.length === 0 && (
            <p className="text-sm text-slate-400 text-center mt-3 py-2">
              No se encontraron registros pendientes de facturar
            </p>
          )}
        </Card>

        {/* Confirmar factura */}
        {seleccionado && (
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Receipt className="w-4 h-4 text-halu-600" />
              <h3 className="font-semibold text-slate-900 text-sm">Confirmar factura electrónica</h3>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 mb-4 text-sm">
              {selHC && (
                <>
                  <p className="font-semibold text-slate-900">{selHC.paciente_nombre}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    HC-{String(selHC.numero_hc).padStart(5, '0')} ·
                    Doc: {selHC.paciente_doc} ·
                    {new Date(selHC.fecha_atencion).toLocaleDateString('es-CO')}
                  </p>
                  {selHC.diagnostico_principal && (
                    <p className="text-xs text-purple-700 mt-1">Dx: {selHC.diagnostico_principal}</p>
                  )}
                </>
              )}
              {selConsulta && (
                <>
                  <p className="font-semibold text-slate-900">{selConsulta.paciente_nombre}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    CUPS: {selConsulta.cups_principal} · DX: {selConsulta.diagnostico_principal}
                  </p>
                </>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-4">
              La operación SS y el tipo de cobertura se determinan automáticamente
              según el régimen del paciente y su convenio EPS.
            </p>
            <Button onClick={crear} loading={creando} className="w-full">
              <Receipt className="w-4 h-4" />
              Crear factura electrónica
            </Button>
          </Card>
        )}
      </div>
    </div>
  )
}
