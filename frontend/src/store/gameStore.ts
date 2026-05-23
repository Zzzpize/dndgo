'use client'

import { create } from 'zustand'

export interface MapToken {
  id: string
  room_id: string
  token_type: 'pc' | 'npc'
  character_id?: string
  npc_id?: string
  name: string
  rel_x: number
  rel_y: number
  disposition: 'friendly' | 'neutral' | 'hostile'
  current_hp?: number
  max_hp?: number
}

export interface NpcFolder {
  id: string
  room_id: string
  name: string
  created_at: string
}

export interface NPC {
  id: string
  user_id: string
  room_id: string
  folder_id?: string | null
  name: string
  disposition: 'friendly' | 'neutral' | 'hostile'
  ac: string
  max_hp: number
  speed: string
  type_alignment: string
  abilities: Record<string, number>
  actions: string[]
  created_at: string
}

export interface InitiativeEntry {
  token_id: string
  character_id?: string
  npc_id?: string
  name: string
  initiative: number
  advantage?: number
  dex_mod?: number
}

export interface FogPath {
  rel_x: number
  rel_y: number
  radius: number
}

export interface GameStateData {
  room_id: string
  map_image_url: string
  map_aspect: number
  grid_enabled: boolean
  grid_size: number
  fog_paths: FogPath[]
  fog_cleared: boolean
  initiative_order: InitiativeEntry[]
}

export interface DiceLogEntry {
  id: string
  user_id: string
  username: string
  role: 'dm' | 'player'
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
  subclass: string
  race: string
  subrace: string
  level: number
  hp: number
  max_hp: number
  ac: number
  temp_hp: number
  effective_ac: number
  stats: CharacterStats | null
  weapons: unknown
  spell_slots: unknown
  abilities: unknown
  inventory: string
  notes: string
}

interface GameStore {
  tokens: MapToken[]
  gameState: GameStateData | null
  characters: Character[]
  npcs: NPC[]
  npcFolders: NpcFolder[]
  diceLogs: DiceLogEntry[]
  isConnected: boolean
  role: 'dm' | 'player' | null
  activeInitIndex: number
  selectedTokenId: string | null
  selectedCharId: string | null
  editingTokenId: string | null
  rulerPos: { x1: number; y1: number; x2: number; y2: number } | null
  activeTool: 'pointer' | 'fog' | 'ruler'

  setRole: (r: 'dm' | 'player') => void
  setConnected: (v: boolean) => void
  setActiveTool: (t: 'pointer' | 'fog' | 'ruler') => void
  setCharacters: (chars: Character[]) => void
  addCharacter: (char: Character) => void
  updateCharacter: (char: Character) => void
  setNpcs: (npcs: NPC[]) => void
  addNpc: (n: NPC) => void
  updateNpc: (n: NPC) => void
  removeNpc: (id: string) => void
  setNpcFolders: (folders: NpcFolder[]) => void
  addNpcFolder: (f: NpcFolder) => void
  removeNpcFolder: (id: string) => void
  setNpcFolder: (npcId: string, folderId: string | null) => void
  applyFullState: (gs: GameStateData, tokens: MapToken[]) => void
  addToken: (t: MapToken) => void
  updateToken: (t: MapToken) => void
  moveToken: (id: string, rel_x: number, rel_y: number) => void
  removeToken: (id: string) => void
  setGrid: (enabled: boolean, size: number) => void
  setFogState: (fogCleared: boolean, paths: FogPath[]) => void
  addFogPaths: (paths: FogPath[]) => void
  setInitiativeOrder: (order: InitiativeEntry[]) => void
  nextInitiative: () => void
  endInitiative: () => void
  addDiceLog: (entry: Omit<DiceLogEntry, 'id' | 'timestamp'>) => void
  clearDiceLogs: () => void
  setMapImage: (url: string, aspect?: number) => void
  setSelectedToken: (id: string | null) => void
  setSelectedChar: (id: string | null) => void
  setEditingTokenId: (id: string | null) => void
  setRulerPos: (pos: { x1: number; y1: number; x2: number; y2: number } | null) => void
  reset: () => void
}

