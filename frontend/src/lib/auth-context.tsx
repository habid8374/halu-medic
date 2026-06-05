'use client'
/**
 * Contexto de autenticación global.
 * Provee: usuario actual, login, logout, isLoading.
 * Maneja: persistencia en localStorage, renovación automática.
 */
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { authAPI, mensajeError } from '@/lib/api'
import type { Usuario } from '@/types'

interface AuthContextType {
  usuario: Usuario | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Carga el usuario desde /api/auth/me/ al iniciar
  const cargarUsuario = useCallback(async () => {
    const token = localStorage.getItem('access_token')
    if (!token) { setIsLoading(false); return }
    try {
      const { data } = await authAPI.me()
      setUsuario(data)
    } catch {
      localStorage.clear()
      setUsuario(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { cargarUsuario() }, [cargarUsuario])

  const login = async (username: string, password: string) => {
    const { data } = await authAPI.login(username, password)
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)
    setUsuario(data.usuario)
  }

  const logout = async () => {
    try {
      const refresh = localStorage.getItem('refresh_token') || ''
      await authAPI.logout(refresh)
    } catch { /* token ya inválido */ }
    localStorage.clear()
    setUsuario(null)
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ usuario, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
