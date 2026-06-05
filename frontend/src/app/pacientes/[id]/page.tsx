'use client'

import Link from 'next/link'
import { usePaciente } from '@/hooks/usePacientes'
import { useAuth } from '@/lib/auth-context'
import { Badge, Button, Card, Spinner, PageHeader } from '@/components/ui'
import {
  calcularEdad, regimenInfo, tipoDocLabel, formatFecha, iniciales
} from '@/components/pacientes/helpers'
import {
  ArrowLeft, Phone, Mail, MapPin, Shield, Edit,
  CalendarPlus, ClipboardPlus, User, Cake, CreditCard,
} from 'lucide-react'
import clsx from 'clsx'

const avatarColors = ['bg-halu-600','bg-teal-600','bg-purple-600','bg-amber-600','bg-emerald-600','bg-rose-600']
function avatarColor(s: string) { return avatarColors[s.charCodeAt(0) % avatarColors.length] }

export default function PacienteDetallePage({ params }: { params: { id: string } }) {
  const { id } = params
  const { usuario } = useAuth()
  const { paciente, loading } = usePaciente(id)

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!paciente) {
    return (
      <div className="p-8">
        <p className="text-slate-500">Paciente no encontrado.</p>
        <Link href="/pacientes"><Button variant="secondary" className="mt-4">Volver</Button></Link>
      </div>
    )
  }

  const regimen = regimenInfo(paciente.regimen)
  const edad    = paciente.fecha_nacimiento ? calcularEdad(paciente.fecha_nacimiento) : null
  const ini     = iniciales(paciente.nombre_completo)

  return (
    <div className="p-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/pacientes">
          <Button variant="ghost" className="px-2"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <PageHeader title="Detalle del paciente" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Panel izquierdo — perfil */}
        <div className="space-y-4">
          {/* Card perfil */}
          <Card>
            <div className="flex flex-col items-center text-center">
              <div className={clsx(
                'w-20 h-20 rounded-2xl flex items-center justify-center mb-4',
                avatarColor(paciente.primer_apellido)
              )}>
                <span className="text-white text-2xl font-bold">{ini}</span>
              </div>
              <h2 className="font-bold text-slate-900 text-lg leading-tight">
                {paciente.nombre_completo}
              </h2>
              <div className="flex items-center gap-2 mt-2 flex-wrap justify-center">
                <Badge variant={regimen.color as 'info' | 'success' | 'warning' | 'default' | 'purple'}>
                  {regimen.label}
                </Badge>
                {!paciente.activo && <Badge variant="danger">Inactivo</Badge>}
              </div>

              {/* Acciones rápidas */}
              {usuario?.permisos.puede_gestionar_citas && (
                <div className="flex gap-2 mt-4 w-full">
                  <Link href={`/citas/nueva?paciente=${paciente.id}`} className="flex-1">
                    <Button variant="secondary" className="w-full text-xs py-2">
                      <CalendarPlus className="w-3.5 h-3.5" />
                      Nueva cita
                    </Button>
                  </Link>
                  {usuario?.permisos.puede_editar_clinica && (
                    <Link href={`/consultas/nueva?paciente=${paciente.id}`} className="flex-1">
                      <Button variant="secondary" className="w-full text-xs py-2">
                        <ClipboardPlus className="w-3.5 h-3.5" />
                        Consulta
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Info básica */}
          <Card>
            <h3 className="font-semibold text-slate-900 text-sm mb-4">Información</h3>
            <div className="space-y-3">
              <InfoRow icon={CreditCard} label="Documento"
                value={`${tipoDocLabel(paciente.tipo_identificacion)} ${paciente.numero_identificacion}`} />
              <InfoRow icon={Cake} label="Fecha nac."
                value={`${formatFecha(paciente.fecha_nacimiento)}${edad !== null ? ` (${edad} años)` : ''}`} />
              <InfoRow icon={User} label="Sexo"
                value={paciente.sexo === 'M' ? 'Masculino' : paciente.sexo === 'F' ? 'Femenino' : 'Indeterminado'} />
              {paciente.telefono && <InfoRow icon={Phone} label="Teléfono" value={paciente.telefono} />}
              {paciente.email && <InfoRow icon={Mail} label="Email" value={paciente.email} />}
              {paciente.direccion && <InfoRow icon={MapPin} label="Dirección" value={paciente.direccion} />}
            </div>
          </Card>

          {/* Aseguramiento */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-emerald-600" />
              <h3 className="font-semibold text-slate-900 text-sm">Aseguramiento</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Régimen</span>
                <Badge variant={regimen.color as 'info' | 'success' | 'warning' | 'default' | 'purple'}>
                  {regimen.label}
                </Badge>
              </div>
              {paciente.aseguradora_nombre && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Aseguradora</span>
                  <span className="text-slate-800 font-medium text-right max-w-[140px] truncate">
                    {paciente.aseguradora_nombre}
                  </span>
                </div>
              )}
              {paciente.numero_poliza && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Póliza</span>
                  <span className="text-slate-800 font-mono text-xs">{paciente.numero_poliza}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Editar */}
          {usuario?.permisos.puede_gestionar_citas && (
            <Link href={`/pacientes/${paciente.id}/editar`}>
              <Button variant="secondary" className="w-full">
                <Edit className="w-4 h-4" />
                Editar paciente
              </Button>
            </Link>
          )}
        </div>

        {/* Panel derecho — historial */}
        <div className="lg:col-span-2 space-y-4">
          {/* Últimas citas */}
          <Card padding={false}>
            <div className="flex items-center justify-between p-5 border-b border-slate-50">
              <h3 className="font-semibold text-slate-900 text-sm">Citas recientes</h3>
              <Link href={`/citas?paciente=${paciente.id}`}>
                <span className="text-xs text-halu-600 hover:underline">Ver todas</span>
              </Link>
            </div>
            <div className="p-4">
              <div className="text-center py-8 text-slate-400 text-sm">
                Sin citas registradas
              </div>
            </div>
          </Card>

          {/* Últimas consultas */}
          <Card padding={false}>
            <div className="flex items-center justify-between p-5 border-b border-slate-50">
              <h3 className="font-semibold text-slate-900 text-sm">Consultas recientes</h3>
              <Link href={`/consultas?paciente=${paciente.id}`}>
                <span className="text-xs text-halu-600 hover:underline">Ver todas</span>
              </Link>
            </div>
            <div className="p-4">
              <div className="text-center py-8 text-slate-400 text-sm">
                Sin consultas registradas
              </div>
            </div>
          </Card>

          {/* Facturas */}
          {usuario?.permisos.puede_facturar && (
            <Card padding={false}>
              <div className="flex items-center justify-between p-5 border-b border-slate-50">
                <h3 className="font-semibold text-slate-900 text-sm">Facturas electrónicas</h3>
                <Link href={`/facturacion?paciente=${paciente.id}`}>
                  <span className="text-xs text-halu-600 hover:underline">Ver todas</span>
                </Link>
              </div>
              <div className="p-4">
                <div className="text-center py-8 text-slate-400 text-sm">
                  Sin facturas registradas
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm text-slate-800 font-medium break-words">{value}</p>
      </div>
    </div>
  )
}
