export function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('geneasphere_token') || ''
}

export function requireTokenOrRedirect() {
  if (typeof window === 'undefined') return ''
  const t = localStorage.getItem('geneasphere_token') || ''
  if (!t) {
    window.location.href = '/login'
    return ''
  }
  return t
}
