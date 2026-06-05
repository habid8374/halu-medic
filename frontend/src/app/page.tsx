'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function HomePage() {
  const { usuario, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    router.replace(usuario ? '/dashboard' : '/login')
  }, [usuario, isLoading, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-4 border-halu-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
