import { useEffect, useState } from 'preact/hooks'
import { hasPassword, setPassword, verifyPassword } from './auth'
import { cloudEnabled } from './config'
import { cloudLogin, cloudReset, cloudUser } from './cloud'
import { setSetting } from './db'
import { Form } from './ui'

type Mode = 'unlock' | 'setup' | 'cloud'

export function Lock({ onUnlock }: { onUnlock: () => void }) {
  const [mode, setMode] = useState<Mode>()
  const [create, setCreate] = useState(false)
  const [info, setInfo] = useState('')
  const [email, setEmail] = useState('')
  useEffect(() => {
    ;(async () => {
      const has = await hasPassword()
      if (cloudEnabled) {
        // Compte déjà connecté sur cet appareil : simple déverrouillage local (fonctionne hors ligne).
        const user = await cloudUser().catch(() => null)
        return setMode(user && has ? 'unlock' : 'cloud')
      }
      setMode(has ? 'unlock' : 'setup')
    })()
  }, [])
  if (!mode) return null

  return (
    <div class="lock">
      <div class="card">
        <img class="mark" src="icon-192.png" alt="" />
        <h1>GeneTrack</h1>
        <p class="sub">
          {mode === 'unlock'
            ? 'Gestion du troupeau — Blonde d’Aquitaine'
            : mode === 'cloud'
              ? create
                ? 'Créez le compte du troupeau. Utilisez ensuite le même e-mail et mot de passe sur tous vos appareils.'
                : 'Connectez-vous pour synchroniser le troupeau entre vos appareils.'
              : 'Bienvenue. Choisissez un mot de passe pour protéger l’accès à l’application.'}
        </p>
        {mode === 'unlock' && (
          <Form
            fields={[{ name: 'pw', label: 'Mot de passe', type: 'password' }]}
            initial={{ pw: '' }}
            submitLabel="Déverrouiller"
            onSubmit={async (v) => {
              if (!(await verifyPassword(String(v.pw)))) throw new Error('Mot de passe incorrect.')
              onUnlock()
            }}
          />
        )}
        {mode === 'setup' && (
          <Form
            fields={[
              { name: 'pw', label: 'Nouveau mot de passe', type: 'password' },
              { name: 'pw2', label: 'Confirmation', type: 'password' },
            ]}
            initial={{ pw: '', pw2: '' }}
            submitLabel="Créer et entrer"
            onSubmit={async (v) => {
              if (String(v.pw).length < 4) throw new Error('4 caractères minimum.')
              if (v.pw !== v.pw2) throw new Error('Les deux saisies sont différentes.')
              await setPassword(String(v.pw))
              onUnlock()
            }}
          >
            <small>Stocké uniquement sur cet appareil. Chaque appareil a son propre mot de passe.</small>
          </Form>
        )}
        {mode === 'cloud' && (
          <Form
            key={create ? 'c' : 'l'}
            fields={[
              { name: 'email', label: 'E-mail', type: 'email', placeholder: 'vous@exemple.fr' },
              { name: 'pw', label: 'Mot de passe', type: 'password', hint: create ? '6 caractères minimum.' : undefined },
              ...(create ? [{ name: 'pw2', label: 'Confirmation', type: 'password' as const }] : []),
            ]}
            initial={{ email: '', pw: '', pw2: '' }}
            submitLabel={create ? 'Créer le compte' : 'Se connecter'}
            onChange={(v) => setEmail(String(v.email).trim())}
            onSubmit={async (v) => {
              const email = String(v.email).trim()
              const pw = String(v.pw)
              if (create && pw !== v.pw2) throw new Error('Les deux saisies sont différentes.')
              await cloudLogin(email, pw, create)
              // Même mot de passe pour déverrouiller l'app hors ligne sur cet appareil.
              await setPassword(pw)
              await setSetting('syncEmail', email)
              onUnlock()
            }}
          >
            {info && <p class="banner ok">{info}</p>}
            <div class="row" style="justify-content:space-between">
              <button type="button" class="small" onClick={() => { setCreate(!create); setInfo('') }}>
                {create ? 'J’ai déjà un compte' : 'Créer le compte (1er appareil)'}
              </button>
              {!create && (
                <button type="button" class="small" onClick={async () => {
                  if (!email) return setInfo('Saisissez votre e-mail ci-dessus, puis recliquez.')
                  try {
                    await cloudReset(email)
                    setInfo(`E-mail de réinitialisation envoyé à ${email}.`)
                  } catch (e) {
                    setInfo(e instanceof Error ? e.message : String(e))
                  }
                }}>Mot de passe oublié</button>
              )}
            </div>
          </Form>
        )}
      </div>
    </div>
  )
}
