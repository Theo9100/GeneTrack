import { useEffect, useState } from 'preact/hooks'
import { hasPassword, setPassword, verifyPassword } from './auth'
import { Form } from './ui'

export function Lock({ onUnlock }: { onUnlock: () => void }) {
  const [has, setHas] = useState<boolean>()
  useEffect(() => {
    hasPassword().then(setHas)
  }, [])
  if (has === undefined) return null
  return (
    <div class="lock card">
      <h1>GeneTrack</h1>
      {has ? (
        <Form
          fields={[{ name: 'pw', label: 'Mot de passe', type: 'password' }]}
          initial={{ pw: '' }}
          submitLabel="Déverrouiller"
          onSubmit={async (v) => {
            if (!(await verifyPassword(String(v.pw)))) throw new Error('Mot de passe incorrect.')
            onUnlock()
          }}
        />
      ) : (
        <>
          <p>Première ouverture : choisissez un mot de passe. Il est stocké (haché) uniquement sur cet appareil ; il faudra en définir un sur chaque appareil.</p>
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
          />
        </>
      )}
    </div>
  )
}
