'use client'

import { useEffect, useState } from 'react'
import { requireTokenOrRedirect } from '@/app/_lib/authClient'

type Member = {
  id: string
  firstName: string
  lastName: string
  sex: 'M' | 'F' | 'X'
  visibility: 'PUBLIC' | 'PRIVATE'
  notes?: string
}

export default function MembersPage() {
  const [msg, setMsg] = useState('')
  const [q, setQ] = useState('')

  const [results, setResults] = useState<Member[]>([])
  const [selected, setSelected] = useState<Member | null>(null)

  const [cFirstName, setCFirstName] = useState('')
  const [cLastName, setCLastName] = useState('')
  const [cSex, setCSex] = useState<'M' | 'F' | 'X'>('X')
  const [cVis, setCVis] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC')

  const [eFirstName, setEFirstName] = useState('')
  const [eLastName, setELastName] = useState('')
  const [eSex, setESex] = useState<'M' | 'F' | 'X'>('X')
  const [eVis, setEVis] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC')
  const [eNotes, setENotes] = useState('')

  function token() {
    return requireTokenOrRedirect()
  }

  async function search() {
    setMsg('Recherche...')
    const t = token()
    if (!t) return

    const res = await fetch('/api/members/search?q=' + encodeURIComponent(q), {
      headers: { Authorization: 'Bearer ' + t }
    })
    const data = await res.json()
    if (!res.ok) {
      setMsg('Erreur: ' + (data?.error || 'SEARCH_FAILED'))
      setResults([])
      return
    }
    setResults(data.results || [])
    setMsg('OK')
  }

  async function createMember(e: React.FormEvent) {
    e.preventDefault()
    setMsg('Création...')
    const t = token()
    if (!t) return

    const res = await fetch('/api/members/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
      body: JSON.stringify({
        firstName: cFirstName,
        lastName: cLastName,
        sex: cSex,
        visibility: cVis
      })
    })
    const data = await res.json()
    if (!res.ok) {
      setMsg('Erreur: ' + (data?.error || 'CREATE_FAILED'))
      return
    }
    setMsg('Créé: ' + data.id)
    setCFirstName('')
    setCLastName('')
    setCSex('X')
    setCVis('PUBLIC')
    setQ(data.firstName)
    await search()
  }

  function selectMember(m: Member) {
    setSelected(m)
    setEFirstName(m.firstName)
    setELastName(m.lastName)
    setESex(m.sex)
    setEVis(m.visibility)
    setENotes((m as any).notes || '')
  }

  async function updateSelected(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setMsg('Mise à jour...')
    const t = token()
    if (!t) return

    const res = await fetch('/api/members/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
      body: JSON.stringify({
        memberId: selected.id,
        firstName: eFirstName,
        lastName: eLastName,
        sex: eSex,
        visibility: eVis,
        notes: eNotes
      })
    })
    const data = await res.json()
    if (!res.ok) {
      setMsg('Erreur: ' + (data?.error || 'UPDATE_FAILED'))
      return
    }
    setMsg('OK')
    setSelected({
      id: data.id,
      firstName: data.firstName,
      lastName: data.lastName,
      sex: data.sex,
      visibility: data.visibility,
      notes: data.notes
    })
    await search()
  }

  async function deleteSelected() {
    if (!selected) return
    const ok = window.confirm('Supprimer ce membre ?')
    if (!ok) return

    setMsg('Suppression...')
    const t = token()
    if (!t) return

    const res = await fetch('/api/members/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
      body: JSON.stringify({ memberId: selected.id })
    })
    const data = await res.json()
    if (!res.ok) {
      setMsg('Erreur: ' + (data?.error || 'DELETE_FAILED'))
      return
    }
    setMsg('Supprimé')
    setSelected(null)
    await search()
  }

  useEffect(() => {
    search()
  }, [])

  return (
    <main style={{ maxWidth: 1100, margin: '30px auto', fontFamily: 'system-ui', padding: 12 }}>
      <h1 style={{ marginTop: 0 }}>Gestion des membres</h1>
      <p>
        Liens: <a href="/">/</a> | <a href="/tree">/tree</a> | <a href="/stats">/stats</a> | <a href="/admin">/admin</a>
      </p>

      <div style={{ marginBottom: 10, whiteSpace: 'pre-wrap' }}>{msg}</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <section style={{ border: '1px solid #ddd', padding: 12 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Rechercher</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Nom ou prénom" style={{ padding: 10, flex: 1 }} />
            <button onClick={search} style={{ padding: 10, cursor: 'pointer' }}>Chercher</button>
          </div>

          <h3 style={{ fontSize: 16 }}>Résultats</h3>
          <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid #eee' }}>
            {results.map(m => (
              <div
                key={m.id}
                onClick={() => selectMember(m)}
                style={{
                  padding: 10,
                  borderBottom: '1px solid #eee',
                  cursor: 'pointer',
                  background: selected?.id === m.id ? '#f5f5f5' : 'white'
                }}
              >
                <b>{m.firstName} {m.lastName}</b> — {m.sex} — {m.visibility}
              </div>
            ))}
            {results.length === 0 && <div style={{ padding: 10 }}>Aucun résultat.</div>}
          </div>
        </section>

        <section style={{ border: '1px solid #ddd', padding: 12 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Créer un membre</h2>
          <form onSubmit={createMember} style={{ display: 'grid', gap: 10 }}>
            <input value={cFirstName} onChange={e => setCFirstName(e.target.value)} placeholder="Prénom (obligatoire)" style={{ padding: 10 }} />
            <input value={cLastName} onChange={e => setCLastName(e.target.value)} placeholder="Nom (obligatoire)" style={{ padding: 10 }} />
            <select value={cSex} onChange={e => setCSex(e.target.value as any)} style={{ padding: 10 }}>
              <option value="M">M</option>
              <option value="F">F</option>
              <option value="X">X</option>
            </select>
            <select value={cVis} onChange={e => setCVis(e.target.value as any)} style={{ padding: 10 }}>
              <option value="PUBLIC">PUBLIC</option>
              <option value="PRIVATE">PRIVATE</option>
            </select>
            <button type="submit" style={{ padding: 10, cursor: 'pointer' }}>Créer</button>
          </form>
        </section>
      </div>

      <section style={{ border: '1px solid #ddd', padding: 12, marginTop: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Éditer le membre sélectionné</h2>
        {!selected && <div>Sélectionne un membre dans la liste.</div>}
        {selected && (
          <form onSubmit={updateSelected} style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
            <div><b>ID</b> {selected.id}</div>
            <input value={eFirstName} onChange={e => setEFirstName(e.target.value)} placeholder="Prénom" style={{ padding: 10 }} />
            <input value={eLastName} onChange={e => setELastName(e.target.value)} placeholder="Nom" style={{ padding: 10 }} />
            <select value={eSex} onChange={e => setESex(e.target.value as any)} style={{ padding: 10 }}>
              <option value="M">M</option>
              <option value="F">F</option>
              <option value="X">X</option>
            </select>
            <select value={eVis} onChange={e => setEVis(e.target.value as any)} style={{ padding: 10 }}>
              <option value="PUBLIC">PUBLIC</option>
              <option value="PRIVATE">PRIVATE</option>
            </select>
            <textarea value={eNotes} onChange={e => setENotes(e.target.value)} placeholder="Notes" rows={4} style={{ padding: 10 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" style={{ padding: 10, cursor: 'pointer' }}>Enregistrer</button>
              <button type="button" onClick={deleteSelected} style={{ padding: 10, cursor: 'pointer' }}>Supprimer</button>
            </div>
          </form>
        )}
      </section>
    </main>
  )
}
