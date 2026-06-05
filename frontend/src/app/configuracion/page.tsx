'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { consultorioAPI, mensajeError } from '@/lib/api'
import { PageHeader, Button, Input, Card } from '@/components/ui'
import toast from 'react-hot-toast'
import Link from 'next/link'
import {
  Building2, Shield, FileText,
  Save, Eye, EyeOff, CheckCircle, AlertCircle,
  Hash, Calendar, Tag, AlignLeft, Zap, DollarSign, ArrowRight, ShieldCheck,
} from 'lucide-react'
import { TarifariosTab } from '@/components/configuracion/TarifariosTab'

interface ConfigData {
  nombre: string
  razon_social: string
  nit: string
  codigo_prestador: string
  direccion: string
  municipio_codigo: string
  telefono: string
  email: string
  plan: string
  factus_base_url: string
  factus_client_id: string
  factus_username: string
  factus_rango_numeracion_id: number | null
  factus_configurado: boolean
  resolucion_dian: string
  resolucion_fecha: string
  factura_prefijo: string
  factura_rango_desde: number | null
  factura_rango_hasta: number | null
  factura_leyenda: string
}

const TABS = [
  { id: 'general',     label: 'Datos del consultorio', icon: Building2 },
  { id: 'factus',      label: 'Facturación electrónica', icon: Zap },
  { id: 'resolucion',  label: 'Resolución DIAN', icon: FileText },
  { id: 'tarifarios',  label: 'Tarifarios', icon: DollarSign },
]

