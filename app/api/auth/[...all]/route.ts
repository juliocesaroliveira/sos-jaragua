import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/src/shared/auth/auth'

/** Handler do better-auth (DESIGN.md §6.1) — excluído do matcher do `proxy.ts`. */
export const { GET, POST } = toNextJsHandler(auth)
