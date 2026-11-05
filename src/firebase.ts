import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type Auth,
} from 'firebase/auth'
import {
  collection, doc, initializeFirestore, onSnapshot, persistentLocalCache, persistentMultipleTabManager, setDoc, type Firestore,
} from 'firebase/firestore'
import { firebaseConfig } from './config'
import type { Remote, Row } from './sync'
import type { TableName } from './db'

// Chargé à la demande (import dynamique) : rien n'est téléchargé si la synchro n'est pas configurée.
let app: FirebaseApp
let auth: Auth
let fs: Firestore

function init() {
  if (app) return
  app = initializeApp(firebaseConfig!)
  auth = getAuth(app)
  try {
    // Cache persistant : les écritures faites hors ligne survivent à la fermeture de l'app.
    fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
  } catch {
    fs = initializeFirestore(app, {})
  }
}

export async function currentUser() {
  init()
  await auth.authStateReady()
  return auth.currentUser
}

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
  'auth/invalid-email': 'Adresse e-mail invalide.',
  'auth/user-not-found': 'Aucun compte avec cet e-mail.',
  'auth/wrong-password': 'Mot de passe incorrect.',
  'auth/email-already-in-use': 'Un compte existe déjà avec cet e-mail : utilisez « Se connecter ».',
  'auth/weak-password': 'Mot de passe trop faible (6 caractères minimum).',
  'auth/network-request-failed': 'Pas de connexion internet. La première connexion doit se faire en ligne.',
  'auth/too-many-requests': 'Trop de tentatives. Réessayez dans quelques minutes.',
  'auth/operation-not-allowed': 'La connexion par e-mail n’est pas activée dans Firebase (Authentication → Sign-in method).',
  'auth/admin-restricted-operation': 'La création de compte est désactivée dans Firebase.',
}
const frError = (e: unknown) => {
  const code = (e as { code?: string })?.code ?? ''
  if (code.startsWith('auth/api-key-not-valid')) return new Error('Configuration Firebase invalide (clé API). Vérifiez la variable FIREBASE_CONFIG.')
  return new Error(MESSAGES[code] ?? (e instanceof Error ? e.message : String(e)))
}

export async function login(email: string, password: string, create: boolean) {
  init()
  try {
    const cred = create ? await createUserWithEmailAndPassword(auth, email, password) : await signInWithEmailAndPassword(auth, email, password)
    return cred.user
  } catch (e) {
    throw frError(e)
  }
}

export async function resetPassword(email: string) {
  init()
  try {
    await sendPasswordResetEmail(auth, email)
  } catch (e) {
    throw frError(e)
  }
}

export async function logout() {
  init()
  await signOut(auth)
}

/** Données du troupeau : herds/{uid}/{table}/{id}. */
export function remoteFor(uid: string): Remote {
  init()
  return {
    listen(table: TableName, onRows, onError) {
      let first = true
      return onSnapshot(
        collection(fs, 'herds', uid, table),
        (snap) => {
          const rows = (first ? snap.docs : snap.docChanges().filter((c) => c.type !== 'removed').map((c) => c.doc)).map((d) => d.data() as Row)
          onRows(rows, first)
          first = false
        },
        onError,
      )
    },
    write: (table, row) => setDoc(doc(fs, 'herds', uid, table, row.id), row),
  }
}
