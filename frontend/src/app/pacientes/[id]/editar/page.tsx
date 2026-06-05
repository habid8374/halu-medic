'use client'

import Link from 'next/link'
import { usePaciente } from '@/hooks/usePacientes'
import { FormPaciente } from '@/components/pacientes/FormPaciente'
import { PageHeader, Button, Spinner } from '@/components/ui'
import { ArrowLeft } from 'lucide-react'

export default function EditarPacientePage({ params }: { params: { id: string } }) {
  const { id } = params
  const { paciente, loading } = usePaciente(id)

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/pacientes/${id}`}>
          <Button variant="ghost" className="px-2"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <PageHeader
          title="Editar paciente"
          description={paciente?.nombre_completo}
        />
      </div>
      {paciente && <FormPaciente inicial={paciente} />}
    </div>
  )
}
