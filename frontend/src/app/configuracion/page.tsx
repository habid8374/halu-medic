'use client'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { consultorioAPI, mensajeError } from '@/lib/api'
import { PageHeader, Button, Input, Card } from '@/components/ui'
import toast from 'react-hot-toast'
import Link from 'next/link'
import {
  Building2, Shield, FileText,
  Save, Eye, EyeOff, CheckCircle, AlertCircle,
  Hash, Calendar, Tag, AlignLeft, Zap, DollarSign, ShieldCheck,
  MapPin, Upload, ImageIcon, Globe, Phone, Mail,
  Stethoscope, User,
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
  firma_factura_nombre: string
  firma_factura_cargo: string
  regimen_tributario: string
  // IPS fields
  regimen: string
  nivel_atencion: string
  representante_legal: string
  departamento: string
  sitio_web: string
  logo_url: string
}

const TABS = [
  { id: 'general',      label: 'Consultorio',   icon: Building2,    link: null },
  { id: 'ips',          label: 'Datos IPS',      icon: Stethoscope,  link: null },
  { id: 'contacto',     label: 'Contacto',       icon: MapPin,       link: null },
  { id: 'facturacion',  label: 'Facturación',    icon: Zap,          link: null },
  { id: 'resolucion',   label: 'Resolución',     icon: FileText,     link: null },
  { id: 'logo',         label: 'Logo',           icon: ImageIcon,    link: null },
  { id: 'tarifarios',   label: 'Tarifarios',     icon: DollarSign,   link: null },
  { id: 'aseguradoras', label: 'Aseguradoras',   icon: ShieldCheck,  link: '/configuracion/aseguradoras' },
  { id: 'convenios',    label: 'Convenios EPS',  icon: FileText,     link: '/configuracion/convenios' },
]

const DEPARTAMENTOS_COLOMBIA = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bolívar', 'Boyacá',
  'Caldas', 'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó',
  'Córdoba', 'Cundinamarca', 'Guainía', 'Guaviare', 'Huila',
  'La Guajira', 'Magdalena', 'Meta', 'Nariño', 'Norte de Santander',
  'Putumayo', 'Quindío', 'Risaralda', 'San Andrés y Providencia',
  'Santander', 'Sucre', 'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada',
  'Bogotá D.C.',
]

const INPUT_CLASS = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/20 bg-white disabled:bg-slate-50 disabled:text-slate-400'
const LABEL_CLASS = 'block text-xs font-medium text-slate-600 mb-1'
const SECTION_HEADER = 'text-sm font-semibold text-slate-700 mb-3'

