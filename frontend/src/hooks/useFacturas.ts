'use client'
import { useState, useEffect, useCallback } from 'react'
import { facturasAPI } from '@/lib/api'
import { Factura, Paginated } from '@/types'
import toast from 'react-hot-toast'

export function useFacturas(params?: Record<string, string>) {
  const [data, setData]       = useState<Paginated<Factura> | null>(null)
  const [loading, setLoading] = useState(true)
  const key = JSON.stringify(params)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await facturasAPI.list(params)
      setData(res.data)
    } catch {
      toast.error('Error cargando facturas')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => { fetch() }, [fetch])
  return { data, loading, refetch: fetch }
}

export function useFactura(id: string) {
  const [factura, setFactura] = useState<Factura | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    facturasAPI.get(id)
      .then(r => setFactura(r.data))
      .catch(() => toast.error('Factura no encontrada'))
      .finally(() => setLoading(false))
  }, [id])

  return { factura, loading, setFactura }
}