export default function ConfiguracionPage() {
  const { usuario } = useAuth()
  const [tab, setTab] = useState('general')
  const [data, setData]       = useState<ConfigData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  // Campos secretos — nunca vienen del API, solo se envían al guardar
  const [clientSecret, setClientSecret] = useState('')
  const [factusPassword, setFactusPassword] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [showPass, setShowPass]     = useState(false)

  useEffect(() => {
    consultorioAPI.get()
      .then(({ data }) => setData(data))
      .catch(() => toast.error('No se pudo cargar la configuración'))
      .finally(() => setLoading(false))
  }, [])

  const set = (campo: keyof ConfigData, valor: unknown) =>
    setData(prev => prev ? { ...prev, [campo]: valor } : prev)

  const guardar = async () => {
    if (!data) return
    setSaving(true)
    try {
      const payload: Record<string, unknown> = { ...data }
      if (clientSecret) payload.factus_client_secret = clientSecret
      if (factusPassword) payload.factus_password = factusPassword
      delete payload.plan
      delete payload.factus_configurado
      await consultorioAPI.update(payload)
      toast.success('Configuración guardada correctamente')
      // Refrescar para ver factus_configurado actualizado
      const { data: nuevo } = await consultorioAPI.get()
      setData(nuevo)
      setClientSecret('')
      setFactusPassword('')
    } catch (err) {
      toast.error(mensajeError(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="p-8">
      <div className="animate-pulse space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-14 bg-slate-100 rounded-xl" />
        ))}
      </div>
    </div>
  )

  if (!data) return null

  const esAdmin = usuario?.permisos.es_admin || usuario?.permisos.es_superadmin

  return (
    <div className="p-8 animate-fade-in max-w-4xl">
      <PageHeader
        title="Configuración"
        description="Administra los datos de tu consultorio y facturación electrónica"
        action={
          esAdmin ? (
            <Button onClick={guardar} loading={saving}>
              <Save className="w-4 h-4" />
              Guardar cambios
            </Button>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-8 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Datos generales ─────────────────────────────────────────── */}
      {tab === 'general' && (
        <Card className="space-y-6">
          <div className="flex items-center gap-2 text-slate-700 font-semibold border-b border-slate-100 pb-4">
            <Building2 className="w-4 h-4 text-halu-600" />
            Información del consultorio
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Nombre del consultorio *" value={data.nombre}
              onChange={e => set('nombre', e.target.value)} disabled={!esAdmin} />
            <Input label="Razón social" value={data.razon_social}
              onChange={e => set('razon_social', e.target.value)} disabled={!esAdmin} />
            <Input label="NIT *" value={data.nit}
              onChange={e => set('nit', e.target.value)} disabled={!esAdmin} />
            <Input label="Código prestador (MinSalud)" value={data.codigo_prestador}
              onChange={e => set('codigo_prestador', e.target.value)} disabled={!esAdmin}
              placeholder="Ej: 0801234500" />
            <Input label="Teléfono" value={data.telefono}
              onChange={e => set('telefono', e.target.value)} disabled={!esAdmin} />
            <Input label="Correo electrónico" value={data.email} type="email"
              onChange={e => set('email', e.target.value)} disabled={!esAdmin} />
            <Input label="Dirección" value={data.direccion}
              onChange={e => set('direccion', e.target.value)} disabled={!esAdmin}
              className="md:col-span-2" />
          </div>

          <div className="flex items-center gap-3 bg-halu-50 border border-halu-100 rounded-xl p-4">
            <Shield className="w-5 h-5 text-halu-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-halu-800">Plan activo: <span className="capitalize font-bold">{data.plan}</span></p>
              <p className="text-xs text-halu-600 mt-0.5">Para cambiar de plan contacta a soporte en Halu Group</p>
            </div>
          </div>
        </Card>
      )}

      {/* ── Tab: Facturación electrónica (Factus) ────────────────────────── */}
      {tab === 'factus' && (
        <div className="space-y-4">
          {/* Estado Factus */}
          <div className={`flex items-center gap-3 p-4 rounded-xl border ${
            data.factus_configurado
              ? 'bg-emerald-50 border-emerald-100'
              : 'bg-amber-50 border-amber-100'
          }`}>
            {data.factus_configurado
              ? <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              : <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            }
            <div>
              <p className={`text-sm font-semibold ${data.factus_configurado ? 'text-emerald-800' : 'text-amber-800'}`}>
                {data.factus_configurado ? 'Factus configurado y listo' : 'Factus no configurado'}
              </p>
              <p className={`text-xs mt-0.5 ${data.factus_configurado ? 'text-emerald-600' : 'text-amber-600'}`}>
                {data.factus_configurado
                  ? 'Tu consultorio puede emitir facturas electrónicas ante la DIAN'
                  : 'Completa las credenciales de Factus para habilitar la facturación electrónica'
                }
              </p>
            </div>
          </div>

          <Card className="space-y-5">
            <div className="flex items-center gap-2 text-slate-700 font-semibold border-b border-slate-100 pb-4">
              <Zap className="w-4 h-4 text-halu-600" />
              Credenciales Factus
              <span className="text-xs font-normal text-slate-400 ml-auto">Obtenlas en developers.factus.com.co</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Input label="URL Factus" value={data.factus_base_url}
                  onChange={e => set('factus_base_url', e.target.value)} disabled={!esAdmin}
                  placeholder="https://api-sandbox.factus.com.co" />
                <p className="text-xs text-slate-400 mt-1 ml-1">
                  Sandbox: api-sandbox.factus.com.co · Producción: api.factus.com.co
                </p>
              </div>
              <Input label="Client ID" value={data.factus_client_id}
                onChange={e => set('factus_client_id', e.target.value)} disabled={!esAdmin}
                placeholder="Tu Client ID de Factus" />
              <div className="relative">
                <Input label="Client Secret" value={clientSecret}
                  onChange={e => setClientSecret(e.target.value)} disabled={!esAdmin}
                  type={showSecret ? 'text' : 'password'}
                  placeholder={data.factus_client_id ? '••••••••• (dejar vacío para no cambiar)' : 'Tu Client Secret'} />
                <button type="button" onClick={() => setShowSecret(s => !s)}
                  className="absolute right-3 top-9 text-slate-400 hover:text-slate-600">
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Input label="Usuario Factus (email)" value={data.factus_username}
                onChange={e => set('factus_username', e.target.value)} disabled={!esAdmin}
                placeholder="correo@consultorio.com" />
              <div className="relative">
                <Input label="Contraseña Factus" value={factusPassword}
                  onChange={e => setFactusPassword(e.target.value)} disabled={!esAdmin}
                  type={showPass ? 'text' : 'password'}
                  placeholder={data.factus_username ? '••••••••• (dejar vacío para no cambiar)' : 'Contraseña de Factus'} />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-9 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Input label="ID Rango de numeración" type="number"
                value={data.factus_rango_numeracion_id ?? ''}
                onChange={e => set('factus_rango_numeracion_id', e.target.value ? parseInt(e.target.value) : null)}
                disabled={!esAdmin}
                placeholder="ID del rango en Factus (número entero)" />
            </div>

            <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-500 space-y-1">
              <p className="font-medium text-slate-600">¿Cómo obtener las credenciales?</p>
              <p>1. Ingresa a <strong>developers.factus.com.co</strong> con tu cuenta</p>
              <p>2. Ve a <strong>Configuración → Aplicaciones OAuth2</strong></p>
              <p>3. Crea una aplicación y copia el Client ID y Client Secret</p>
              <p>4. El ID del rango lo encuentras en <strong>Rangos de numeración</strong></p>
            </div>
          </Card>
        </div>
      )}

      {/* ── Tab: Resolución DIAN ──────────────────────────────────────────── */}
      {tab === 'resolucion' && (
        <Card className="space-y-6">
          <div className="flex items-center gap-2 text-slate-700 font-semibold border-b border-slate-100 pb-4">
            <FileText className="w-4 h-4 text-halu-600" />
            Resolución de facturación electrónica
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
            <p className="font-medium mb-1">¿Dónde encuentro estos datos?</p>
            <p className="text-xs">En la resolución que emitió la DIAN habilitándote para facturar electrónicamente.
              Esta información aparece en el PDF de tu resolución y en el portal de Factus bajo
              <strong> Rangos de numeración</strong>.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Input label="Número de resolución DIAN" value={data.resolucion_dian}
                onChange={e => set('resolucion_dian', e.target.value)} disabled={!esAdmin}
                placeholder="Ej: 18764003912345" />
              <Hash className="absolute right-3 top-9 w-4 h-4 text-slate-300" />
            </div>
            <div className="relative">
              <Input label="Fecha de la resolución" type="date" value={data.resolucion_fecha}
                onChange={e => set('resolucion_fecha', e.target.value)} disabled={!esAdmin} />
              <Calendar className="absolute right-3 top-9 w-4 h-4 text-slate-300 pointer-events-none" />
            </div>
            <div className="relative">
              <Input label="Prefijo de la factura" value={data.factura_prefijo}
                onChange={e => set('factura_prefijo', e.target.value)} disabled={!esAdmin}
                placeholder="Ej: SETP, FE, FAC" />
              <Tag className="absolute right-3 top-9 w-4 h-4 text-slate-300" />
            </div>
            <div />
            <Input label="Rango desde (número inicial)" type="number"
              value={data.factura_rango_desde ?? ''}
              onChange={e => set('factura_rango_desde', e.target.value ? parseInt(e.target.value) : null)}
              disabled={!esAdmin} placeholder="Ej: 1" />
            <Input label="Rango hasta (número final)" type="number"
              value={data.factura_rango_hasta ?? ''}
              onChange={e => set('factura_rango_hasta', e.target.value ? parseInt(e.target.value) : null)}
              disabled={!esAdmin} placeholder="Ej: 5000" />
          </div>

          {/* Leyenda de la representación gráfica */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
              <AlignLeft className="w-4 h-4 text-slate-400" />
              Leyenda de la representación gráfica (PDF)
            </label>
            <textarea
              value={data.factura_leyenda}
              onChange={e => set('factura_leyenda', e.target.value)}
              disabled={!esAdmin}
              rows={4}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800
                         focus:outline-none focus:ring-2 focus:ring-halu-500 focus:border-transparent
                         disabled:bg-slate-50 disabled:text-slate-400 resize-none"
              placeholder="Ej: Factura electrónica de venta — Resolución DIAN 18764003912345 del 2026-01-15.
Vigente del 1 al 5000. Este documento no genera obligaciones tributarias adicionales."
            />
            <p className="text-xs text-slate-400 ml-1">
              Este texto aparece en el pie de página del PDF de cada factura que se genera.
            </p>
          </div>

          {/* Preview de cómo quedará el número de factura */}
          {(data.factura_prefijo || data.factura_rango_desde) && (
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-2 font-medium">Vista previa del número de factura:</p>
              <p className="text-2xl font-bold text-slate-800 font-mono tracking-wide">
                {data.factura_prefijo || 'FE'}
                {String(data.factura_rango_desde || 1).padStart(9, '0')}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Rango: {data.factura_prefijo}{data.factura_rango_desde || '?'} – {data.factura_prefijo}{data.factura_rango_hasta || '?'}
              </p>
            </div>
          )}
        </Card>
      )}

      {/* ── Tab: Tarifarios ───────────────────────────────────────────────── */}
      {tab === 'tarifarios' && (
        <TarifariosTab />
      )}

      {/* ── Cards de navegación ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
      <Link href="/configuracion/aseguradoras" className="block">
        <div className="flex items-center gap-4 bg-white border border-slate-200 rounded-2xl p-5 hover:border-halu-300 hover:shadow-sm transition-all group h-full">
          <div className="w-10 h-10 bg-halu-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-halu-100 transition-colors">
            <ShieldCheck className="w-5 h-5 text-halu-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 text-sm">Aseguradoras</p>
            <p className="text-xs text-slate-500 mt-0.5">
              EPS, prepagadas, ARL y SOAT. Asigna tarifario y porcentaje de facturación.
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-halu-500 transition-colors flex-shrink-0" />
        </div>
      </Link>
      <Link href="/configuracion/convenios" className="block">
        <div className="flex items-center gap-4 bg-white border border-slate-200 rounded-2xl p-5 hover:border-halu-300 hover:shadow-sm transition-all group">
          <div className="w-10 h-10 bg-halu-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-halu-100 transition-colors">
            <FileText className="w-5 h-5 text-halu-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 text-sm">Convenios EPS</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Gestiona contratos, vigencias, CUCON y tarifas por aseguradora
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-halu-500 transition-colors flex-shrink-0" />
        </div>
      </Link>
      </div>

      {/* Botón guardar fijo en mobile */}
      {esAdmin && tab !== 'tarifarios' && (
        <div className="mt-8 flex justify-end">
          <Button onClick={guardar} loading={saving} className="w-full sm:w-auto">
            <Save className="w-4 h-4" />
            Guardar cambios
          </Button>
        </div>
      )}
    </div>
  )
}
