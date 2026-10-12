const TOKEN_KEY = 'pesanin_staff_token'
const USER_KEY = 'pesanin_staff_user'
const TOKEN_EXPIRY_KEY = 'pesanin_staff_token_expiry'

const DEFAULT_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

export function getStoredToken() {
  try {
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY)
    if (expiry && Date.now() > Number(expiry)) {
      clearStoredAuth()
      return null
    }
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setStoredToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + DEFAULT_TOKEN_TTL_MS))
  } catch {
    // abaikan jika localStorage tidak tersedia.
  }
}

export function getStoredUser() {
  try {
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY)
    if (expiry && Date.now() > Number(expiry)) {
      clearStoredAuth()
      return null
    }
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setStoredUser(user) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    // abaikan jika localStorage tidak tersedia.
  }
}

export function clearStoredAuth() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(TOKEN_EXPIRY_KEY)
  } catch {
    // abaikan jika localStorage tidak tersedia.
  }
}
