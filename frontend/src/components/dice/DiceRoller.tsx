'use client'

import { useState } from 'react'

interface Props {
  sendMessage: (type: string, payload?: unknown) => void
}

const QUICK_DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']

export function DiceRoller({ sendMessage }: Props) {
  const [notation, setNotation] = useState('')

  const roll = (n: string) => {
    const cleaned = n.trim()
    if (!cleaned) return
    sendMessage('DICE_ROLL', { notation: cleaned })
    setNotation('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') roll(notation)
  }

  return (
    <div className="border-t border-dark-border bg-dark-card px-3 py-2 flex items-center gap-2 shrink-0">
      <span className="text-parchment/30 text-xs font-fantasy hidden sm:block">Бросок:</span>

      <div className="flex gap-1 flex-wrap">
        {QUICK_DICE.map((d) => (
          <button
            key={d}
            onClick={() => roll(d)}
            className="px-2 py-0.5 text-xs font-fantasy bg-dark hover:bg-dark-hover border border-dark-border hover:border-gold/40 rounded text-parchment/60 hover:text-gold-light transition-colors"
          >
            {d}
          </button>
        ))}
      </div>

      <div className="flex gap-1 ml-auto">
        <input
          value={notation}
          onChange={(e) => setNotation(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="2d6+3"
          className="w-28 bg-dark border border-dark-border rounded px-2 py-1 text-xs text-parchment placeholder-parchment/30 focus:border-gold/50 focus:outline-none"
        />
        <button
          onClick={() => roll(notation)}
          className="px-3 py-1 bg-gold/20 hover:bg-gold/30 border border-gold/30 rounded text-xs text-gold-light font-fantasy transition-colors"
        >
          Бросить
        </button>
      </div>
    </div>
  )
}
