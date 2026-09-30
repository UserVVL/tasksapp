import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { getMe, login as apiLogin, type User, type LoginData } from "../api/auth"

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (data: LoginData) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (token) {
      getMe()
        .then(setUser)
        .catch(() => setUser(null))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    function onAuthExpired() {
      setUser(null)
    }
    window.addEventListener("auth:expired", onAuthExpired)
    return () => window.removeEventListener("auth:expired", onAuthExpired)
  }, [])

  async function login(data: LoginData) {
    const token = await apiLogin(data)
    localStorage.setItem("token", token.access_token)
    const me = await getMe()
    setUser(me)
  }

  function logout() {
    localStorage.removeItem("token")
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be inside AuthProvider")
  return ctx
}
