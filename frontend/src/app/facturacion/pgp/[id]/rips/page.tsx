'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { facturasPGPAPI, mensajeError } from '@/lib/api'
import { Button, Card, Spinner } from '@/components/ui'
import { ArrowLeft, FileText } from 'lucide-react'

export default function FacturaPGPRipsPage({ params }: { params: { id: string } }) {
  const { id } = params
  const [rips, setRips] = useState<object | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    facturasPGPAPI.rips(id)
      .then(({ data }) => setRips(data))
      .catch(err => setError(mensajeError(err)))
      .finally(() => setLoading(false))
  }, [id])

  const descargar = () => {
    if (!rips) return
    const r = rips as Record<string, unknown>
    const numFactura = (r.numFactura as string) || id
    const blob = new Blob([JSON.stringify(rips, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${numFactura}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page-padding max-w-4xl animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/facturacion/pgp/${id}`}>
          <Button variant="ghost" className="px-2"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">RIPS PGP — Res. 948/2026</h1>
          <p className="text-sm text-slate-500">Valores en cero · Modalidad Global Prospectivo</p>
        </div>
        {rips && (
          <Button variant="secondary" className="ml-auto" onClick={descargar}>
            <FileText className="w-4 h-4" />
            Descargar JSON
          </Button>
        )}
      </div>

      {loading && <div className="flex justify-center py-20"><Spinner size="lg" /></div>}

      {error && (
        <Card>
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      )}

      {rips && (
        <Card>
          <div className="mb-3 bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-2 text-xs text-cyan-700">
            En el modelo PGP/Capitado los valores de vrServicio y valorPagoModerador se reportan en 0 (cero)
            conforme a la Res. 948/2026.
          </div>
          <pre className="text-xs font-mono text-slate-700 overflow-auto max-h-[65vh] whitespace-pre-wrap break-all">
            {JSON.stringify(rips, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  )
}
