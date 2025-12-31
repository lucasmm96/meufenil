import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

interface AuthContextType {
  authUser: User | null
  loadingAuth: boolean
  timezone: string
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)

  useEffect(() => {
    let mounted = true

    localStorage.removeItem('supabase.auth.token')

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setAuthUser(data.session?.user ?? null)
      setLoadingAuth(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return
        setAuthUser(session?.user ?? null)
        setLoadingAuth(false)
      }
    )

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    setAuthUser(null)
    localStorage.removeItem('supabase.auth.token')
  }

  return (
    <AuthContext.Provider
      value={{
        authUser,
        loadingAuth,
        timezone,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
