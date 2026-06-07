'use client'
import { useState, useEffect } from 'react'
import api, { mensajeError } from '@/lib/api'
import { PageHeader, Button, Badge, EmptyState } from '@/components/ui'
import { Plus, X, ToggleLeft, ToggleRight } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const INPUT = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/20 bg-white'

interface DietaPrescripcion {
  id: string
  paciente_nombre: string
  servicio?: string
  tipo_dieta: string
  tipo_dieta_display: string
  via_administracion: string
  calorias_dia: number
  proteinas_g: number
  restricciones: string
  suplementos: string
  fecha_inicio: string
  activa: boolean
}

const TIPO_DIETA_COLOR: Record<string, string> = {
  npo: 'bg-red-100 text-red-800',
  liquida: 'bg-orange-100 text-orange-800',
  blanda: 'bg-yellow-100 text-yellow-800',
  normal: 'bg-emerald-100 text-emerald-800',
  diabetica: 'bg-purple-100 text-purple-800',
  renal: 'bg-blue-100 text-blue-800',
  hipocalorica: 'bg-pink-100 text-pink-800',
  hipercalorica: 'bg-indigo-100 text-indigo-800',
}

export default function NutricionPage() {
  const [dietas, setDietas] = useState<DietaPrescripcion[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const cargar = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/operaciones/dietas/')
      setDietas(data.results ?? data)
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const toggleActiva = async (dieta: DietaPrescripcion) => {
    try {
      await api.patch(`/api/operaciones/dietas/${dieta.id}/`, { activa: !dieta.activa })
      toast.success(dieta.activa ? 'Dieta desactivada' : 'Dieta activada')
      cargar()
    } catch (e) { toast.error(mensajeError(e)) }
  }

  // Agrupar por servicio
  const servicios = [...new Set(dietas.map(d => d.servicio || 'Sin servicio'))]

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="Nutrición Hospitalaria"
        description="Prescripciones dietéticas activas por servicio"
        action={
          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4" /> Nueva dieta
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-xl border animate-pulse" />
          ))}
        </div>
      ) : dietas.length === 0 ? (
        <EmptyState title="Sin prescripciones" description="No hay dietas prescritas actualmente" />
      ) : (
        <div className="space-y-6">
          {servicios.map(servicio => {
            const dietasServicio = dietas.filter(d => (d.servicio || 'Sin servicio') === servicio)
            return (
              <div key={servicio}>
                <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-halu-500 rounded-full" />
                  {servicio}
                  <span className="text-xs text-slate-400 font-normal">({dietasServicio.length})</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {dietasServicio.map(d => (
                    <div key={d.id} className={clsx('bg-white rounded-xl border p-4 flex flex-col gap-2',
                      d.activa ? 'border-slate-100' : 'border-slate-100 opacity-60'
                    )}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 text-sm truncate">{d.paciente_nombre}</p>
                          <p className="text-xs text-slate-500">Inicio: {d.fecha_inicio}</p>
                        </div>
                        <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0',
                          TIPO_DIETA_COLOR[d.tipo_dieta] || 'bg-slate-100 text-slate-700'
                        )}>
                          {d.tipo_dieta_display || d.tipo_dieta}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 space-y-0.5">
                        <p>Vía: {d.via_administracion}</p>
                        {d.calorias_dia > 0 && <p>{d.calorias_dia} kcal/día{d.proteinas_g > 0 ? ` · ${d.proteinas_g}g proteína` : ''}</p>}
                        {d.restricciones && (
                          <p className="line-clamp-2 text-slate-400">Restricciones: {d.restricciones}</p>
                        )}
                        {d.suplementos && (
                          <p className="text-slate-400">Suplementos: {d.suplementos}</p>
                        )}
                      </div>
                      <div className="mt-1">
                        <button
                          onClick={() => toggleActiva(d)}
                          className={clsx('flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg transition-colors',
                            d.activa
                              ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                              : 'text-slate-500 bg-slate-50 hover:bg-slate-100'
                          )}
                        >
                          {d.activa
                            ? <><ToggleRight className="w-3.5 h-3.5" /> Activa</>
                            : <><ToggleLeft className="w-3.5 h-3.5" /> Inactiva</>
                          }
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <NuevaDietaModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); cargar() }}
        />
      )}
    </div>
  )
}

function NuevaDietaModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    paciente: '', ingreso: '', tipo_dieta: 'normal', via_administracion: 'oral',
    calorias_dia: '', proteinas_g: '', restricciones: '', suplementos: '',
    fecha_inicio: new Date().toISOString().slice(0, 10),
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const guardar = async () => {
    if (!form.paciente || !form.tipo_dieta) { toast.error('Paciente y tipo de dieta son requeridos'); return }
    setSaving(true)
    try {
      await api.post('/api/operaciones/dietas/', {
        ...form,
        calorias_dia: form.calorias_dia ? Number(form.calorias_dia) : null,
        proteinas_g: form.proteinas_g ? Number(form.proteinas_g) : null,
        activa: true,
      })
      toast.success('Dieta prescrita')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <div><h2 className="font-bold text-slate-900">Nueva prescripción dietética</h2></div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">ID del paciente *</label>
              <input value={form.paciente} onChange={set('paciente')} className={INPUT} placeholder="UUID" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">ID del ingreso</label>
              <input value={form.ingreso} onChange={set('ingreso')} className={INPUT} placeholder="UUID ingreso" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Tipo de dieta *</label>
              <select value={form.tipo_dieta} onChange={set('tipo_dieta')} className={INPUT}>
                <option value="npo">NPO (Nada por vía oral)</option>
                <option value="liquida">Líquida clara</option>
                <option value="blanda">Blanda</option>
                <option value="normal">Normal</option>
                <option value="diabetica">Diabética</option>
                <option value="renal">Renal</option>
                <option value="hipocalorica">Hipocalórica</option>
                <option value="hipercalorica">Hipercalórica</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Vía de administración</label>
              <select value={form.via_administracion} onChange={set('via_administracion')} className={INPUT}>
                <option value="oral">Oral</option>
                <option value="sonda_nasogastrica">Sonda nasogástrica</option>
                <option value="sonda_nasoenteral">Sonda nasoenteral</option>
                <option value="gastrostomia">Gastrostomía</option>
                <option value="parenteral">Parenteral</option>
                <option value="mixta">Mixta</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Calorías/día (kcal)</label>
              <input type="number" min="0" value={form.calorias_dia} onChange={set('calorias_dia')} className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Proteínas/día (g)</label>
              <input type="number" min="0" value={form.proteinas_g} onChange={set('proteinas_g')} className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Fecha inicio</label>
              <input type="date" value={form.fecha_inicio} onChange={set('fecha_inicio')} className={INPUT} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Restricciones alimentarias</label>
            <textarea value={form.restricciones} onChange={set('restricciones')}
              className={INPUT + ' h-16 resize-none'} placeholder="Ej. Sin sal, sin gluten..." />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Suplementos</label>
            <input value={form.suplementos} onChange={set('suplementos')} className={INPUT} placeholder="Ej. Ensure, vitamina C..." />
          </div>
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Prescribir dieta</Button>
        </div>
      </div>
    </div>
  )
}
