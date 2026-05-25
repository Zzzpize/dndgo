'use client'

import { useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.post('/api/v1/auth/forgot-password', { email })
      setSent(true)
    } catch {
      setError('Что-то пошло не так. Попробуйте позже.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-md bg-dark-card border border-dark-border p-8">
        <h1 className="heading-fantasy text-3xl mb-2 text-center">Сброс пароля</h1>
        <hr className="divider-gold mb-6" />

        {sent ? (
          <div className="flex flex-col gap-4 text-center">
            <p className="text-parchment/70 text-sm">
              Если аккаунт с таким email существует, ссылка для сброса пароля отправлена на <span className="text-gold-light">{email}</span>.
            </p>
            <p className="text-parchment/40 text-xs">Ссылка действительна 1 час.</p>
            <Link href="/login" className="text-gold hover:text-gold-light text-sm transition-colors">
              ← Вернуться ко входу
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email аккаунта"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="герой@подземелье.рф"
              required
              autoFocus
            />
            {error && (
              <p className="text-sm text-ember bg-ember/10 border border-ember/30 px-3 py-2">{error}</p>
            )}
            <Button type="submit" loading={loading} className="w-full mt-2">
              Отправить ссылку
            </Button>
            <p className="text-center text-xs text-parchment/40">
              <Link href="/login" className="hover:text-parchment/70 transition-colors">
                ← Вернуться ко входу
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  )
}
