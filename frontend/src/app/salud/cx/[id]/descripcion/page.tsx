'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { programacionCxAPI, descripcionQxAPI, medicosAPI, mensajeError } from '@/lib/api'
import { ProgramacionCx, DescripcionQuirurgica, MedicoProfesional } from '@/types'
import { PageHeader, Button } from '@/components/ui'
import { ArrowLeft, Lock, CheckCircle, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function DescripcionQxPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const [cx, setCx]         = useState<ProgramacionCx | null>(null)
  const [dqx, setDqx]       = useState<DescripcionQuirurgica | null>(null)
  const [medicos, setMedicos] = useState<MedicoProfesional[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState<Record<string, string | number | null>>({
    diagnostico_preoperatorio: '', desc_diag_preop: '',
    diagnostico_postoperatorio: '', desc_diag_postop: '',
    cups_principal: '', descripcion_procedimiento: '',
    tipo_anestesia: 'general',
    cirujano: '', anestesiologo: '',
    primer_ayudante: '', segundo_ayudante: '',
    instrumentadora: '', enfermera_circulante: '',
    fecha_hora_inicio: '', fecha_hora_fin: '', quirofano: '',
    descripcion_tecnica: '', hallazgos: '', especimenes: '',
    implantes: '', complicaciones: '',
    sangrado_estimado_ml: '', liquidos_administrados: '',
    plan_postoperatorio: '',
  })

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.allSettled([
      programacionCxAPI.get(id),
      descripcionQxAPI.list({ programacion: id }),
      medicosAPI.list(),
    ]).then(([cxRes, dqxRes, medRes]) => {
      if (cxRes.status === 'fulfilled') {
        const c = cxRes.value.data
        setCx(c)
        setForm(f => ({
          ...f,
          cups_principal: c.cups_principal,
          descripcion_procedimiento: c.descripcion_cups,
          tipo_anestesia: c.tipo_anestesia,
          cirujano: c.cirujano ?? '',
          anestesiologo: c.anestesiologo ?? '',
          diagnostico_preoperatorio: c.diagnostico_preop,
          desc_diag_preop: c.desc_diagnostico_preop,
          quirofano: c.quirofano,
          fecha_hora_inicio: c.fecha_programada?.slice(0, 16) ?? '',
          ingreso: c.ingreso ?? '',
        }))
      }
      if (dqxRes.status === 'fulfilled') {
        const list = Array.isArray(dqxRes.value.data) ? dqxRes.value.data : dqxRes.value.data.results ?? []
        if (list.length > 0) {
          const d = list[0] as DescripcionQuirurgica
          setDqx(d)
          setForm({
            diagnostico_preoperatorio: d.diagnostico_preoperatorio,
            desc_diag_preop: d.desc_diag_preop,
            diagnostico_postoperatorio: d.diagnostico_postoperatorio,
            desc_diag_postop: d.desc_diag_postop,
            cups_principal: d.cups_principal,
            descripcion_procedimiento: d.descripcion_procedimiento,
            tipo_anestesia: d.tipo_anestesia,
            cirujano: d.cirujano ?? '',
            anestesiologo: d.anestesiologo ?? '',
            primer_ayudante: d.primer_ayudante,
            segundo_ayudante: d.segundo_ayudante,
            instrumentadora: d.instrumentadora,
            enfermera_circulante: d.enfermera_circulante,
            fecha_hora_inicio: d.fecha_hora_inicio?.slice(0, 16) ?? '',
            fecha_hora_fin: d.fecha_hora_fin?.slice(0, 16) ?? '',
            quirofano: d.quirofano,
            descripcion_tecnica: d.descripcion_tecnica,
            hallazgos: d.hallazgos,
            especimenes: d.especimenes,
            implantes: d.implantes,
            complicaciones: d.complicaciones,
            sangrado_estimado_ml: d.sangrado_estimado_ml ?? '',
            liquidos_administrados: d.liquidos_administrados,
            plan_postoperatorio: d.plan_postoperatorio,
          })
        }
      }
      if (medRes.status === 'fulfilled') setMedicos(Array.isArray(medRes.value.data) ? medRes.value.data : [])
    }).finally(() => setLoading(false))
  }, [id])

  const f = (key: string, val: string | number) =>
    setForm(prev => ({ ...prev, [key]: val }))

  const guardar = async (firmar = false) => {
    if (!form.descripcion_tecnica) { toast.error('La descripción técnica es obligatoria'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        programacion: id,
        ingreso: cx?.ingreso ?? null,
        fecha_hora_inicio: form.fecha_hora_inicio ? (form.fecha_hora_inicio as string) + ':00' : null,
        fecha_hora_fin:    form.fecha_hora_fin    ? (form.fecha_hora_fin    as string) + ':00' : null,
        sangrado_estimado_ml: form.sangrado_estimado_ml ? Number(form.sangrado_estimado_ml) : null,
      }
      let savedDqx: DescripcionQuirurgica
      if (dqx) {
        const { data } = await descripcionQxAPI.update(dqx.id, payload)
        savedDqx = data
      } else {
        const { data } = await descripcionQxAPI.create(payload)
        savedDqx = data
        setDqx(data)
      }
      if (firmar) {
        const { data } = await descripcionQxAPI.firmar(savedDqx.id)
        setDqx(data)
        toast.success('Descripción quirúrgica firmada correctamente')
      } else {
        toast.success('Guardado')
      }
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-halu-600 border-t-transparent rounded-full animate-spin" /></div>

  const esFirmada = dqx?.firmada ?? false

  return (
    <div className="page-padding max-w-4xl animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Link href={cx?.ingreso ? `/salud/ingreso/${cx.ingreso}` : '/salud/censo'}>
          <Button variant="ghost" className="px-2"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <PageHeader
            title={dqx ? `${dqx.numero_formateado} — Descripción quirúrgica` : 'Nueva descripción quirúrgica'}
            description={cx ? `CX-${String(cx.numero_cx).padStart(5,'0')} · ${cx.descripcion_cups || cx.cups_principal}` : ''}
          />
        </div>
      </div>

      {esFirmada && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl mb-5">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <p className="text-sm text-emerald-700 font-medium">
            Firmado por {dqx?.cirujano_nombre} ({dqx?.cirujano_especialidad}) ·
            TP {dqx?.cirujano_tp} · {dqx?.firmada_en ? new Date(dqx.firmada_en).toLocaleString('es-CO') : ''}
          </p>
        </div>
      )}

      {!esFirmada && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl mb-5">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700">
            Borrador — Al firmar, el informe quedará inmutable (Res. 1995/1999).
            El sistema capturará automáticamente la tarjeta profesional y especialidad del cirujano.
          </p>
        </div>
      )}

      <div className={clsx('space-y-6', esFirmada && 'pointer-events-none opacity-75')}>
        {/* ── Diagnósticos ─────────────────────────────────────────────────── */}
        <Section title="Diagnósticos">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="CIE-10 Preoperatorio" value={String(form.diagnostico_preoperatorio)}
              onChange={v => f('diagnostico_preoperatorio', v)} placeholder="Ej: K35.8" />
            <Field label="Diagnóstico preoperatorio" value={String(form.desc_diag_preop)}
              onChange={v => f('desc_diag_preop', v)} />
            <Field label="CIE-10 Postoperatorio" value={String(form.diagnostico_postoperatorio)}
              onChange={v => f('diagnostico_postoperatorio', v)} placeholder="Ej: K35.8" />
            <Field label="Diagnóstico postoperatorio" value={String(form.desc_diag_postop)}
              onChange={v => f('desc_diag_postop', v)} />
          </div>
        </Section>

        {/* ── Procedimiento ─────────────────────────────────────────────────── */}
        <Section title="Procedimiento">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="CUPS principal *" value={String(form.cups_principal)}
              onChange={v => f('cups_principal', v)} />
            <Field label="Descripción del procedimiento" value={String(form.descripcion_procedimiento)}
              onChange={v => f('descripcion_procedimiento', v)} />
            <div>
              <label className="label-xs">Tipo de anestesia</label>
              <select value={String(form.tipo_anestesia)} onChange={e => f('tipo_anestesia', e.target.value)}
                className="input-base w-full">
                {['general','regional','local','sedacion','epidural','raquidea','mixta'].map(a =>
                  <option key={a} value={a} className="capitalize">{a.charAt(0).toUpperCase()+a.slice(1)}</option>)}
              </select>
            </div>
          </div>
        </Section>

        {/* ── Equipo quirúrgico ─────────────────────────────────────────────── */}
        <Section title="Equipo quirúrgico">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-xs">Cirujano principal *</label>
              <select value={String(form.cirujano)} onChange={e => f('cirujano', e.target.value)}
                className="input-base w-full">
                <option value="">— Seleccionar —</option>
                {medicos.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.nombre_completo}{m.especialidad ? ` (${m.especialidad})` : ''}
                    {m.tarjeta_profesional ? ` · TP ${m.tarjeta_profesional}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-xs">Anestesiólogo</label>
              <select value={String(form.anestesiologo)} onChange={e => f('anestesiologo', e.target.value)}
                className="input-base w-full">
                <option value="">— Seleccionar —</option>
                {medicos.map(m => <option key={m.id} value={m.id}>{m.nombre_completo}</option>)}
              </select>
            </div>
            <Field label="1er Ayudante" value={String(form.primer_ayudante)}
              onChange={v => f('primer_ayudante', v)} />
            <Field label="2do Ayudante" value={String(form.segundo_ayudante)}
              onChange={v => f('segundo_ayudante', v)} />
            <Field label="Instrumentadora" value={String(form.instrumentadora)}
              onChange={v => f('instrumentadora', v)} />
            <Field label="Enfermera circulante" value={String(form.enfermera_circulante)}
              onChange={v => f('enfermera_circulante', v)} />
          </div>
        </Section>

        {/* ── Tiempos ──────────────────────────────────────────────────────── */}
        <Section title="Tiempos quirúrgicos">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label-xs">Inicio *</label>
              <input type="datetime-local" value={String(form.fecha_hora_inicio)}
                onChange={e => f('fecha_hora_inicio', e.target.value)}
                className="input-base w-full" />
            </div>
            <div>
              <label className="label-xs">Fin</label>
              <input type="datetime-local" value={String(form.fecha_hora_fin)}
                onChange={e => f('fecha_hora_fin', e.target.value)}
                className="input-base w-full" />
            </div>
            <Field label="Quirófano" value={String(form.quirofano)}
              onChange={v => f('quirofano', v)} placeholder="Ej: Quirófano 1" />
          </div>
        </Section>

        {/* ── Descripción operatoria ────────────────────────────────────────── */}
        <Section title="Descripción operatoria">
          <TextareaField label="Descripción de la técnica quirúrgica *" rows={6}
            value={String(form.descripcion_tecnica)}
            onChange={v => f('descripcion_tecnica', v)}
            placeholder="Describir paso a paso la técnica quirúrgica utilizada..." />
          <TextareaField label="Hallazgos intraoperatorios" rows={3}
            value={String(form.hallazgos)} onChange={v => f('hallazgos', v)} />
          <TextareaField label="Especímenes enviados a patología" rows={2}
            value={String(form.especimenes)} onChange={v => f('especimenes', v)} />
          <TextareaField label="Implantes / prótesis / mallas utilizadas" rows={2}
            value={String(form.implantes)} onChange={v => f('implantes', v)} />
          <TextareaField label="Complicaciones" rows={2}
            value={String(form.complicaciones)} onChange={v => f('complicaciones', v)} />
        </Section>

        {/* ── Datos de sala ─────────────────────────────────────────────────── */}
        <Section title="Datos de sala">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Sangrado estimado (mL)" value={String(form.sangrado_estimado_ml)}
              onChange={v => f('sangrado_estimado_ml', v)} placeholder="Ej: 200" />
            <Field label="Líquidos administrados" value={String(form.liquidos_administrados)}
              onChange={v => f('liquidos_administrados', v)} placeholder="Ej: 1500 mL SSN 0.9%" />
          </div>
          <TextareaField label="Plan postoperatorio" rows={3}
            value={String(form.plan_postoperatorio)} onChange={v => f('plan_postoperatorio', v)} />
        </Section>
      </div>

      {/* Botones */}
      {!esFirmada && (
        <div className="flex gap-3 mt-8">
          <Button variant="secondary" onClick={() => guardar(false)} loading={saving} className="flex-1">
            Guardar borrador
          </Button>
          <Button onClick={() => guardar(true)} loading={saving} className="flex-1">
            <Lock className="w-4 h-4" />
            Guardar y firmar (DQX definitivo)
          </Button>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5">
      <h3 className="font-semibold text-slate-800 text-sm mb-4 pb-2 border-b border-slate-50">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="label-xs">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-base w-full" />
    </div>
  )
}

function TextareaField({ label, value, onChange, rows = 3, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string
}) {
  return (
    <div>
      <label className="label-xs">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)}
        rows={rows} placeholder={placeholder}
        className="input-base w-full resize-none" />
    </div>
  )
}
