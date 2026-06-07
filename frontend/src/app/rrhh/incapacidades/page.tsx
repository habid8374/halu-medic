'use client'
import { useState, useEffect } from 'react'
import api, { mensajeError } from '@/lib/api'
import { PageHeader, Button, Badge, EmptyState, Card } from '@/components/ui'
import { Plus, X, ShieldAlert, Heart, Baby, Briefcase } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const INPUT = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/20 bg-white'

interface Incapacidad {
  id: string
  empleado_nombre: string
  tipo: string
  tipo_display: string
  fecha_inicio: string
  fecha_fin: string
  dias: number
  diagnostico_cie10: string
  medico_expide: string
  entidad_paga: string
  entidad_paga_display: string
}

function tipoBadge(tipo: string): 'danger' | 'warning' | 'default' | 'info' {
  if (tipo === 'eps') return 'danger'
  if (tipo === 'arl') return 'warning'
  if (tipo === 'maternidad' || tipo === 'paternidad') return 'info'
  return 'default'
}

export default function IncapacidadesPage() {
  const [incapacidades, setIncapacidades] = useState<Incapacidad[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const cargar = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/rrhh/incapacidades/')
      setIncapacidades(data.results ?? data)
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const hoy = new Date().toISOString().slice(0, 10)
  const activas = incapacidades.filter(i => i.fecha_inicio <= hoy && (!i.fecha_fin || i.fecha_fin >= hoy))
  const porEps = incapacidades.filter(i => i.tipo === 'eps' || i.entidad_paga === 'eps').length
  const porArl = incapacidades.filter(i => i.tipo === 'arl' || i.entidad_paga === 'arl').length
  const porMat = incapacidades.filter(i => i.tipo === 'maternidad').length

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="Incapacidades"
        description="Gestión de incapacidades laborales del personal"
        action={
          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4" /> Nueva incapacidad
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {loading ? Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-white rounded-xl border animate-pulse" />
        )) : (
          <>
            <Card className="flex items-center gap-3">
              <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center"><ShieldAlert className="w-4 h-4 text-red-600" /></div>
              <div><p className="text-2xl font-bold text-slate-900">{activas.length}</p><p className="text-xs text-slate-500">Activas hoy</p></div>
            </Card>
            <Card className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center"><Heart className="w-4 h-4 text-blue-600" /></div>
              <div><p className="text-2xl font-bold text-slate-900">{porEps}</p><p className="text-xs text-slate-500">Por EPS</p></div>
            </Card>
            <Card className="flex items-center gap-3">
              <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center"><Briefcase className="w-4 h-4 text-amber-600" /></div>
              <div><p className="text-2xl font-bold text-slate-900">{porArl}</p><p className="text-xs text-slate-500">Por ARL</p></div>
            </Card>
            <Card className="flex items-center gap-3">
              <div className="w-9 h-9 bg-pink-100 rounded-xl flex items-center justify-center"><Baby className="w-4 h-4 text-pink-600" /></div>
              <div><p className="text-2xl font-bold text-slate-900">{porMat}</p><p className="text-xs text-slate-500">Maternidad</p></div>
            </Card>
          </>
        )}
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {loading ? Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-white rounded-xl border animate-pulse" />
        )) : incapacidades.length === 0 ? (
          <EmptyState title="Sin incapacidades" description="No hay incapacidades registradas" />
        ) : incapacidades.map(inc => (
          <div key={inc.id} className="bg-white rounded-xl border border-slate-100 p-4 flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-slate-900 text-sm">{inc.empleado_nombre}</span>
                <Badge variant={tipoBadge(inc.tipo)}>{inc.tipo_display || inc.tipo}</Badge>
                {inc.entidad_paga_display && (
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                    Paga: {inc.entidad_paga_display}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {inc.fecha_inicio} → {inc.fecha_fin || 'Indefinido'} · {inc.dias} día(s)
              </p>
              {inc.diagnostico_cie10 && (
                <p className="text-xs text-slate-400 mt-0.5">CIE-10: {inc.diagnostico_cie10}</p>
              )}
            </div>
            {inc.medico_expide && (
              <span className="text-xs text-slate-400 flex-shrink-0">{inc.medico_expide}</span>
            )}
          </div>
        ))}
      </div>

      {showModal && (
        <NuevaIncapacidadModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); cargar() }}
        />
      )}
    </div>
  )
}

function NuevaIncapacidadModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    empleado: '', tipo: 'eps', fecha_inicio: '', fecha_fin: '',
    diagnostico_cie10: '', medico_expide: '', entidad_paga: 'eps',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const guardar = async () => {
    if (!form.empleado || !form.fecha_inicio) {
      toast.error('Empleado y fecha inicio son requeridos'); return
    }
    setSaving(true)
    try {
      await api.post('/api/rrhh/incapacidades/', form)
      toast.success('Incapacidad registrada')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <div><h2 className="font-bold text-slate-900">Nueva incapacidad</h2><p className="text-xs text-slate-500">Registrar incapacidad laboral</p></div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">ID del empleado *</label>
            <input value={form.empleado} onChange={set('empleado')} className={INPUT} placeholder="UUID del empleado" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Tipo *</label>
              <select value={form.tipo} onChange={set('tipo')} className={INPUT}>
                <option value="eps">EPS / Enfermedad general</option>
                <option value="arl">ARL / Accidente laboral</option>
                <option value="maternidad">Licencia maternidad</option>
                <option value="paternidad">Licencia paternidad</option>
                <option value="luto">Licencia luto</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Entidad que paga</label>
              <select value={form.entidad_paga} onChange={set('entidad_paga')} className={INPUT}>
                <option value="eps">EPS</option>
                <option value="arl">ARL</option>
                <option value="empleador">Empleador</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Fecha inicio *</label>
              <input type="date" value={form.fecha_inicio} onChange={set('fecha_inicio')} className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Fecha fin</label>
              <input type="date" value={form.fecha_fin} onChange={set('fecha_fin')} className={INPUT} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Diagnóstico CIE-10</label>
            <input value={form.diagnostico_cie10} onChange={set('diagnostico_cie10')} className={INPUT} placeholder="Ej. J06 - IRA" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Médico que expide</label>
            <input value={form.medico_expide} onChange={set('medico_expide')} className={INPUT} placeholder="Nombre del médico" />
          </div>
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Registrar incapacidad</Button>
        </div>
      </div>
    </div>
  )
}
