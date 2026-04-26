import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'D&D VTT — Виртуальный стол',
  description: 'Виртуальный стол для игр D&D 5e',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" className="dark">
      <body className="bg-dark text-parchment font-body min-h-screen">
        {children}
      </body>
    </html>
  )
}
