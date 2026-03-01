'use client'

import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('admin@genea.com')
  const [password, setPassword] = useState('password123')
  const [msg, setMsg] = useState('')

  async function onLogin(e: React.FormEvent) {
    e.preventDefault()
    setMsg('Connexion...')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg('Erreur: ' + (data?.error || 'LOGIN_FAILED'))
        return
      }
      localStorage.setItem('geneasphere_token', data.token)
      setMsg('OK. Token enregistré. Va sur /admin')
    } catch (err: any) {
      setMsg('Erreur: ' + String(err?.message || err))
    }
  }

  async function onMe() {
    setMsg('Vérification...')
    const token = localStorage.getItem('geneasphere_token') || ''
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: 'Bearer ' + token }
    })
    const data = await res.json()
    setMsg(JSON.stringify(data))
  }

  return (
    <main style={{ maxWidth: 520, margin: '40px auto', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 28, marginBottom: 16 }}>GeneaSphere - Connexion</h1>

      <form onSubmit={onLogin} style={{ display: 'grid', gap: 12 }}>
        <label>
          Email
          <input value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: 10 }} />
        </label>

        <label>
          Mot de passe
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: 10 }} />
        </label>

        <button type="submit" style={{ padding: 10, cursor: 'pointer' }}>
          Se connecter
        </button>

        <button type="button" onClick={onMe} style={{ padding: 10, cursor: 'pointer' }}>
          Tester /me
        </button>
      </form>

      <p style={{ marginTop: 16, whiteSpace: 'pre-wrap' }}>{msg}</p>

      <p style={{ marginTop: 24 }}>
        Liens: <a href="/admin">/admin</a>
      </p>
    </main>
  )
}
