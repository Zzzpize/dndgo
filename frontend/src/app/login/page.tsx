'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function LoginPage() {
  const router = useRouter()
  const login = useAuthStore((s) => s.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      await login(email, password)
      router.push('/rooms')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Неверный email или пароль')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-md bg-dark-card border border-dark-border p-8">
        <h1 className="heading-fantasy text-3xl mb-2 text-center">Вход</h1>
        <hr className="divider-gold mb-6" />

        <form action={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="герой@подземелье.рф"
            required
            autoFocus
          />
          <Input
            label="Пароль"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          {error && (
            <p className="text-sm text-ember bg-ember/10 border border-ember/30 px-3 py-2">{error}</p>
          )}

          <Button type="submit" loading={loading} className="w-full mt-2">
            Войти
          </Button>
        </form>

        <p className="text-center text-sm text-parchment/50 mt-6">
          Нет аккаунта?{' '}
          <Link href="/register" className="text-gold hover:text-gold-light transition-colors">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </main>
  )
}
