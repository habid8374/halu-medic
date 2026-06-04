import { TipoDoc, Regimen } from '@/types'

export const TIPOS_DOC: { value: TipoDoc; label: string }[] = [
  { value: 'CC',  label: 'Cédula de ciudadanía' },
  { value: 'CE',  label: 'Cédula de extranjería' },
  { value: 'TI',  label: 'Tarjeta de identidad' },
  { value: 'RC',  label: 'Registro civil' },
  { value: 'PA',  label: 'Pasaporte' },
  { value: 'MS',  label: 'Menor sin identificación' },
  { value: 'AS',  label: 'Adulto sin identificación' },
  { value: 'NIT', label: 'NIT' },
]

export const REGIMENES: { value: Regimen; label: string; color: string }[] = [
  { value: 'C', label: 'Contributivo',  color: 'info' },
  { value: 'S', label: 'Subsidiado',    color: 'success' },
  { value: 'V', label: 'Vinculado',     color: 'warning' },
  { value: 'P', label: 'Particular',    color: 'default' },
  { value: 'A', label: 'ARL',           color: 'purple' },
  { value: 'T', label: 'SOAT',          color: 'warning' },
  { value: 'O', label: 'Otro',          color: 'default' },
]

export const SEXOS = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
  { value: 'I', label: 'Indeterminado' },
]

export function regimenInfo(regimen: Regimen) {
  return REGIMENES.find(r => r.value === regimen) ?? REGIMENES[3]
}

export function tipoDocLabel(tipo: TipoDoc) {
  return TIPOS_DOC.find(t => t.value === tipo)?.label ?? tipo
}

export function formatFecha(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

export function calcularEdad(fechaNacimiento: string): number {
  const hoy = new Date()
  const nac = new Date(fechaNacimiento)
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}

export function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()
}
