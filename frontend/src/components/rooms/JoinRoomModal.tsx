'use client'

import { useState, useRef, KeyboardEvent, ClipboardEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import api from '@/lib/api'
import { Room } from './RoomCard'

const CODE_LEN = 6

interface JoinRoomModalProps {
  open: boolean
  onClose: () => void
  onJoined: (room: Room) => void
}

export function JoinRoomModal({ open, onClose, onJoined }: JoinRoomModalProps) {
  const [chars, setChars] = useState<string[]>(Array(CODE_LEN).fill(''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const code = chars.join('')

  const handleChange = (i: number, value: string) => {
    const ch = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-1)
    const next = [...chars]
    next[i] = ch
    setChars(next)
    setError('')
    if (ch && i < CODE_LEN - 1) refs.current[i + 1]?.focus()
  }

  const handleKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !chars[i] && i > 0) {
      refs.current[i - 1]?.focus()
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN)
    const next = Array(CODE_LEN).fill('')
    pasted.split('').forEach((ch, i) => { next[i] = ch })
    setChars(next)
    refs.current[Math.min(pasted.length, CODE_LEN - 1)]?.focus()
  }

  const handleSubmit = async () => {
    if (code.length < CODE_LEN) { setError('Введите полный код'); return }
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/api/v1/rooms/join', { code })
      setChars(Array(CODE_LEN).fill(''))
      onJoined(data)
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Комната не найдена')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Войти в комнату">
      <div className="flex flex-col gap-6">
        <p className="text-parchment/60 text-sm">Введите 6-символьный код комнаты</p>

        <div className="flex gap-2 justify-center">
          {chars.map((ch, i) => (
            <input
              key={i}
              ref={(el) => { refs.current[i] = el }}
              value={ch}
              maxLength={1}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKey(i, e)}
              onPaste={handlePaste}
              className="w-10 h-12 text-center bg-dark border border-dark-border text-gold-light font-mono text-lg tracking-widest focus:outline-none focus:border-gold uppercase"
              autoFocus={i === 0}
            />
          ))}
        </div>

        {error && <p className="text-xs text-ember text-center">{error}</p>}

        <div className="flex gap-3 justify-end">
          <Button variant="ghost" type="button" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSubmit} loading={loading} disabled={code.length < CODE_LEN}>
            Войти
          </Button>
        </div>
      </div>
    </Modal>
  )
}
