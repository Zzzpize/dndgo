'use client'

import { create } from 'zustand'
import api, { getStoredToken, setStoredToken, removeStoredToken } from '@/lib/api'

export interface User {
  id: string
  email: string
  username: string
}

interface AuthStore {
  user: User | null
  token: string | null
  hydrated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  logout: () => void
  hydrate: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  hydrated: false,

  login: async (email, password) => {
    const { data } = await api.post('/api/v1/auth/login', { email, password })
    setStoredToken(data.token)
    set({ user: data.user, token: data.token })
  },

  register: async (email, username, password) => {
    const { data } = await api.post('/api/v1/auth/register', { email, username, password })
    setStoredToken(data.token)
    set({ user: data.user, token: data.token })
  },

  logout: () => {
    removeStoredToken()
    set({ user: null, token: null })
  },

  hydrate: async () => {
    const token = getStoredToken()
    if (!token) {
      set({ hydrated: true })
      return
    }
    try {
      const { data } = await api.get('/api/v1/auth/me')
      set({ user: data, token, hydrated: true })
    } catch {
      removeStoredToken()
      set({ user: null, token: null, hydrated: true })
    }
  },
}))
