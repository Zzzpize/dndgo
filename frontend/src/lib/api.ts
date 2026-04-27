import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
})

api.interceptors.request.use((config) => {
  const token = getStoredToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      removeStoredToken()
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('dndgo_token')
}

export function removeStoredToken() {
  if (typeof window !== 'undefined') localStorage.removeItem('dndgo_token')
}

export function setStoredToken(token: string) {
  if (typeof window !== 'undefined') localStorage.setItem('dndgo_token', token)
}

export default api
