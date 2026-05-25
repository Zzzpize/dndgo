'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import api from '@/lib/api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('Пароль не менее 8 символов'); return }
    if (password !== confirm) { setError('Пароли не совпадают'); return }
    setLoading(true)
    setError('')
    try {
      await api.post('/api/v1/auth/reset-password', { token, password })
      router.push('/login?reset=1')
    } catch (err) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
      if (code === 'ERR_INVALID_TOKEN') setError('Ссылка недействительна или истекла')
      else setError('Что-то пошло не так. Попробуйте позже.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="text-center flex flex-col gap-4">
        <p className="text-ember text-sm">Недействительная ссылка для сброса пароля.</p>
        <Link href="/forgot-password" className="text-gold hover:text-gold-light text-sm transition-colors">
          Запросить новую ссылку
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Новый пароль"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Не менее 8 символов"
        required
        autoFocus
      />
      <Input
        label="Повторите пароль"
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="••••••••"
        required
      />
      {error && (
        <p className="text-sm text-ember bg-ember/10 border border-ember/30 px-3 py-2">{error}</p>
      )}
      <Button type="submit" loading={loading} className="w-full mt-2">
        Сохранить пароль
      </Button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-md bg-dark-card border border-dark-border p-8">
        <h1 className="heading-fantasy text-3xl mb-2 text-center">Новый пароль</h1>
        <hr className="divider-gold mb-6" />
        <Suspense fallback={<p className="text-parchment/30 text-center animate-pulse">Загрузка...</p>}>
          <ResetPasswordForm />
        </Suspense>
        <p className="text-center text-xs text-parchment/40 mt-4">
          <Link href="/login" className="hover:text-parchment/70 transition-colors">
            ← Вернуться ко входу
          </Link>
        </p>
      </div>
    </main>
  )
}
