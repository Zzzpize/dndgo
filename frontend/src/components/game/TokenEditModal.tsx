'use client'

import { useState } from 'react'
import { MapToken } from '@/store/gameStore'

interface Props {
  token: MapToken
  sendMessage: (type: string, payload?: unknown) => void
  onClose: () => void
}

const DISP_OPTIONS: { value: MapToken['disposition']; label: string }[] = [
  { value: 'hostile', label: 'Враг' },
  { value: 'neutral', label: 'Нейтрал' },
  { value: 'friendly', label: 'Союзник' },
]

const SIZE_OPTIONS = [1, 2, 3, 4, 5]

export function TokenEditModal({ token, sendMessage, onClose }: Props) {
  const [name, setName] = useState(token.name)
  const [disposition, setDisposition] = useState(token.disposition)
  const [maxHp, setMaxHp] = useState(token.max_hp ?? '')
  const [currentHp, setCurrentHp] = useState<number | ''>(token.current_hp ?? '')
  const [size, setSize] = useState(token.size ?? 1)

  const save = () => {
    sendMessage('TOKEN_EDIT', {
      id: token.id,
      name: name.trim() || token.name,
      disposition,
      max_hp: maxHp.trim() || null,
      current_hp: currentHp === '' ? null : currentHp,
      size,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-dark-card border border-dark-border rounded-lg shadow-2xl w-80 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-border flex items-center justify-between">
          <span className="font-fantasy text-sm text-gold-light">Редактировать токен</span>
          <button
            onClick={onClose}
            className="text-parchment/40 hover:text-parchment/80 text-sm w-6 h-6 flex items-center justify-center"
          >✕</button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-parchment/50 text-xs">Имя</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save() }}
              className="w-full bg-dark border border-dark-border rounded px-2 py-1.5 text-sm text-parchment placeholder-parchment/30"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-parchment/50 text-xs">Отношение</label>
            <div className="flex gap-2">
              {DISP_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDisposition(opt.value)}
                  className={`flex-1 py-1.5 rounded border text-xs font-fantasy transition-colors ${
                    disposition === opt.value
                      ? opt.value === 'hostile'
                        ? 'bg-token-hostile/30 border-token-hostile text-parchment'
                        : opt.value === 'neutral'
                        ? 'bg-token-neutral/30 border-token-neutral text-parchment'
                        : 'bg-token-friendly/30 border-token-friendly text-parchment'
                      : 'bg-dark border-dark-border text-parchment/40 hover:text-parchment/70'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-parchment/50 text-xs">Размер (клетки)</label>
            <div className="flex gap-1.5">
              {SIZE_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={`flex-1 py-1.5 rounded border text-xs font-mono transition-colors ${
                    size === s
                      ? 'bg-gold/20 border-gold/40 text-gold-light'
                      : 'bg-dark border-dark-border text-parchment/40 hover:text-parchment/70'
                  }`}
                >
                  {s}×{s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-parchment/50 text-xs">Макс. HP</label>
              <input
                type="text"
                value={maxHp}
                onChange={(e) => setMaxHp(e.target.value)}
                placeholder="20 или Inf"
                className="w-full bg-dark border border-dark-border rounded px-2 py-1.5 text-sm text-parchment text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-parchment/50 text-xs">Текущий HP</label>
              <input
                type="number"
                value={currentHp}
                onChange={(e) => setCurrentHp(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                placeholder="—"
                className="w-full bg-dark border border-dark-border rounded px-2 py-1.5 text-sm text-parchment text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-1.5 bg-dark hover:bg-dark-hover border border-dark-border rounded text-xs text-parchment/60 hover:text-parchment transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={save}
            className="flex-1 py-1.5 bg-gold/20 hover:bg-gold/30 border border-gold/30 rounded text-xs text-gold-light font-fantasy transition-colors"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}
