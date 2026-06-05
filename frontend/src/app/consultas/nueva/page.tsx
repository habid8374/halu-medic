'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { FormConsulta } from '@/components/consultas/FormConsulta'
import { PageHeader, Button } from '@/components/ui'
import { ArrowLeft } from 'lucide-react'

function NuevaConsultaInner() {
  const p = useSearchParams()
  return <FormConsulta pacienteId={p.get('paciente') ?? undefined} citaId={p.get('cita') ?? undefined} />
}

export default function NuevaConsultaPage() {
  return (
    <div className="page-padding max-w-3xl animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/consultas"><Button variant="ghost" className="px-2"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <PageHeader title="Nueva consulta" description="Registro clínico + RIPS + Factura electrónica" />
      </div>
      <Suspense><NuevaConsultaInner /></Suspense>
    </div>
  )
}
