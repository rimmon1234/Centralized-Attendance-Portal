/**
 * Middleware to verify user has admin role
 * Must be used after requireAuth middleware
 */
export async function requireAdminRole(req, res, next) {
  try {
    const { data: profile, error } = await req.supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single()

    if (error || !profile) {
      return res.status(401).json({ error: 'User profile not found' })
    }

    if (profile.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    // Attach admin flag to request
    req.isAdmin = true
    next()
  } catch (err) {
    console.error('requireAdminRole middleware error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
