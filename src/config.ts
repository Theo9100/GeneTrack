/**
 * Configuration Firebase (synchronisation). Elle est fournie au moment de la compilation par la variable
 * VITE_FIREBASE_CONFIG (variable GitHub « FIREBASE_CONFIG »). Sans elle, l'app fonctionne en local seul.
 *
 * Accepte le JSON ou l'objet JavaScript tel que copié depuis la console Firebase
 * (const firebaseConfig = { apiKey: "...", ... }). Ces valeurs ne sont pas secrètes :
 * la protection vient des règles de sécurité Firestore (voir firestore.rules).
 */
export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
  [k: string]: string
}

export function parseFirebaseConfig(raw: string | undefined): FirebaseConfig | null {
  if (!raw || !raw.trim()) return null
  const out: Record<string, string> = {}
  for (const m of raw.matchAll(/["']?(\w+)["']?\s*:\s*["']([^"']+)["']/g)) out[m[1]] = m[2]
  return out.apiKey && out.projectId && out.appId ? (out as FirebaseConfig) : null
}

export const firebaseConfig = parseFirebaseConfig(import.meta.env.VITE_FIREBASE_CONFIG)
export const cloudEnabled = !!firebaseConfig
