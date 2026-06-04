'use client'
import { useState, useEffect, useCallback } from 'react'
import { pacientesAPI } from '@/lib/api'
import { Paciente, Paginated } from '@/types'
import toast from 'react-hot-toast'

export function usePacientes(searchQuery = '') {
  const [data, setData]       = useState<Paginated<Paciente> | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage]       = useState(1)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page }
      if (searchQuery.trim()) params.search = searchQuery.trim()
      const res = await pacientesAPI.list(params)
      setData(res.data)
    } catch {
      toast.error('Error cargando pacientes')
    } finally {
      setLoading(false)
    }
  }, [page, searchQuery])

  useEffect(() => { fetch() }, [fetch])

  // Resetear página cuando cambia la búsqueda
  useEffect(() => { setPage(1) }, [searchQuery])

  return { data, loading, page, setPage, refetch: fetch }
}

export function usePaciente(id: string) {
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    pacientesAPI.get(id)
      .then(r => setPaciente(r.data))
      .catch(() => toast.error('Paciente no encontrado'))
      .finally(() => setLoading(false))
  }, [id])

  return { paciente, loading }
}
