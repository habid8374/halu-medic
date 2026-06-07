'use client'
import { useState } from 'react'
import { consentimientosAPI, mensajeError } from '@/lib/api'
import SignaturePad from './SignaturePad'
import toast from 'react-hot-toast'

interface FirmarModalProps {
  consentimientoId: string
  pacienteNombre: string
  onClose: () => void
  onFirmado: () => void
}

export default function FirmarModal({ consentimientoId, pacienteNombre, onClose, onFirmado }: FirmarModalProps) {
  const [tab, setTab] = useState<'paciente' | 'acompanante'>('paciente')
  const [nombreFirmante, setNombreFirmante] = useState('')
  const [firmaImagen, setFirmaImagen] = useState('')
  const [nombreAcompanante, setNombreAcompanante] = useState('')
  const [parentescoAcompanante, setParentescoAcompanante] = useState('')
  const [firmaAcompananteImagen, setFirmaAcompananteImagen] = useState('')
  const [saving, setSaving] = useState(false)

  const INPUT = "w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/20"

  const handleFirmar = async () => {
    if (!firmaImagen) {
      toast.error('Debe guardar la firma del paciente')
      return
    }
    if (!nombreFirmante.trim()) {
      toast.error('Ingrese el nombre del firmante')
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        nombre_firmante: nombreFirmante.trim(),
        firma_imagen: firmaImagen,
      }
      if (nombreAcompanante.trim()) {
        payload.nombre_acompanante = nombreAcompanante.trim()
        payload.parentesco_acompanante = parentescoAcompanante.trim()
        if (firmaAcompananteImagen) {
          payload.firma_acompanante_imagen = firmaAcompananteImagen
        }
      }
      await consentimientosAPI.firmar(consentimientoId, payload)
      toast.success('Consentimiento firmado')
      onFirmado()
    } catch (e) {
      toast.error(mensajeError(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b">
          <h2 className="font-bold text-slate-900">Firmar consentimiento</h2>
          <p className="text-xs text-slate-500 mt-0.5">Paciente: {pacienteNombre}</p>
        </div>

        <div className="p-5 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setTab('paciente')}
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
                tab === 'paciente' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Paciente firma
            </button>
            <button
              type="button"
              onClick={() => setTab('acompanante')}
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
                tab === 'acompanante' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Acompañante firma
            </button>
          </div>

          {tab === 'paciente' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Nombre completo del firmante *</label>
                <input
                  value={nombreFirmante}
                  onChange={e => setNombreFirmante(e.target.value)}
                  className={INPUT}
                  placeholder="Nombre como aparece en el documento de identidad"
                />
              </div>
              <SignaturePad
                label="Firma del paciente *"
                onSave={dataUrl => setFirmaImagen(dataUrl)}
                onClear={() => setFirmaImagen('')}
              />
            </div>
          )}

          {tab === 'acompanante' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
                Opcional — complete si el consentimiento lo firma un representante legal o acompañante.
              </p>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Nombre del acompañante</label>
                <input
                  value={nombreAcompanante}
                  onChange={e => setNombreAcompanante(e.target.value)}
                  className={INPUT}
                  placeholder="Nombre completo"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Parentesco o relación</label>
                <input
                  value={parentescoAcompanante}
                  onChange={e => setParentescoAcompanante(e.target.value)}
                  className={INPUT}
                  placeholder="ej. Cónyuge, padre, representante legal..."
                />
              </div>
              <SignaturePad
                label="Firma del acompañante"
                onSave={dataUrl => setFirmaAcompananteImagen(dataUrl)}
                onClear={() => setFirmaAcompananteImagen('')}
              />
            </div>
          )}
        </div>

        <div className="p-5 border-t flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleFirmar}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2"
          >
            {saving && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Firmar consentimiento
          </button>
        </div>
      </div>
    </div>
  )
}
