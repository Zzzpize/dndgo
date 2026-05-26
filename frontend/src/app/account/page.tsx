'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-dark-card border border-dark-border p-6 flex flex-col gap-4">
      <h2 className="heading-fantasy text-lg text-gold-light">{title}</h2>
      <hr className="border-dark-border" />
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-parchment/50 font-fantasy">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full bg-dark border border-dark-border rounded px-3 py-2 text-sm text-parchment placeholder-parchment/30 focus:outline-none focus:border-gold/40'
const btnCls = 'px-4 py-2 bg-gold/20 hover:bg-gold/30 border border-gold/30 text-gold-light text-sm font-fantasy rounded transition-colors disabled:opacity-40'
const errCls = 'text-xs text-ember'
const okCls = 'text-xs text-green-400'

export default function AccountPage() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const [uName, setUName] = useState('')
  const [uPass, setUPass] = useState('')
  const [uErr, setUErr] = useState('')
  const [uOk, setUOk] = useState('')
  const [uBusy, setUBusy] = useState(false)

  const [eEmail, setEEmail] = useState('')
  const [ePass, setEPass] = useState('')
  const [eCode, setECode] = useState('')
  const [eStep, setEStep] = useState<'form' | 'code'>('form')
  const [eErr, setEErr] = useState('')
  const [eOk, setEOk] = useState('')
  const [eBusy, setEBusy] = useState(false)

  const [pOld, setPOld] = useState('')
  const [pNew, setPNew] = useState('')
  const [pNew2, setPNew2] = useState('')
  const [pErr, setPErr] = useState('')
  const [pOk, setPOk] = useState('')
  const [pBusy, setPBusy] = useState(false)

  const handleUsername = async (e: React.FormEvent) => {
    e.preventDefault()
    setUErr(''); setUOk('')
    if (!uName.trim() || !uPass) { setUErr('Заполните все поля'); return }
    setUBusy(true)
    try {
      const { data } = await api.patch('/api/v1/auth/account/username', { username: uName.trim(), password: uPass })
      setUser(data.user, data.token)
      setUOk('Логин изменён')
      setUName(''); setUPass('')
    } catch (err) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
      setUErr(code === 'ERR_CONFLICT' ? 'Логин уже занят' : 'Неверный пароль')
    } finally {
      setUBusy(false)
    }
  }

  const handleEmailRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setEErr(''); setEOk('')
    if (!eEmail.trim() || !ePass) { setEErr('Заполните все поля'); return }
    setEBusy(true)
    try {
      await api.post('/api/v1/auth/account/email/request', { email: eEmail.trim(), password: ePass })
      setEStep('code')
      setEOk('Код отправлен на новую почту')
    } catch (err) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
      if (code === 'ERR_NO_EMAIL') setEErr('Email-сервис не настроен')
      else setEErr('Неверный пароль')
    } finally {
      setEBusy(false)
    }
  }

  const handleEmailConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    setEErr(''); setEOk('')
    if (!eCode.trim()) { setEErr('Введите код'); return }
    setEBusy(true)
    try {
      const { data } = await api.post('/api/v1/auth/account/email/confirm', { code: eCode.trim() })
      setUser(data.user, data.token)
      setEOk('Email изменён')
      setEEmail(''); setEPass(''); setECode(''); setEStep('form')
    } catch {
      setEErr('Неверный или просроченный код')
    } finally {
      setEBusy(false)
    }
  }

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPErr(''); setPOk('')
    if (!pOld || !pNew || !pNew2) { setPErr('Заполните все поля'); return }
    if (pNew.length < 8) { setPErr('Пароль не менее 8 символов'); return }
    if (pNew !== pNew2) { setPErr('Пароли не совпадают'); return }
    setPBusy(true)
    try {
      await api.patch('/api/v1/auth/account/password', { old_password: pOld, new_password: pNew })
      setPOk('Пароль изменён')
      setPOld(''); setPNew(''); setPNew2('')
    } catch {
      setPErr('Неверный текущий пароль')
    } finally {
      setPBusy(false)
    }
  }

  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="max-w-lg mx-auto flex flex-col gap-2 mb-8">
        <div className="flex items-center justify-between">
          <h1 className="heading-fantasy text-2xl">Настройки аккаунта</h1>
          <Link href="/rooms" className="text-xs text-parchment/40 hover:text-parchment/70 transition-colors">
            ← Назад
          </Link>
        </div>
        {user && (
          <p className="text-sm text-parchment/50">
            {user.username} · <span className="text-parchment/30">{user.email}</span>
          </p>
        )}
      </div>

      <div className="max-w-lg mx-auto flex flex-col gap-6">
        <Section title="Изменить логин">
          <form onSubmit={handleUsername} className="flex flex-col gap-3">
            <Field label="Новый логин">
              <input className={inputCls} value={uName} onChange={(e) => setUName(e.target.value)} placeholder="новый_логин" />
            </Field>
            <Field label="Текущий пароль">
              <input className={inputCls} type="password" value={uPass} onChange={(e) => setUPass(e.target.value)} placeholder="••••••••" />
            </Field>
            {uErr && <p className={errCls}>{uErr}</p>}
            {uOk && <p className={okCls}>{uOk}</p>}
            <button type="submit" disabled={uBusy} className={btnCls}>
              {uBusy ? 'Сохранение...' : 'Сохранить'}
            </button>
          </form>
        </Section>

        <Section title="Изменить email">
          {eStep === 'form' ? (
            <form onSubmit={handleEmailRequest} className="flex flex-col gap-3">
              <Field label="Новый email">
                <input className={inputCls} type="email" value={eEmail} onChange={(e) => setEEmail(e.target.value)} placeholder="новый@email.com" />
              </Field>
              <Field label="Текущий пароль">
                <input className={inputCls} type="password" value={ePass} onChange={(e) => setEPass(e.target.value)} placeholder="••••••••" />
              </Field>
              {eErr && <p className={errCls}>{eErr}</p>}
              {eOk && <p className={okCls}>{eOk}</p>}
              <button type="submit" disabled={eBusy} className={btnCls}>
                {eBusy ? 'Отправка...' : 'Отправить код'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleEmailConfirm} className="flex flex-col gap-3">
              <p className="text-sm text-parchment/60">Код отправлен на <span className="text-gold-light">{eEmail}</span></p>
              <Field label="Код подтверждения">
                <input className={inputCls} value={eCode} onChange={(e) => setECode(e.target.value)} placeholder="000000" maxLength={6} autoFocus />
              </Field>
              {eErr && <p className={errCls}>{eErr}</p>}
              {eOk && <p className={okCls}>{eOk}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={eBusy} className={btnCls}>
                  {eBusy ? 'Проверка...' : 'Подтвердить'}
                </button>
                <button type="button" onClick={() => { setEStep('form'); setEErr(''); setEOk('') }}
                  className="px-4 py-2 text-sm text-parchment/50 hover:text-parchment border border-dark-border rounded transition-colors">
                  Назад
                </button>
              </div>
            </form>
          )}
        </Section>

        <Section title="Изменить пароль">
          <form onSubmit={handlePassword} className="flex flex-col gap-3">
            <Field label="Текущий пароль">
              <input className={inputCls} type="password" value={pOld} onChange={(e) => setPOld(e.target.value)} placeholder="••••••••" />
            </Field>
            <Field label="Новый пароль">
              <input className={inputCls} type="password" value={pNew} onChange={(e) => setPNew(e.target.value)} placeholder="Не менее 8 символов" />
            </Field>
            <Field label="Повторите новый пароль">
              <input className={inputCls} type="password" value={pNew2} onChange={(e) => setPNew2(e.target.value)} placeholder="••••••••" />
            </Field>
            {pErr && <p className={errCls}>{pErr}</p>}
            {pOk && <p className={okCls}>{pOk}</p>}
            <button type="submit" disabled={pBusy} className={btnCls}>
              {pBusy ? 'Сохранение...' : 'Сменить пароль'}
            </button>
          </form>
        </Section>
      </div>
    </main>
  )
}
