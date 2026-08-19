import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/useAuthStore'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser } = useAuthStore()

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null, session)
    })

    // Listen for changes on auth state (sign in, sign out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null, session)
    })

    return () => subscription.unsubscribe()
  }, [setUser])

  return <>{children}</>
}
