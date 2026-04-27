'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function RegisterPage() {
  const router = useRouter()
  const register = useAuthStore((s) => s.register)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (password.length < 6) { setError('Пароль не менее 6 символов'); return }
    setLoading(true)
    setError('')
    try {
      await register(email, username, password)
      router.push('/rooms')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-md bg-dark-card border border-dark-border p-8">
        <h1 className="heading-fantasy text-3xl mb-2 text-center">Регистрация</h1>
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
            label="Имя персонажа"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Гэндальф"
            required
          />
          <Input
            label="Пароль"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Не менее 6 символов"
            required
          />

          {error && (
            <p className="text-sm text-ember bg-ember/10 border border-ember/30 px-3 py-2">{error}</p>
          )}

          <Button type="submit" loading={loading} className="w-full mt-2">
            Начать приключение
          </Button>
        </form>

        <p className="text-center text-sm text-parchment/50 mt-6">
          Уже есть аккаунт?{' '}
          <Link href="/login" className="text-gold hover:text-gold-light transition-colors">
            Войти
          </Link>
        </p>
      </div>
    </main>
  )
}
