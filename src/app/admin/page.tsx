'use client'

import { useEffect, useState } from 'react'

type User = {
  id: string
  email: string
  role: 'PENDING' | 'USER' | 'ADMIN'
  isValidated: boolean
  createdAt?: string
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([])
  const [msg, setMsg] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'PENDING' | 'USER' | 'ADMIN'>('USER')

  function token() {
    return localStorage.getItem('geneasphere_token') || ''
  }

  async function load() {
    setMsg('Chargement...')
    const t = token()
    if (!t) {
      setMsg('Pas de token. Va sur /login')
      setUsers([])
      return
    }
    const res = await fetch('/api/admin/users', {
      headers: { Authorization: 'Bearer ' + t }
    })
    const data = await res.json()
    if (!res.ok) {
      setMsg('Erreur: ' + (data?.error || 'LOAD_FAILED'))
      setUsers([])
      return
    }
    setUsers(data.users || [])
    setMsg('OK')
  }

  async function post(path: string, body: any) {
    const t = token()
    const res = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + t
      },
      body: JSON.stringify(body)
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'REQUEST_FAILED')
    return data
  }

  async function onValidate(userId: string) {
    try {
      setMsg('Validation...')
      await post('/api/admin/users/validate', { userId })
      await load()
    } catch (e: any) {
      setMsg('Erreur: ' + String(e?.message || e))
    }
  }

  async function onRole(userId: string, role: 'PENDING' | 'USER' | 'ADMIN') {
    try {
      setMsg('Changement de rôle...')
      await post('/api/admin/users/role', { userId, role })
      await load()
    } catch (e: any) {
      setMsg('Erreur: ' + String(e?.message || e))
    }
  }

  async function onDelete(userId: string) {
    try {
      setMsg('Suppression...')
      await post('/api/admin/users/delete', { userId })
      await load()
    } catch (e: any) {
      setMsg('Erreur: ' + String(e?.message || e))
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    try {
      setMsg('Création...')
      await post('/api/admin/users/create', { email: newEmail, password: newPassword, role: newRole })
      setNewEmail('')
      setNewPassword('')
      setNewRole('USER')
      await load()
    } catch (e: any) {
      setMsg('Erreur: ' + String(e?.message || e))
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <main style={{ maxWidth: 900, margin: '40px auto', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Administration - Utilisateurs</h1>
      <p style={{ marginTop: 0 }}>
        Token requis. Si besoin: <a href="/login">/login</a>
      </p>

      <div style={{ padding: 12, border: '1px solid #ddd', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>Créer un compte</h2>
        <form onSubmit={onCreate} style={{ display: 'grid', gap: 10 }}>
          <input placeholder="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} style={{ padding: 10 }} />
          <input placeholder="Mot de passe (min 8)" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ padding: 10 }} />
          <select value={newRole} onChange={e => setNewRole(e.target.value as any)} style={{ padding: 10 }}>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="PENDING">PENDING</option>
          </select>
          <button type="submit" style={{ padding: 10, cursor: 'pointer' }}>Créer</button>
        </form>
      </div>

      <button onClick={load} style={{ padding: 10, cursor: 'pointer', marginBottom: 12 }}>Rafraîchir</button>
      <div style={{ marginBottom: 12, whiteSpace: 'pre-wrap' }}>{msg}</div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Email</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Rôle</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Validé</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{u.email}</td>
              <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{u.role}</td>
              <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{u.isValidated ? 'oui' : 'non'}</td>
              <td style={{ borderBottom: '1px solid #eee', padding: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => onValidate(u.id)} style={{ padding: 8, cursor: 'pointer' }}>Valider</button>
                <button onClick={() => onRole(u.id, 'USER')} style={{ padding: 8, cursor: 'pointer' }}>USER</button>
                <button onClick={() => onRole(u.id, 'ADMIN')} style={{ padding: 8, cursor: 'pointer' }}>ADMIN</button>
                <button onClick={() => onRole(u.id, 'PENDING')} style={{ padding: 8, cursor: 'pointer' }}>PENDING</button>
                <button onClick={() => onDelete(u.id)} style={{ padding: 8, cursor: 'pointer' }}>Supprimer</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