export default function ConfiguracionPage() {
  const { usuario } = useAuth()
  const [tab, setTab] = useState('general')
  const [data, setData]       = useState<ConfigData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

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

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error('El logo no debe superar 2 MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => set('logo_url', reader.result as string)
    reader.readAsDataURL(file)
  }

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
    <div className="animate-fade-in max-w-4xl">
      {/* Header mobile-friendly */}
      <div className="flex items-center justify-between px-4 pt-16 pb-4 lg:px-8 lg:pt-8">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900">Configuración</h1>
          <p className="text-slate-500 text-xs lg:text-sm mt-0.5 hidden sm:block">
            Administra los datos de tu consultorio y facturación electrónica
          </p>
        </div>
        {esAdmin && tab !== 'tarifarios' && (
          <Button onClick={guardar} loading={saving} className="text-sm px-4 py-2">
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">Guardar cambios</span>
            <span className="sm:hidden">Guardar</span>
          </Button>
        )}
      </div>

      {/* Tabs — scroll horizontal en móvil, incluye links a sub-páginas */}
      <div className="px-4 lg:px-8 mb-4">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto scrollbar-none">
          {TABS.map(t => t.link ? (
            <Link key={t.id} href={t.link}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs lg:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 text-slate-500 hover:text-slate-700 hover:bg-white/60"
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </Link>
          ) : (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs lg:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                tab === t.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 lg:px-8 pb-8">

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

      {/* ── Tab: Datos IPS ────────────────────────────────────────────────── */}
      {tab === 'ips' && (
        <Card className="space-y-6">
          <div className="flex items-center gap-2 text-slate-700 font-semibold border-b border-slate-100 pb-4">
            <Stethoscope className="w-4 h-4 text-halu-600" />
            Datos de la IPS
          </div>

          {/* Identificación */}
          <div>
            <p className={SECTION_HEADER}>Identificación y habilitación</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLASS}>Código de habilitación REPS</label>
                <input
                  className={INPUT_CLASS}
                  value={data.codigo_prestador}
                  onChange={e => set('codigo_prestador', e.target.value)}
                  disabled={!esAdmin}
                  placeholder="Ej: 0801234500"
                />
                <p className="text-xs text-slate-400 mt-1 ml-1">Código asignado por el Ministerio de Salud (REPS)</p>
              </div>
              <div>
                <label className={LABEL_CLASS}>NIT con dígito de verificación</label>
                <input
                  className={INPUT_CLASS}
                  value={data.nit}
                  onChange={e => set('nit', e.target.value)}
                  disabled={!esAdmin}
                  placeholder="Ej: 900123456-7"
                />
              </div>
            </div>
          </div>

          {/* Clasificación */}
          <div>
            <p className={SECTION_HEADER}>Clasificación</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLASS}>Régimen</label>
                <select
                  className={INPUT_CLASS}
                  value={data.regimen}
                  onChange={e => set('regimen', e.target.value)}
                  disabled={!esAdmin}
                >
                  <option value="">Seleccionar régimen...</option>
                  <option value="contributivo">Contributivo</option>
                  <option value="subsidiado">Subsidiado</option>
                  <option value="mixto">Mixto</option>
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Nivel de atención</label>
                <select
                  className={INPUT_CLASS}
                  value={data.nivel_atencion}
                  onChange={e => set('nivel_atencion', e.target.value)}
                  disabled={!esAdmin}
                >
                  <option value="">Seleccionar nivel...</option>
                  <option value="1">Nivel I</option>
                  <option value="2">Nivel II</option>
                  <option value="3">Nivel III</option>
                  <option value="4">Nivel IV</option>
                </select>
              </div>
            </div>
          </div>

          {/* Representación legal */}
          <div>
            <p className={SECTION_HEADER}>Representación legal</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className={LABEL_CLASS}>Nombre del representante legal</label>
                <input
                  className={INPUT_CLASS}
                  value={data.representante_legal}
                  onChange={e => set('representante_legal', e.target.value)}
                  disabled={!esAdmin}
                  placeholder="Nombre completo del representante legal"
                />
              </div>
            </div>
          </div>

          {/* Info card */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
            <p className="font-medium mb-1">¿Qué es el código de habilitación REPS?</p>
            <p className="text-xs">Es el código asignado por el Ministerio de Salud al inscribirte en el
              Registro Especial de Prestadores de Servicios de Salud. Lo puedes consultar en
              <strong> reps.sispro.gov.co</strong>.</p>
          </div>
        </Card>
      )}

      {/* ── Tab: Contacto y ubicación ─────────────────────────────────────── */}
      {tab === 'contacto' && (
        <Card className="space-y-6">
          <div className="flex items-center gap-2 text-slate-700 font-semibold border-b border-slate-100 pb-4">
            <MapPin className="w-4 h-4 text-halu-600" />
            Contacto y ubicación
          </div>

          {/* Dirección */}
          <div>
            <p className={SECTION_HEADER}>Ubicación</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className={LABEL_CLASS}>Dirección</label>
                <input
                  className={INPUT_CLASS}
                  value={data.direccion}
                  onChange={e => set('direccion', e.target.value)}
                  disabled={!esAdmin}
                  placeholder="Calle, carrera, número, barrio"
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Municipio / Ciudad</label>
                <input
                  className={INPUT_CLASS}
                  value={data.municipio_codigo}
                  onChange={e => set('municipio_codigo', e.target.value)}
                  disabled={!esAdmin}
                  placeholder="Ej: Barranquilla (08001)"
                />
                <p className="text-xs text-slate-400 mt-1 ml-1">Código DANE o nombre del municipio</p>
              </div>
              <div>
                <label className={LABEL_CLASS}>Departamento</label>
                <select
                  className={INPUT_CLASS}
                  value={data.departamento}
                  onChange={e => set('departamento', e.target.value)}
                  disabled={!esAdmin}
                >
                  <option value="">Seleccionar departamento...</option>
                  {DEPARTAMENTOS_COLOMBIA.map(dep => (
                    <option key={dep} value={dep}>{dep}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Contacto */}
          <div>
            <p className={SECTION_HEADER}>Información de contacto</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLASS}>
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> Teléfono</span>
                </label>
                <input
                  className={INPUT_CLASS}
                  value={data.telefono}
                  onChange={e => set('telefono', e.target.value)}
                  disabled={!esAdmin}
                  placeholder="+57 300 000 0000"
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>
                  <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> Correo institucional</span>
                </label>
                <input
                  className={INPUT_CLASS}
                  type="email"
                  value={data.email}
                  onChange={e => set('email', e.target.value)}
                  disabled={!esAdmin}
                  placeholder="info@miips.com.co"
                />
              </div>
              <div className="md:col-span-2">
                <label className={LABEL_CLASS}>
                  <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> Sitio web (opcional)</span>
                </label>
                <input
                  className={INPUT_CLASS}
                  value={data.sitio_web}
                  onChange={e => set('sitio_web', e.target.value)}
                  disabled={!esAdmin}
                  placeholder="https://www.miips.com.co"
                />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── Tab: Facturación electrónica (Factus) ────────────────────────── */}
      {tab === 'facturacion' && (
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

          {/* Firma y régimen tributario */}
          <Card className="space-y-5">
            <div className="flex items-center gap-2 text-slate-700 font-semibold border-b border-slate-100 pb-4">
              <User className="w-4 h-4 text-halu-600" />
              Firma y régimen tributario
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Nombre quien firma facturas" value={data.firma_factura_nombre}
                onChange={e => set('firma_factura_nombre', e.target.value)} disabled={!esAdmin}
                placeholder="Nombre completo" />
              <Input label="Cargo del firmante" value={data.firma_factura_cargo}
                onChange={e => set('firma_factura_cargo', e.target.value)} disabled={!esAdmin}
                placeholder="Ej: Gerente, Director médico" />
              <div>
                <label className={LABEL_CLASS}>Régimen tributario</label>
                <select
                  className={INPUT_CLASS}
                  value={data.regimen_tributario}
                  onChange={e => set('regimen_tributario', e.target.value)}
                  disabled={!esAdmin}
                >
                  <option value="">Seleccionar régimen...</option>
                  <option value="simplificado">Régimen Simplificado</option>
                  <option value="comun">Régimen Común</option>
                </select>
              </div>
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

      {/* ── Tab: Logo ─────────────────────────────────────────────────────── */}
      {tab === 'logo' && (
        <Card className="space-y-6">
          <div className="flex items-center gap-2 text-slate-700 font-semibold border-b border-slate-100 pb-4">
            <ImageIcon className="w-4 h-4 text-halu-600" />
            Logo de la IPS
          </div>

          {/* Preview */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-48 h-48 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
              {data.logo_url ? (
                <img
                  src={data.logo_url}
                  alt="Logo IPS"
                  className="w-full h-full object-contain p-3"
                />
              ) : (
                <div className="text-center text-slate-400">
                  <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">Sin logo</p>
                </div>
              )}
            </div>

            {esAdmin && (
              <div className="flex flex-col items-center gap-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={handleLogoChange}
                />
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Subir imagen
                </button>
                {data.logo_url && (
                  <button
                    onClick={() => set('logo_url', '')}
                    className="text-xs text-red-500 hover:text-red-700 transition-colors"
                  >
                    Eliminar logo
                  </button>
                )}
              </div>
            )}
          </div>

          {/* También se puede pegar una URL */}
          <div>
            <label className={LABEL_CLASS}>URL del logo (alternativa)</label>
            <input
              className={INPUT_CLASS}
              value={data.logo_url.startsWith('data:') ? '' : data.logo_url}
              onChange={e => set('logo_url', e.target.value)}
              disabled={!esAdmin}
              placeholder="https://ejemplo.com/logo.png"
            />
            <p className="text-xs text-slate-400 mt-1 ml-1">
              Si prefieres usar una URL en lugar de subir el archivo directamente.
            </p>
          </div>

          {/* Instrucciones */}
          <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-500 space-y-1.5">
            <p className="font-medium text-slate-600">Recomendaciones para el logo</p>
            <p>• Formato: PNG, JPEG, SVG o WebP</p>
            <p>• Tamaño máximo: 2 MB</p>
            <p>• Dimensiones recomendadas: 400 × 400 px o superior</p>
            <p>• Fondo transparente (PNG/SVG) para mejor resultado en documentos</p>
            <p>• El logo aparecerá en facturas, reportes e impresiones</p>
          </div>
        </Card>
      )}

      {/* ── Tab: Tarifarios ───────────────────────────────────────────────── */}
      {tab === 'tarifarios' && (
        <TarifariosTab />
      )}
      </div>{/* end px wrapper */}
    </div>
  )
}
