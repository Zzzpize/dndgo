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
  const [loginInput, setLoginInput] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [unverifiedEmail, setUnverifiedEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(loginInput, password)
      router.push('/rooms')
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
      if (code === 'ERR_EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(loginInput)
        setError('Email не подтверждён')
      } else {
        setUnverifiedEmail('')
        setError('Неверный логин или пароль')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-md bg-dark-card border border-dark-border p-8">
        <h1 className="heading-fantasy text-3xl mb-2 text-center">Вход</h1>
        <hr className="divider-gold mb-6" />

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email или логин"
            type="text"
            value={loginInput}
            onChange={(e) => setLoginInput(e.target.value)}
            placeholder="герой@подземелье.рф или username"
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
            <div className="text-sm text-ember bg-ember/10 border border-ember/30 px-3 py-2">
              <p>{error}</p>
              {unverifiedEmail && (
                <Link
                  href={`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`}
                  className="underline hover:text-ember/80 mt-1 inline-block"
                >
                  Подтвердить email →
                </Link>
              )}
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full mt-2">
            Войти
          </Button>

          <p className="text-center text-xs text-parchment/40">
            <Link href="/forgot-password" className="hover:text-parchment/70 transition-colors">
              Забыли пароль?
            </Link>
          </p>
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
