import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import { log } from "console";

interface AuthContextType {
  authUser: User | null
  loadingAuth: boolean
  timezone: string
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  useEffect(() => {
    let mounted = true

    async function initAuth() {
      try {
        const { data, error } = await supabase.auth.getSession()

        console.log(data);
        console.log(error);
        
        // sessão inválida ou erro → limpa tudo
        if (error || !data.session) {
          await supabase.auth.signOut()
          localStorage.removeItem('supabase.auth.token')

          if (!mounted) return
          setAuthUser(null)
          setLoadingAuth(false)
          return
        }

        // sessão válida
        if (!mounted) return
        setAuthUser(data.session.user)
        setLoadingAuth(false)

      } catch {
        // qualquer erro inesperado → fallback seguro
        await supabase.auth.signOut()
        localStorage.removeItem('supabase.auth.token')

        if (!mounted) return
        setAuthUser(null)
        setLoadingAuth(false)
      }
    }

    initAuth()

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
    localStorage.removeItem('supabase.auth.token')
    setAuthUser(null)
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
