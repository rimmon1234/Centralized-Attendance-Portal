import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabase.js'

const router = Router()
const MAX_MESSAGE_LENGTH = 1200
const MAX_TITLE_LENGTH = 120

function normalizePinnedUntil(value) {
  if (value == null || value === '') return null
  const text = String(value).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  return text
}

async function getCurrentUserRole(supabase, userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', userId)
    .single()

  if (error || !data) return null
  return data
}

router.get('/', async (req, res) => {
  try {
    const db = supabaseAdmin || req.supabase

    const { data: announcementRows, error } = await db
      .from('announcements')
      .select('id, title, message, created_at, created_by, pinned_until')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    const createdByIds = [...new Set((announcementRows || []).map((a) => a.created_by).filter(Boolean))]

    let profileMap = {}
    if (createdByIds.length > 0) {
      const { data: profileRows } = await db
        .from('profiles')
        .select('id, full_name, role')
        .in('id', createdByIds)

      profileMap = Object.fromEntries(
        (profileRows || []).map((profile) => [profile.id, profile])
      )
    }

    const data = (announcementRows || []).map((row) => ({
      id: row.id,
      title: row.title,
      message: row.message,
      createdAt: row.created_at,
      pinnedUntil: row.pinned_until,
      createdBy: {
        id: row.created_by,
        name: profileMap[row.created_by]?.full_name || 'Staff Member',
        role: profileMap[row.created_by]?.role || null,
      },
    }))

    return res.json({ data })
  } catch (err) {
    console.error('GET /announcements error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/', async (req, res) => {
  try {
    const userProfile = await getCurrentUserRole(req.supabase, req.user.id)

    if (!userProfile) {
      return res.status(403).json({ error: 'Profile not found' })
    }

    if (userProfile.role !== 'teacher' && userProfile.role !== 'admin') {
      return res.status(403).json({ error: 'Only teachers and admins can create announcements' })
    }

    const title = String(req.body?.title || '').trim()
    const message = String(req.body?.message || '').trim()
    const pinnedUntil = normalizePinnedUntil(req.body?.pinnedUntil)

    if (!title || !message) {
      return res.status(400).json({ error: 'title and message are required' })
    }

    if (title.length > MAX_TITLE_LENGTH) {
      return res.status(400).json({ error: `Title can be at most ${MAX_TITLE_LENGTH} characters` })
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Message can be at most ${MAX_MESSAGE_LENGTH} characters` })
    }

    const db = supabaseAdmin || req.supabase

    const { data: createdRow, error } = await db
      .from('announcements')
      .insert({
        title,
        message,
        created_by: req.user.id,
        pinned_until: pinnedUntil,
      })
      .select('id, title, message, created_at, created_by, pinned_until')
      .single()

    if (error || !createdRow) {
      return res.status(400).json({ error: error?.message || 'Failed to create announcement' })
    }

    return res.status(201).json({
      data: {
        id: createdRow.id,
        title: createdRow.title,
        message: createdRow.message,
        createdAt: createdRow.created_at,
        pinnedUntil: createdRow.pinned_until,
        createdBy: {
          id: createdRow.created_by,
          name: userProfile.full_name || 'Staff Member',
          role: userProfile.role,
        },
      },
    })
  } catch (err) {
    console.error('POST /announcements error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router