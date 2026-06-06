'use client'
import { useEffect, useState, useCallback } from 'react'
import { ayudasDiagnosticasAPI } from '@/lib/api'
import type { AyudaDiagnostica, TipoAyuda, EstadoAyuda } from '@/types'
import toast from 'react-hot-toast'
import { Microscope, Search, Eye, Loader2, CheckCircle2, Clock, XCircle, Upload } from 'lucide-react'
import Link from 'next/link'
import clsx from 'clsx'

const TIPO_LABELS: Record<TipoAyuda, string> = {
  laboratorio: 'Laboratorio', rx: 'Rayos X', ecografia: 'Ecografía',
  tomografia: 'Tomografía', resonancia: 'Resonancia', electrocardiograma: 'ECG',
  ecocardiograma: 'Ecocardiograma', endoscopia: 'Endoscopia', biopsia: 'Biopsia',
  espirometria: 'Espirometría', otro: 'Otro',
}
const ESTADO_COLORS: Record<EstadoAyuda, string> = {
  solicitada: 'bg-amber-100 text-amber-700',
  tomada: 'bg-blue-100 text-blue-700',
  resultado: 'bg-green-100 text-green-700',
  cancelada: 'bg-slate-100 text-slate-500',
}
const ESTADO_ICONS: Record<EstadoAyuda, React.ElementType> = {
  solicitada: Clock,
  tomada: Upload,
  resultado: CheckCircle2,
  cancelada: XCircle,
}

export default function AyudasPage() {
  const [ayudas, setAyudas] = useState<AyudaDiagnostica[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (filtroTipo) params.tipo = filtroTipo
      if (filtroEstado) params.estado = filtroEstado
      const res = await ayudasDiagnosticasAPI.list(params)
      setAyudas(res.data.results ?? res.data)
    } catch {
      toast.error('Error al cargar ayudas diagnósticas')
    } finally {
      setLoading(false)
    }
  }, [filtroTipo, filtroEstado])

  useEffect(() => { load() }, [load])

  const filtradas = ayudas.filter(a =>
    !busqueda ||
    a.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
    a.medico_solicitante_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    a.cups?.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-halu-100 rounded-2xl flex items-center justify-center">
          <Microscope className="w-5 h-5 text-halu-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Ayudas diagnósticas</h1>
          <p className="text-sm text-slate-500">Laboratorios, imágenes y estudios</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="input-base w-full pl-9"
              placeholder="Buscar por descripción, CUPS o médico..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
          <select className="input-base" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="input-base" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="solicitada">Solicitada</option>
            <option value="tomada">Tomada</option>
            <option value="resultado">Con resultado</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(['solicitada', 'tomada', 'resultado', 'cancelada'] as EstadoAyuda[]).map(estado => {
          const count = ayudas.filter(a => a.estado === estado).length
          const Icon = ESTADO_ICONS[estado]
          return (
            <div key={estado} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3">
              <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center', ESTADO_COLORS[estado])}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-800">{count}</p>
                <p className="text-xs text-slate-500 capitalize">{estado === 'solicitada' ? 'Solicitadas' : estado === 'tomada' ? 'Tomadas' : estado === 'resultado' ? 'Con resultado' : 'Canceladas'}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-halu-600" />
          </div>
        ) : filtradas.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Microscope className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No se encontraron ayudas diagnósticas</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Descripción</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Médico solicitante</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtradas.map(a => {
                const Icon = ESTADO_ICONS[a.estado]
                return (
                  <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-medium">
                        {TIPO_LABELS[a.tipo]}
                      </span>
                      {a.urgente && <span className="ml-1 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Urgente</span>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{a.descripcion}</p>
                      {a.cups && <p className="text-xs text-slate-400">{a.cups}</p>}
                      {a.indicacion_clinica && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{a.indicacion_clinica}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{a.medico_solicitante_nombre || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{new Date(a.fecha_solicitud).toLocaleDateString('es-CO')}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={clsx('inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium', ESTADO_COLORS[a.estado])}>
                        <Icon className="w-3 h-3" />
                        {a.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {a.ingreso && (
                        <Link
                          href={`/salud/ingreso/${a.ingreso}`}
                          className="p-1.5 text-slate-400 hover:text-halu-600 hover:bg-halu-50 rounded-lg inline-flex"
                          title="Ver ingreso"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
