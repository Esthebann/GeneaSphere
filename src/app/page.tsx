export default function HomePage() {
  return (
    <main style={{ maxWidth: 820, margin: '50px auto', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 34, marginBottom: 10 }}>GeneaSphere</h1>
      <p style={{ marginTop: 0 }}>
        Application de gestion d’arbre généalogique intelligent (Next.js + API REST + MongoDB + JWT + RBAC).
      </p>

      <div style={{ display: 'grid', gap: 12, marginTop: 24 }}>
        <a href="/login" style={linkStyle}>Connexion / Token</a>
        <a href="/tree" style={linkStyle}>Arbre généalogique (SVG)</a>
        <a href="/stats" style={linkStyle}>Statistiques</a>
        <a href="/admin" style={linkStyle}>Administration (validation utilisateurs)</a>
      </div>

      <div style={{ marginTop: 28, padding: 12, border: '1px solid #ddd' }}>
        <p style={{ marginTop: 0, marginBottom: 8 }}>
          Démo rapide:
        </p>
        <ol style={{ marginTop: 0 }}>
          <li>Aller sur /login, se connecter (token sauvegardé)</li>
          <li>Aller sur /tree pour visualiser l’arbre</li>
          <li>Aller sur /stats pour voir les statistiques dynamiques</li>
        </ol>
      </div>
    </main>
  )
}

const linkStyle: React.CSSProperties = {
  padding: 14,
  border: '1px solid #ddd',
  textDecoration: 'none',
  color: 'black',
  borderRadius: 6
}
