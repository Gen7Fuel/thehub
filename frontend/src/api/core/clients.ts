import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { ApiError } from './errors'

declare module 'axios' {
  export interface AxiosRequestConfig {
    authRequired?: boolean
  }

  export interface InternalAxiosRequestConfig {
    authRequired?: boolean
  }
}

function createClient(baseURL: string): AxiosInstance {
  const client = axios.create({ baseURL })

  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    if (config.authRequired !== false) {
      const token = localStorage.getItem('token')
      if (token) config.headers.set('Authorization', `Bearer ${token}`)
    }
    return config
  })

  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => Promise.reject(new ApiError(error)),
  )

  return client
}

export const apiClient = createClient('/api')
export const authClient = createClient('/login-auth')
export const cdnClient = createClient('/cdn')
