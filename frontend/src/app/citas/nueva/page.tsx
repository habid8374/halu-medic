'use client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { FormCita } from '@/components/citas/FormCita'
import { PageHeader, Button } from '@/components/ui'
import { ArrowLeft } from 'lucide-react'
import { Suspense } from 'react'

function NuevaCitaInner() {
  const params = useSearchParams()
  const pacienteId = params.get('paciente') ?? undefined
  return <FormCita pacienteId={pacienteId} />
}

export default function NuevaCitaPage() {
  return (
    <div className="p-8 max-w-2xl animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/citas"><Button variant="ghost" className="px-2"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <PageHeader title="Nueva cita" description="Agenda una cita para un paciente" />
      </div>
      <Suspense><NuevaCitaInner /></Suspense>
    </div>
  )
}
