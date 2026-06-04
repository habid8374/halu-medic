'use client'
import { useState, useEffect, useCallback } from 'react'
import { citasAPI } from '@/lib/api'
import { Cita, Paginated } from '@/types'
import toast from 'react-hot-toast'

export function useCitas(fecha?: string, medicoId?: string) {
  const [data, setData]       = useState<Paginated<Cita> | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (fecha)    params.fecha  = fecha
      if (medicoId) params.medico = medicoId
      const res = await citasAPI.list(params)
      setData(res.data)
    } catch {
      toast.error('Error cargando citas')
    } finally {
      setLoading(false)
    }
  }, [fecha, medicoId])

  useEffect(() => { fetch() }, [fetch])
  return { data, loading, refetch: fetch }
}

export function useCita(id: string) {
  const [cita, setCita]       = useState<Cita | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    citasAPI.get(id)
      .then(r => setCita(r.data))
      .catch(() => toast.error('Cita no encontrada'))
      .finally(() => setLoading(false))
  }, [id])

  return { cita, loading }
}
