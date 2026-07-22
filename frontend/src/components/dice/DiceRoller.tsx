'use client'

import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '@/store/gameStore'

interface Props {
  sendMessage: (type: string, payload?: unknown) => void
}

const QUICK_DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']

const DICE_RE = /^\d*[dD]\d+([+-]\d+)?$/

export function DiceRoller({ sendMessage }: Props) {
  const [notation, setNotation] = useState('')
  const [error, setError] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const expandRef = useRef<HTMLDivElement>(null)
  const role = useGameStore((s) => s.role)
  const clearDiceLogs = useGameStore((s) => s.clearDiceLogs)
  const diceLogs = useGameStore((s) => s.diceLogs)
  const gameState = useGameStore((s) => s.gameState)
  const canRoll = role === 'dm' || (gameState?.player_can_roll_dice ?? true)
  const seeDmRolls = role === 'dm' || (gameState?.players_see_dm_rolls ?? true)
  const visibleLogs = seeDmRolls ? diceLogs : diceLogs.filter((l) => l.role !== 'dm')

  useEffect(() => {
    if (!expanded) return
    const handler = (e: MouseEvent) => {
      if (expandRef.current && !expandRef.current.contains(e.target as Node)) {
        setExpanded(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [expanded])

  const roll = (n: string) => {
    const cleaned = n.trim()
    if (!cleaned) return
    if (!DICE_RE.test(cleaned)) {
      setError(true)
      return
    }
    setError(false)
    sendMessage('DICE_ROLL', { notation: cleaned })
    setNotation('')
  }

  const handleClear = () => {
    if (role === 'dm') {
      sendMessage('DICE_LOG_CLEAR')
    } else {
      clearDiceLogs()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') roll(notation)
  }

  return (
    <div className="border-t border-dark-border bg-dark-card px-3 py-2 flex items-center gap-2 shrink-0 overflow-x-auto">
      <span className="text-parchment/30 text-xs font-fantasy shrink-0 hidden sm:inline">Бросок:</span>

      <div className="flex gap-1 shrink-0">
        {QUICK_DICE.map((d) => (
          <button
            key={d}
            onClick={() => roll(d)}
            disabled={!canRoll}
            className="px-2 py-1 md:py-0.5 text-xs font-fantasy bg-dark hover:bg-dark-hover border border-dark-border hover:border-gold/40 rounded text-parchment/60 hover:text-gold-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {d}
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-dark-border shrink-0" />

      <div className="relative">
        <input
          value={notation}
          onChange={(e) => { setNotation(e.target.value); setError(false) }}
          onKeyDown={handleKeyDown}
          placeholder="2d6+3"
          className={`w-24 bg-dark border rounded px-2 py-1 text-xs text-parchment placeholder-parchment/30 focus:outline-none transition-colors ${
            error ? 'border-ember/70 focus:border-ember' : 'border-dark-border focus:border-gold/50'
          }`}
        />
        {error && (
          <div className="absolute bottom-full left-0 mb-1.5 w-56 bg-dark-card border border-ember/40 rounded px-2.5 py-2 text-xs shadow-xl z-50 pointer-events-none">
            <p className="text-ember font-fantasy mb-1">Неверный формат</p>
            <p className="text-parchment/60 leading-relaxed">
              Используй нотацию вида <span className="text-parchment">2d6+5</span>
            </p>
            <p className="text-parchment/40 mt-1 leading-relaxed">
              <span className="text-parchment/60">2</span> — кол-во кубиков &nbsp;
              <span className="text-parchment/60">d6</span> — тип &nbsp;
              <span className="text-parchment/60">+5</span> — бонус
            </p>
          </div>
        )}
      </div>
      <button
        onClick={() => roll(notation)}
        disabled={!canRoll}
        className="px-3 py-1 bg-gold/20 hover:bg-gold/30 border border-gold/30 rounded text-xs text-gold-light font-fantasy transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Бросить
      </button>

      <div className="w-px h-4 bg-dark-border shrink-0" />

      <button
        onClick={handleClear}
        title={role === 'dm' ? 'Очистить лог у всех' : 'Очистить свой лог'}
        className="px-2 py-1 bg-dark hover:bg-dark-hover border border-dark-border rounded text-xs text-parchment/40 hover:text-ember transition-colors shrink-0"
      >
        Очистить
      </button>

      {visibleLogs.length > 0 && (
        <>
          <div className="w-px h-4 bg-dark-border shrink-0" />

          <div ref={expandRef} className="relative flex-1 min-w-0">
            <div
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-3 overflow-hidden cursor-pointer group"
              title="Нажмите для раскрытия"
            >
              {visibleLogs.slice(0, 12).map((log, i) => {
                return (
                  <div
                    key={log.id}
                    className="flex items-center gap-1 shrink-0 text-xs"
                    style={{ opacity: Math.max(0.15, 1 - i * 0.15) }}
                  >
                    <span className="text-parchment/50 font-fantasy truncate max-w-[80px]">{log.username}</span>
                  <span className={`text-[10px] shrink-0 ${log.role === 'dm' ? 'text-gold/50' : 'text-parchment/25'}`}>
                    {log.role === 'dm' ? 'ДМ' : 'Игрок'}
                  </span>
                    <span className="text-parchment/30">→</span>
                    <span className="text-parchment/60">{log.notation}</span>
                    <span className="text-parchment/30">=</span>
                    <span className="text-gold-light font-bold">{log.total}</span>
                    {log.karmic_applied && <span className="text-amber-400" title="Кармические кубики">★</span>}
                    {(log.rolls?.length ?? 0) > 1 && (
                      <span className="text-parchment/25">[{(log.rolls ?? []).join(',')}]</span>
                    )}
                  </div>
                )
              })}
            </div>

            {expanded && (
              <div className="absolute bottom-full right-0 mb-2 w-80 bg-dark-card border border-dark-border rounded-lg shadow-2xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-dark-border">
                  <span className="text-xs font-fantasy text-parchment/60">История бросков</span>
                  <button
                    onClick={() => setExpanded(false)}
                    className="text-parchment/30 hover:text-parchment text-xs transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: '17.5rem' }}>
                  {visibleLogs.map((log) => {
                    return (
                      <div
                        key={log.id}
                        className="flex items-center gap-2 px-3 py-2 border-b border-dark-border/40 hover:bg-dark/40 text-xs"
                      >
                        <span className="text-gold-light font-fantasy truncate shrink-0 max-w-[90px]">{log.username}</span>
                        <span className={`text-[10px] shrink-0 ${log.role === 'dm' ? 'text-gold/60' : 'text-parchment/30'}`}>
                          {log.role === 'dm' ? 'ДМ' : 'Игрок'}
                        </span>
                        <span className="text-parchment/30">→</span>
                        <span className="text-parchment/70 shrink-0">{log.notation}</span>
                        <span className="text-parchment/30">=</span>
                        <span className="text-gold-light font-bold shrink-0">{log.total}</span>
                        {log.karmic_applied && <span className="text-amber-400 shrink-0" title="Кармические кубики">★</span>}
                        {(log.rolls?.length ?? 0) > 1 && (
                          <span className="text-parchment/30 ml-auto">[{(log.rolls ?? []).join(', ')}]</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
