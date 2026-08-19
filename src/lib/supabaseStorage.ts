import { PersistStorage, StorageValue } from 'zustand/middleware'
import { supabase } from './supabase'

// Fallback to standard localStorage
const local = window.localStorage

// Cache to prevent excessive fetching
const memoryCache: Record<string, string> = {}

// Debounce timer for saving to Supabase
let saveTimeout: ReturnType<typeof setTimeout> | null = null
let pendingSave: Record<string, any> = {}

/**
 * A custom Zustand storage engine that writes to localStorage immediately
 * for extreme performance, and debounces writes to Supabase `app_state`.
 */
export function createSupabaseStorage<S>(_storeName: string): PersistStorage<S> {
  return {
    getItem: async (name: string): Promise<StorageValue<S> | null> => {
      // 1. Try memory cache first for instant rehydration if already loaded
      if (memoryCache[name]) {
        try {
          return JSON.parse(memoryCache[name])
        } catch (e) {
          console.error('Failed to parse memory cache:', e)
        }
      }

      // 2. See if we have a logged-in user
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        // Fetch from Supabase
        try {
          const { data, error } = await supabase
            .from('app_state')
            .select('state_data')

          if (!error && data && data.length > 0) {
            // Merge all accessible state data
            let mergedData: any = {}
            for (const row of data) {
              if (row.state_data && row.state_data[name]) {
                const remoteValue = row.state_data[name]
                const parsed = typeof remoteValue === 'string' ? JSON.parse(remoteValue) : remoteValue
                
                // For arrays like tournaments[], concatenate them
                // For objects, assign them
                if (Array.isArray(parsed) && Array.isArray(mergedData)) {
                  mergedData = [...mergedData, ...parsed]
                } else if (typeof parsed === 'object' && parsed !== null) {
                  // For Zustand, the root state is an object like { tournaments: [...], settings: {...} }
                  if (Object.keys(mergedData).length === 0) {
                    mergedData = { ...parsed }
                  } else {
                    // Deep merge properties (e.g. merge tournaments array, merge settings object)
                    for (const key in parsed) {
                      if (Array.isArray(parsed[key])) {
                        mergedData[key] = [...(mergedData[key] || []), ...parsed[key]]
                        // Deduplicate by ID if present
                        if (mergedData[key].length > 0 && mergedData[key][0]?.id) {
                          const seen = new Set()
                          mergedData[key] = mergedData[key].filter((item: any) => {
                            if (seen.has(item.id)) return false
                            seen.add(item.id)
                            return true
                          })
                        }
                      } else if (typeof parsed[key] === 'object' && parsed[key] !== null) {
                        mergedData[key] = { ...(mergedData[key] || {}), ...parsed[key] }
                      } else {
                        mergedData[key] = parsed[key]
                      }
                    }
                  }
                } else {
                  mergedData = parsed
                }
              }
            }

            if (Object.keys(mergedData).length > 0 || Array.isArray(mergedData)) {
              // Update local cache so we don't lose it if we go offline
              local.setItem(name, JSON.stringify(mergedData))
              memoryCache[name] = JSON.stringify(mergedData)
              
              return mergedData as StorageValue<S>
            }
          }
        } catch (err) {
          console.warn('Failed to fetch from Supabase, falling back to local:', err)
        }
      }

      // 3. Fallback to localStorage
      const localStr = local.getItem(name)
      if (localStr) {
        memoryCache[name] = localStr
        return JSON.parse(localStr) as StorageValue<S>
      }

      return null
    },

    setItem: async (name: string, value: StorageValue<S>): Promise<void> => {
      const str = JSON.stringify(value)
      
      // 1. Update local storage instantly
      local.setItem(name, str)
      memoryCache[name] = str

      // 2. Queue for remote sync
      pendingSave[name] = value

      if (saveTimeout) clearTimeout(saveTimeout)

      saveTimeout = setTimeout(async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return // Don't sync if not logged in

        try {
          // We need to fetch the existing state_data to merge it, or upsert it.
          // Supabase upsert on JSONB requires replacing the whole JSON object if we use standard insert.
          
          // First, get current state to merge
          const { data: existing } = await supabase
            .from('app_state')
            .select('state_data')
            .eq('user_id', session.user.id)
            .single()

          const currentState = existing?.state_data || {}
          const newState = { ...currentState, ...pendingSave }
          
          // Clear pending saves
          pendingSave = {}

          await supabase
            .from('app_state')
            .upsert({
              user_id: session.user.id,
              state_data: newState,
              updated_at: new Date().toISOString()
            })
            
        } catch (err) {
          console.error('Failed to sync state to Supabase:', err)
        }
      }, 2000) // 2-second debounce
    },

    removeItem: async (name: string): Promise<void> => {
      local.removeItem(name)
      delete memoryCache[name]
      
      // We could also remove it from Supabase, but typically Zustand doesn't call this
      // unless the store is being completely destroyed. We'll leave it in the cloud 
      // just in case for data safety, or you can implement deletion logic here.
    },
  }
}
