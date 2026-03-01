'use client'

import { useEffect, useState } from 'react'

function token() {
  return localStorage.getItem('geneasphere_token') || ''
}

export default function StatsPage() {
  const [data, setData] = useState<any>(null)
  const [msg, setMsg] = useState('')

  async function load() {
    setMsg('Chargement...')
    const t = token()
    if (!t) {
      setMsg('Pas de token. Va sur /login')
      setData(null)
      return
    }
    const res = await fetch('/api/stats', { headers: { Authorization: 'Bearer ' + t } })
    const json = await res.json()
    if (!res.ok) {
      setMsg('Erreur: ' + (json?.error || 'LOAD_FAILED'))
      setData(null)
      return
    }
    setData(json)
    setMsg('OK')
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <main style={{ maxWidth: 760, margin: '40px auto', fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 26 }}>Statistiques familiales</h1>
        <a href="/login">/login</a>
        <a href="/tree">/tree</a>
        <button onClick={load} style={{ padding: 8, cursor: 'pointer' }}>Rafraîchir</button>
      </div>

      <p style={{ whiteSpace: 'pre-wrap' }}>{msg}</p>

      {data && (
        <div style={{ border: '1px solid #ddd', padding: 14 }}>
          <div><b>Nombre total de membres</b> {data.totalMembers}</div>
          <div><b>Hommes</b> {data.men}</div>
          <div><b>Femmes</b> {data.women}</div>
          <div><b>Espérance de vie moyenne</b> {data.avgLifeExpectancy === null ? 'N/A' : data.avgLifeExpectancy + ' ans'}</div>
          <div><b>Nombre moyen d’enfants par génération</b> {data.avgChildrenPerGeneration}</div>
          <div><b>Nombre de générations</b> {data.generationsCount}</div>
        </div>
      )}
    </main>
  )
}
