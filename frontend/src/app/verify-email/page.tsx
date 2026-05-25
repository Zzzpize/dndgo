'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import api from '@/lib/api'

function VerifyEmailForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''

  const verifyEmail = useAuthStore((s) => s.verifyEmail)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState('')

  useEffect(() => {
    if (!email) router.replace('/register')
  }, [email, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) { setError('Код должен состоять из 6 цифр'); return }
    setLoading(true)
    setError('')
    try {
      await verifyEmail(email, code)
      router.push('/rooms')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Неверный или истёкший код')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResendLoading(true)
    setResendMessage('')
    setError('')
    try {
      await api.post('/api/v1/auth/resend-verification', { email })
      setResendMessage('Новый код отправлен на почту')
    } catch {
      setError('Не удалось отправить код')
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-md bg-dark-card border border-dark-border p-8">
        <h1 className="heading-fantasy text-3xl mb-2 text-center">Подтверждение</h1>
        <hr className="divider-gold mb-6" />

        <p className="text-parchment/60 text-sm text-center mb-6">
          Код подтверждения отправлен на{' '}
          <span className="text-parchment">{email}</span>
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Код из письма"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            autoFocus
          />

          {error && (
            <p className="text-sm text-ember bg-ember/10 border border-ember/30 px-3 py-2">{error}</p>
          )}
          {resendMessage && (
            <p className="text-sm text-green-400 bg-green-900/20 border border-green-900/40 px-3 py-2">{resendMessage}</p>
          )}

          <Button type="submit" loading={loading} className="w-full mt-2">
            Подтвердить
          </Button>
        </form>

        <button
          onClick={handleResend}
          disabled={resendLoading}
          className="w-full mt-4 text-sm text-parchment/40 hover:text-parchment/70 transition-colors disabled:opacity-40"
        >
          {resendLoading ? 'Отправка...' : 'Отправить код повторно'}
        </button>
      </div>
    </main>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailForm />
    </Suspense>
  )
}
