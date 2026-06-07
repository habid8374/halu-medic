'use client'
/**
 * Modal de búsqueda de paciente + ingreso activo.
 * Usado en Farmacia, Laboratorio, Enfermería, Consentimientos,
 * Nutrición, y cualquier módulo que necesite asociar una atención.
 *
 * Props:
 *  onSelect(paciente, ingreso?) — callback con el paciente y el ingreso elegido (puede ser null si no tiene ingreso activo)
 *  onClose — cierra el modal
 *  soloConIngreso — si true, solo muestra pacientes con ingresos activos
 */
import { useState, useRef, useEffect } from 'react'
import { pacientesAPI, ingresosAPI, mensajeError } from '@/lib/api'
import { Search, User, BedDouble, Calendar, X, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export interface PacienteResumen {
  id: string
  nombre_completo: string
  numero_documento: string
  tipo_documento: string
}

export interface IngresoResumen {
  id: string
  numero_ingreso?: number
  tipo_ingreso?: string
  tipo_ingreso_display?: string
  servicio?: string
  diagnostico_principal?: string
  diagnostico_principal_display?: string
  fecha_ingreso: string
  estado: string
  estado_display?: string
  cama?: string
}

interface Props {
  onSelect: (paciente: PacienteResumen, ingreso: IngresoResumen | null) => void
  onClose: () => void
  soloConIngreso?: boolean
  titulo?: string
}

export default function BuscadorPacienteIngreso({
  onSelect,
  onClose,
  soloConIngreso = false,
  titulo = 'Buscar paciente',
}: Props) {
  const [query, setQuery] = useState('')
  const [pacientes, setPacientes] = useState<PacienteResumen[]>([])
  const [ingresos, setIngresos] = useState<IngresoResumen[]>([])
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState<PacienteResumen | null>(null)
  const [loadingPacientes, setLoadingPacientes] = useState(false)
  const [loadingIngresos, setLoadingIngresos] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!query || query.length < 2) { setPacientes([]); return }
    const timer = setTimeout(async () => {
      setLoadingPacientes(true)
      try {
        const { data } = await pacientesAPI.list({ search: query, page_size: 8 })
        setPacientes(data.results ?? data)
      } catch (e) { toast.error(mensajeError(e)) }
      finally { setLoadingPacientes(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const seleccionarPaciente = async (p: PacienteResumen) => {
    setPacienteSeleccionado(p)
    setLoadingIngresos(true)
    try {
      const params: Record<string, unknown> = { paciente: p.id, ordering: '-fecha_ingreso' }
      if (soloConIngreso) params.estado = 'activo'
      const { data } = await ingresosAPI.list(params)
      const lista: IngresoResumen[] = data.results ?? data
      setIngresos(lista)
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setLoadingIngresos(false) }
  }

  const elegirIngreso = (ingreso: IngresoResumen) => {
    onSelect(pacienteSeleccionado!, ingreso)
  }

  const sinIngreso = () => {
    onSelect(pacienteSeleccionado!, null)
  }

  const volver = () => {
    setPacienteSeleccionado(null)
    setIngresos([])
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const estadoColor: Record<string, string> = {
    activo: 'bg-green-100 text-green-700',
    egresado: 'bg-slate-100 text-slate-600',
    alta_voluntaria: 'bg-amber-100 text-amber-700',
    trasladado: 'bg-blue-100 text-blue-700',
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-start justify-center pt-12 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          {pacienteSeleccionado ? (
            <button onClick={volver} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500">
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
          ) : (
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          )}
          <span className="font-semibold text-slate-900 text-sm flex-1">
            {pacienteSeleccionado
              ? `Ingresos de ${pacienteSeleccionado.nombre_completo}`
              : titulo}
          </span>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {!pacienteSeleccionado ? (
          <div>
            <div className="px-4 py-3 border-b border-slate-50">
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar por nombre, cédula, pasaporte..."
                className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-halu-500/20 focus:border-halu-400"
              />
            </div>
            <div className="max-h-80 overflow-y-auto">
              {loadingPacientes ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-halu-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : pacientes.length === 0 && query.length >= 2 ? (
                <p className="text-sm text-slate-400 text-center py-8">Sin resultados para "{query}"</p>
              ) : query.length < 2 ? (
                <p className="text-xs text-slate-400 text-center py-8">Escriba al menos 2 caracteres</p>
              ) : (
                pacientes.map(p => (
                  <button
                    key={p.id}
                    onClick={() => seleccionarPaciente(p)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors text-left"
                  >
                    <div className="w-8 h-8 bg-halu-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-halu-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{p.nombre_completo}</p>
                      <p className="text-xs text-slate-500">{p.tipo_documento} {p.numero_documento}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div>
            {/* Info del paciente seleccionado */}
            <div className="px-4 py-3 bg-halu-50 border-b border-halu-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-halu-100 rounded-full flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-halu-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{pacienteSeleccionado.nombre_completo}</p>
                  <p className="text-xs text-slate-500">{pacienteSeleccionado.tipo_documento} {pacienteSeleccionado.numero_documento}</p>
                </div>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto">
              {loadingIngresos ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-halu-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : ingresos.length === 0 ? (
                <div className="py-6 text-center">
                  <BedDouble className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Sin ingresos {soloConIngreso ? 'activos' : ''}</p>
                  {!soloConIngreso && (
                    <button
                      onClick={sinIngreso}
                      className="mt-3 text-xs text-halu-600 hover:underline font-medium"
                    >
                      Continuar sin ingreso →
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {ingresos.map(ing => (
                    <button
                      key={ing.id}
                      onClick={() => elegirIngreso(ing)}
                      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors text-left"
                    >
                      <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                        <BedDouble className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {ing.numero_ingreso && (
                            <span className="text-xs font-bold text-slate-700">
                              Ingreso #{ing.numero_ingreso}
                            </span>
                          )}
                          {ing.estado && (
                            <span className={clsx('text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                              estadoColor[ing.estado] || 'bg-slate-100 text-slate-600')}>
                              {ing.estado_display || ing.estado}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5 truncate">
                          {ing.tipo_ingreso_display || ing.tipo_ingreso}
                          {ing.servicio && ` · ${ing.servicio}`}
                        </p>
                        {ing.diagnostico_principal_display && (
                          <p className="text-xs text-slate-400 truncate">{ing.diagnostico_principal_display}</p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(ing.fecha_ingreso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 mt-1" />
                    </button>
                  ))}
                  {!soloConIngreso && (
                    <button
                      onClick={sinIngreso}
                      className="w-full px-4 py-3 text-xs text-slate-500 hover:bg-slate-50 border-t border-slate-100 transition-colors"
                    >
                      Continuar sin seleccionar ingreso →
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
