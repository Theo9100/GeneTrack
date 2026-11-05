import { getSetting, setSetting } from './db'

interface AuthRecord {
  salt: string
  hash: string
}

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function derive(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: 150_000 }, key, 256)
  return b64(bits)
}

export async function hasPassword(): Promise<boolean> {
  return !!(await getSetting<AuthRecord | null>('auth', null))
}

export async function setPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  await setSetting('auth', { salt: b64(salt.buffer as ArrayBuffer), hash: await derive(password, salt) } satisfies AuthRecord)
}

export async function verifyPassword(password: string): Promise<boolean> {
  const rec = await getSetting<AuthRecord | null>('auth', null)
  if (!rec) return false
  return (await derive(password, unb64(rec.salt))) === rec.hash
}