const initialState = {
  tokens: [] as MapToken[],
  gameState: null,
  characters: [] as Character[],
  npcs: [] as NPC[],
  npcFolders: [] as NpcFolder[],
  diceLogs: [] as DiceLogEntry[],
  isConnected: false,
  role: null as 'dm' | 'player' | null,
  activeInitIndex: 0,
  selectedTokenId: null as string | null,
  selectedCharId: null as string | null,
  editingTokenId: null as string | null,
  rulerPos: null as { x1: number; y1: number; x2: number; y2: number } | null,
  activeTool: 'pointer' as 'pointer' | 'fog' | 'ruler',
}

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  setRole: (r) => set({ role: r }),
  setConnected: (v) => set({ isConnected: v }),
  setActiveTool: (t) => set({ activeTool: t }),
  setCharacters: (chars) => set({ characters: chars }),
  addCharacter: (char) => set((s) => ({ characters: [...s.characters, char] })),

  updateCharacter: (char) =>
    set((s) => ({ characters: s.characters.map((c) => (c.id === char.id ? char : c)) })),

  setNpcs: (npcs) => set({ npcs }),
  addNpc: (n) => set((s) => ({ npcs: [...s.npcs, n] })),
  updateNpc: (n) => set((s) => ({ npcs: s.npcs.map((x) => (x.id === n.id ? n : x)) })),
  removeNpc: (id) => set((s) => ({ npcs: s.npcs.filter((x) => x.id !== id) })),

  setNpcFolders: (npcFolders) => set({ npcFolders }),
  addNpcFolder: (f) => set((s) => ({ npcFolders: [...s.npcFolders, f] })),
  removeNpcFolder: (id) => set((s) => ({ npcFolders: s.npcFolders.filter((f) => f.id !== id) })),
  setNpcFolder: (npcId, folderId) =>
    set((s) => ({
      npcs: s.npcs.map((n) => (n.id === npcId ? { ...n, folder_id: folderId } : n)),
    })),

  applyFullState: (gs, tokens) => {
    const parsed: GameStateData = {
      ...gs,
      fog_paths: Array.isArray(gs.fog_paths) ? gs.fog_paths : [],
      fog_cleared: gs.fog_cleared ?? true,
      initiative_order: Array.isArray(gs.initiative_order) ? gs.initiative_order : [],
    }
    set({ gameState: parsed, tokens, activeInitIndex: 0 })
  },

  addToken: (t) => set((s) => ({
    tokens: s.tokens.some((tok) => tok.id === t.id) ? s.tokens : [...s.tokens, t],
  })),
  updateToken: (t) =>
    set((s) => ({ tokens: s.tokens.map((tok) => (tok.id === t.id ? t : tok)) })),
  moveToken: (id, rel_x, rel_y) =>
    set((s) => ({ tokens: s.tokens.map((tok) => tok.id === id ? { ...tok, rel_x, rel_y } : tok) })),
  removeToken: (id) => set((s) => ({ tokens: s.tokens.filter((t) => t.id !== id) })),

  setGrid: (enabled, size) =>
    set((s) => ({
      gameState: s.gameState ? { ...s.gameState, grid_enabled: enabled, grid_size: size } : s.gameState,
    })),

  setFogState: (fogCleared, paths) =>
    set((s) => ({
      gameState: s.gameState
        ? { ...s.gameState, fog_cleared: fogCleared, fog_paths: paths }
        : s.gameState,
    })),

  addFogPaths: (paths) =>
    set((s) => ({
      gameState: s.gameState
        ? { ...s.gameState, fog_paths: [...(s.gameState.fog_paths ?? []), ...paths] }
        : s.gameState,
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

  endInitiative: () =>
    set((s) => ({
      activeInitIndex: 0,
      gameState: s.gameState ? { ...s.gameState, initiative_order: [] } : s.gameState,
    })),

  addDiceLog: (entry) =>
    set((s) => ({
      diceLogs: [
        { ...entry, id: crypto.randomUUID(), timestamp: Date.now() },
        ...s.diceLogs,
      ].slice(0, 20),
    })),

  clearDiceLogs: () => set({ diceLogs: [] }),

  setMapImage: (url, aspect) =>
    set((s) => ({
      gameState: s.gameState
        ? { ...s.gameState, map_image_url: url, ...(aspect !== undefined ? { map_aspect: aspect } : {}) }
        : s.gameState,
    })),

  setSelectedToken: (id) => set({ selectedTokenId: id }),
  setSelectedChar: (id) => set({ selectedCharId: id }),
  setEditingTokenId: (id) => set({ editingTokenId: id }),
  setRulerPos: (pos) => set({ rulerPos: pos }),

  reset: () => set(initialState),
}))
