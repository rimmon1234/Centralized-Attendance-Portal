import { useState, useEffect } from 'react'
import { getRole, getUser, onAuthStateChange } from '../lib/auth'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(() => localStorage.getItem('role'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let initDone = false

    async function init() {
      try {
        const { user } = await getUser()
        if (!mounted) return

        if (user) {
          setUser(user)
          const freshRole = await getRole()
          if (!mounted) return
          // Only update role if we got a fresh value; keep localStorage cache if fetch returns null
          if (freshRole) {
            setRole(freshRole)
            localStorage.setItem('role', freshRole)
          } else {
            // getRole() returned null — keep existing role from localStorage or set null if none exists
            const cached = localStorage.getItem('role')
            setRole(cached)
            if (!cached) localStorage.removeItem('role')
          }
        } else {
          setUser(null)
          setRole(null)
          localStorage.removeItem('role')
        }
      } catch (err) {
        console.error('useAuth init error:', err)
      } finally {
        initDone = true
        if (mounted) setLoading(false)
      }
    }

    init()

    const { data: listener } = onAuthStateChange(async (session) => {
      // Don't let the listener interfere while init() is still running
      if (!initDone) return
      if (!mounted) return

      if (session?.user) {
        setUser(session.user)
        const freshRole = await getRole()
        if (!mounted) return
        // Only update role if we got a fresh value; keep localStorage cache if fetch returns null
        if (freshRole) {
          setRole(freshRole)
          localStorage.setItem('role', freshRole)
        } else {
          // getRole() returned null — keep existing role from localStorage or set null if none exists
          const cached = localStorage.getItem('role')
          setRole(cached)
          if (!cached) localStorage.removeItem('role')
        }
      } else {
        setUser(null)
        setRole(null)
        localStorage.removeItem('role')
      }
      if (mounted) setLoading(false)
    })

    return () => {
      mounted = false
      listener?.subscription?.unsubscribe()
    }
  }, [])

  return { user, role, loading }
}