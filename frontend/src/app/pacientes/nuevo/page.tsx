'use client'
import Link from 'next/link'
import { FormPaciente } from '@/components/pacientes/FormPaciente'
import { PageHeader, Button } from '@/components/ui'
import { ArrowLeft } from 'lucide-react'

export default function NuevoPacientePage() {
  return (
    <div className="page-padding max-w-3xl animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/pacientes">
          <Button variant="ghost" className="px-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <PageHeader
          title="Nuevo paciente"
          description="Completa la información del paciente"
        />
      </div>
      <FormPaciente />
    </div>
  )
}
