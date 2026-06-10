import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Quirófanos · HaluMedic' }
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
