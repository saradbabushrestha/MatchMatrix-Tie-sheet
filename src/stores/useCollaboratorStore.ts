import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export interface Collaborator {
  tournament_id: string
  user_id: string
  role: 'editor' | 'viewer'
  created_at: string
  users?: {
    email: string
  }
}

interface CollaboratorState {
  collaborators: Record<string, Collaborator[]>
  isLoading: boolean
  
  fetchCollaborators: (tournamentId: string) => Promise<void>
  addCollaborator: (tournamentId: string, email: string, role?: 'editor' | 'viewer') => Promise<{ success: boolean; error?: string }>
  removeCollaborator: (tournamentId: string, userId: string) => Promise<{ success: boolean; error?: string }>
}

export const useCollaboratorStore = create<CollaboratorState>((set, get) => ({
  collaborators: {},
  isLoading: false,

  fetchCollaborators: async (tournamentId) => {
    set({ isLoading: true })
    const { data, error } = await supabase
      .from('tournament_collaborators')
      .select('*, users(email)')
      .eq('tournament_id', tournamentId)

    if (!error && data) {
      set((s) => ({
        collaborators: { ...s.collaborators, [tournamentId]: data },
        isLoading: false
      }))
    } else {
      set({ isLoading: false })
    }
  },

  addCollaborator: async (tournamentId, email, role = 'editor') => {
    // Look up user by email via edge function or direct query if allowed
    // Note: Due to privacy, querying auth.users is restricted. 
    // We assume the backend has a secure way to do this or users are synced to a public profile table.
    // For this prototype, we'll use a mocked lookup or direct query if RLS allows.
    
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (userError || !user) {
      return { success: false, error: 'User not found. They must sign up first.' }
    }

    const { error } = await supabase
      .from('tournament_collaborators')
      .insert({
        tournament_id: tournamentId,
        user_id: user.id,
        role
      })

    if (error) {
      return { success: false, error: error.message }
    }

    await get().fetchCollaborators(tournamentId)
    return { success: true }
  },

  removeCollaborator: async (tournamentId, userId) => {
    const { error } = await supabase
      .from('tournament_collaborators')
      .delete()
      .match({ tournament_id: tournamentId, user_id: userId })

    if (error) {
      return { success: false, error: error.message }
    }

    await get().fetchCollaborators(tournamentId)
    return { success: true }
  }
}))
