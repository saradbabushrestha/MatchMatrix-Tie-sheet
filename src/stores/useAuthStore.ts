import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  authModalOpen: boolean
  setUser: (user: User | null, session: Session | null) => void
  setLoading: (loading: boolean) => void
  setAuthModalOpen: (open: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  authModalOpen: false,
  setUser: (user, session) => set({ user, session, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  setAuthModalOpen: (authModalOpen) => set({ authModalOpen })
}))
