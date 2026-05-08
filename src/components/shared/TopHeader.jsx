import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { signOut } from '../../lib/auth'
import { createAnnouncement, getAnnouncements } from '../../lib/announcements'
import { apiFetch } from '../../lib/api'

function formatLocalDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isAnnouncementPinned(item) {
  if (!item?.pinnedUntil) return false
  return item.pinnedUntil >= formatLocalDateKey()
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightText(text, query) {
  const source = String(text || '')
  const trimmedQuery = query.trim()

  if (!trimmedQuery) return source

  const parts = trimmedQuery.split(/\s+/).filter(Boolean)
  if (!parts.length) return source

  const pattern = new RegExp(`(${parts.map(escapeRegExp).join('|')})`, 'ig')
  const segments = source.split(pattern)
  const lowerParts = parts.map((part) => part.toLowerCase())

  return segments.map((segment, index) => {
    if (!segment) return null
    if (lowerParts.includes(segment.toLowerCase())) {
      return (
        <mark
          key={`${segment}-${index}`}
          className="rounded bg-amber-200/80 px-0.5 text-inherit dark:bg-amber-400/30"
        >
          {segment}
        </mark>
      )
    }

    return segment
  })
}

export default function TopHeader({ title }) {
  const { user, role } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [newTitle, setNewTitle] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [newPinnedUntil, setNewPinnedUntil] = useState('')
  const [announcementSearch, setAnnouncementSearch] = useState('')
  const [posting, setPosting] = useState(false)
  const [studentLastSeenAt, setStudentLastSeenAt] = useState(null)
  const [profileFullName, setProfileFullName] = useState(null)

  const sortedAnnouncements = useMemo(() => {
    return [...announcements].sort((a, b) => {
      const aPinned = isAnnouncementPinned(a)
      const bPinned = isAnnouncementPinned(b)
      if (aPinned !== bPinned) return aPinned ? -1 : 1

      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    })
  }, [announcements])

  const visibleAnnouncements = useMemo(() => {
    const query = announcementSearch.trim().toLowerCase()
    if (!query) return sortedAnnouncements

    return sortedAnnouncements.filter((item) => {
      const title = String(item?.title || '').toLowerCase()
      const message = String(item?.message || '').toLowerCase()
      return title.includes(query) || message.includes(query)
    })
  }, [announcementSearch, sortedAnnouncements])

  const latestAnnouncementTime = useMemo(() => {
    if (!announcements.length) return null
    return announcements.reduce((latest, current) => {
      if (!current?.createdAt) return latest
      if (!latest) return current.createdAt
      return new Date(current.createdAt).getTime() > new Date(latest).getTime() ? current.createdAt : latest
    }, null)
  }, [announcements])

  const studentLastSeenKey = useMemo(() => {
    if (!user?.id) return null
    return `announcement:last-seen:${user.id}`
  }, [user?.id])

  const hasUnreadForStudent = useMemo(() => {
    if (role !== 'student') return false
    if (!latestAnnouncementTime) return false
    if (!studentLastSeenAt) return true
    return new Date(latestAnnouncementTime).getTime() > new Date(studentLastSeenAt).getTime()
  }, [role, latestAnnouncementTime, studentLastSeenAt])

  useEffect(() => {
    if (!user?.id) return

    if (studentLastSeenKey) {
      setStudentLastSeenAt(localStorage.getItem(studentLastSeenKey))
    }

    async function loadAnnouncements() {
      setLoading(true)
      setError(null)
      const { data, error: fetchError } = await getAnnouncements()
      if (fetchError) {
        setError(fetchError.message || 'Failed to load announcements.')
      }
      setAnnouncements(data || [])
      setLoading(false)
    }

    async function loadProfileName() {
      try {
        const resp = await apiFetch('/api/v1/profiles/me', { cache: false })
        const profile = resp?.data || resp?.data?.data || null
        if (profile?.full_name) setProfileFullName(profile.full_name)
      } catch (err) {
        // ignore
      }
    }

    loadAnnouncements()
    loadProfileName()
  }, [user?.id, studentLastSeenKey])

  async function handleSignOut() {
    try {
      await signOut()
    } catch (err) {
      console.error('Sign out error:', err)
    }
    localStorage.clear()
    sessionStorage.clear()
    window.location.href = '/auth'
  }

  const effectiveName = profileFullName || user?.user_metadata?.full_name || user?.email || ''

  const initials = (effectiveName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)) || '??'

  async function handleCreateAnnouncement() {
    if (!newTitle.trim() || !newMessage.trim()) {
      setError('Title and message are required.')
      return
    }

    if (newPinnedUntil && !/^\d{4}-\d{2}-\d{2}$/.test(newPinnedUntil)) {
      setError('Pinned until must be a valid date.')
      return
    }

    setPosting(true)
    setError(null)

    const { data, error: createError } = await createAnnouncement({
      title: newTitle.trim(),
      message: newMessage.trim(),
      pinnedUntil: newPinnedUntil || null,
    })

    if (createError || !data) {
      setError(createError?.message || 'Failed to publish announcement.')
      setPosting(false)
      return
    }

    setAnnouncements((prev) => [data, ...prev])
    setNewTitle('')
    setNewMessage('')
    setNewPinnedUntil('')
    setPosting(false)
  }

  function toggleAnnouncements() {
    const next = !isOpen
    setIsOpen(next)

    if (next && role === 'student' && studentLastSeenKey && latestAnnouncementTime) {
      localStorage.setItem(studentLastSeenKey, latestAnnouncementTime)
      setStudentLastSeenAt(latestAnnouncementTime)
    }
  }

  return (
    <header className="h-14 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between px-6 shrink-0">
      <h1 className="text-sm font-semibold text-gray-800 dark:text-white">
        {title}
      </h1>
      <div className="flex items-center gap-3 relative">
        <button
          type="button"
          onClick={toggleAnnouncements}
          className="relative h-9 w-9 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center"
          title="Announcements"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path d="M3 10v4a1 1 0 0 0 1 1h3l6 3V6L7 9H4a1 1 0 0 0-1 1z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16 8c1 1 1 3 0 4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M18.5 6.5c2 2 2 5 0 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {hasUnreadForStudent && (
            <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-red-500" />
          )}
        </button>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleSignOut}
            className="text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 px-3 py-1.5 rounded-lg font-medium transition-colors border border-red-100 dark:border-red-900/30"
          >
            Sign out
          </button>
          <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-xs font-semibold flex items-center justify-center border border-blue-100 dark:border-blue-900">
            {initials}
          </div>
        </div>

        {isOpen && (
          <div className="absolute top-12 right-0 z-40 w-[min(28rem,88vw)] max-h-[70vh] overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800 dark:text-white">Announcements</p>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
              >
                Close
              </button>
            </div>

            {(role === 'teacher' || role === 'admin') && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800/50 flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Create announcement</p>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Title"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                />
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Write announcement..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm resize-none"
                />
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                    Extra class date / pin until
                  </label>
                  <input
                    type="date"
                    value={newPinnedUntil}
                    onChange={(e) => setNewPinnedUntil(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                  />
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">
                    Use this to pin an extra-class notice until the class date passes.
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  {error ? <p className="text-xs text-red-500">{error}</p> : <span />}
                  <button
                    type="button"
                    onClick={handleCreateAnnouncement}
                    disabled={posting}
                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                  >
                    {posting ? 'Publishing...' : 'Publish'}
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
              <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                Search announcements
              </label>
              <input
                type="text"
                value={announcementSearch}
                onChange={(e) => setAnnouncementSearch(e.target.value)}
                placeholder="Search by title or description"
                className="mt-1 w-full bg-transparent text-sm text-gray-800 dark:text-white placeholder:text-gray-400 outline-none"
              />
            </div>

            {loading ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">Loading announcements...</p>
            ) : visibleAnnouncements.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {announcementSearch.trim() ? 'No matching announcements.' : 'No announcements yet.'}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {visibleAnnouncements.map((item) => (
                  <article key={item.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-900/80">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-800 dark:text-white">
                        {highlightText(item.title, announcementSearch)}
                      </p>
                      {isAnnouncementPinned(item) && (
                        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                          Pinned
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">
                      {highlightText(item.message, announcementSearch)}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-2">
                      {item.createdBy?.name || 'Staff'}
                      {item.createdBy?.role ? ` (${item.createdBy.role})` : ''}
                      {' · '}
                      {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                      {item.pinnedUntil ? ` · pinned until ${new Date(`${item.pinnedUntil}T00:00:00`).toLocaleDateString()}` : ''}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}