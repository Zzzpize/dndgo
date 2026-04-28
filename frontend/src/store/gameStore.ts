'use client'

import { create } from 'zustand'

export interface MapToken {
  id: string
  room_id: string
  token_type: 'pc' | 'npc'
  character_id?: string
  name: string
  rel_x: number
  rel_y: number
  disposition: 'friendly' | 'neutral' | 'hostile'
}

export interface InitiativeEntry {
  character_id?: string
  name: string
  initiative: number
}

export interface GameStateData {
  room_id: string
  map_image_url: string
  grid_enabled: boolean
  grid_size: number
  fog_cells: number[][]
  initiative_order: InitiativeEntry[]
}

export interface DiceLogEntry {
  id: string
  user_id: string
  notation: string
  rolls: number[]
  total: number
  timestamp: number
}

export interface CharacterStats {
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
  has_shield: boolean
  str_mod: number
  dex_mod: number
  con_mod: number
  int_mod: number
  wis_mod: number
  cha_mod: number
}

export interface Character {
  id: string
  user_id: string
  room_id: string
  name: string
  class: string
  race: string
  level: number
  hp: number
  max_hp: number
  ac: number
  effective_ac: number
  stats: CharacterStats | null
  weapons: unknown
  spell_slots: unknown
  notes: string
}

interface GameStore {
  tokens: MapToken[]
  gameState: GameStateData | null
  characters: Character[]
  diceLogs: DiceLogEntry[]
  isConnected: boolean
  role: 'dm' | 'player' | null
  activeInitIndex: number
  selectedTokenId: string | null
  selectedCharId: string | null
  rulerPos: { x1: number; y1: number; x2: number; y2: number } | null

  setRole: (r: 'dm' | 'player') => void
  setConnected: (v: boolean) => void
  setCharacters: (chars: Character[]) => void
  updateCharacter: (char: Character) => void
  applyFullState: (gs: GameStateData, tokens: MapToken[]) => void
  addToken: (t: MapToken) => void
  updateToken: (t: MapToken) => void
  removeToken: (id: string) => void
  setGrid: (enabled: boolean, size: number) => void
  setFogCells: (cells: number[][]) => void
  setInitiativeOrder: (order: InitiativeEntry[]) => void
  nextInitiative: () => void
  endInitiative: () => void
  addDiceLog: (entry: Omit<DiceLogEntry, 'id' | 'timestamp'>) => void
  setMapImage: (url: string) => void
  setSelectedToken: (id: string | null) => void
  setSelectedChar: (id: string | null) => void
  setRulerPos: (pos: { x1: number; y1: number; x2: number; y2: number } | null) => void
  reset: () => void
}

const initialState = {
  tokens: [] as MapToken[],
  gameState: null,
  characters: [] as Character[],
  diceLogs: [] as DiceLogEntry[],
  isConnected: false,
  role: null as 'dm' | 'player' | null,
  activeInitIndex: 0,
  selectedTokenId: null as string | null,
  selectedCharId: null as string | null,
  rulerPos: null as { x1: number; y1: number; x2: number; y2: number } | null,
}

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  setRole: (r) => set({ role: r }),
  setConnected: (v) => set({ isConnected: v }),
  setCharacters: (chars) => set({ characters: chars }),
  updateCharacter: (char) =>
    set((s) => ({ characters: s.characters.map((c) => (c.id === char.id ? char : c)) })),

  applyFullState: (gs, tokens) => {
    const parsed: GameStateData = {
      ...gs,
      fog_cells: Array.isArray(gs.fog_cells) ? gs.fog_cells : [],
      initiative_order: Array.isArray(gs.initiative_order) ? gs.initiative_order : [],
    }
    set({ gameState: parsed, tokens, activeInitIndex: 0 })
  },

  addToken: (t) => set((s) => ({ tokens: [...s.tokens, t] })),
  updateToken: (t) =>
    set((s) => ({ tokens: s.tokens.map((tok) => (tok.id === t.id ? t : tok)) })),
  removeToken: (id) => set((s) => ({ tokens: s.tokens.filter((t) => t.id !== id) })),

  setGrid: (enabled, size) =>
    set((s) => ({
      gameState: s.gameState ? { ...s.gameState, grid_enabled: enabled, grid_size: size } : s.gameState,
    })),

  setFogCells: (cells) =>
    set((s) => ({
      gameState: s.gameState ? { ...s.gameState, fog_cells: cells } : s.gameState,
    })),

  setInitiativeOrder: (order) =>
    set((s) => ({
      gameState: s.gameState ? { ...s.gameState, initiative_order: order } : s.gameState,
      activeInitIndex: 0,
    })),

  nextInitiative: () =>
    set((s) => {
      const len = s.gameState?.initiative_order.length ?? 0
      return { activeInitIndex: len > 0 ? (s.activeInitIndex + 1) % len : 0 }
    }),

  endInitiative: () => set({ activeInitIndex: 0 }),

  addDiceLog: (entry) =>
    set((s) => ({
      diceLogs: [
        { ...entry, id: crypto.randomUUID(), timestamp: Date.now() },
        ...s.diceLogs,
      ].slice(0, 20),
    })),

  setMapImage: (url) =>
    set((s) => ({
      gameState: s.gameState ? { ...s.gameState, map_image_url: url } : s.gameState,
    })),

  setSelectedToken: (id) => set({ selectedTokenId: id }),
  setSelectedChar: (id) => set({ selectedCharId: id }),
  setRulerPos: (pos) => set({ rulerPos: pos }),

  reset: () => set(initialState),
}))
