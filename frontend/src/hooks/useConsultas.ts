'use client'
import { useState, useEffect, useCallback } from 'react'
import { consultasAPI } from '@/lib/api'
import { Consulta, Paginated } from '@/types'
import toast from 'react-hot-toast'

export function useConsultas(params?: Record<string, string>) {
  const [data, setData]       = useState<Paginated<Consulta> | null>(null)
  const [loading, setLoading] = useState(true)
  const key = JSON.stringify(params)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await consultasAPI.list(params)
      setData(res.data)
    } catch { toast.error('Error cargando consultas') }
    finally   { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => { fetch() }, [fetch])
  return { data, loading, refetch: fetch }
}

export function useConsulta(id: string) {
  const [consulta, setConsulta] = useState<Consulta | null>(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!id) return
    consultasAPI.get(id)
      .then(r => setConsulta(r.data))
      .catch(() => toast.error('Consulta no encontrada'))
      .finally(() => setLoading(false))
  }, [id])

  return { consulta, loading, setConsulta }
}
