import AppLayout from '../../components/shared/AppLayout'
import { useEffect, useMemo, useState } from 'react'
import { getMyAssignments } from '../../lib/assignments'
import SpiralLoader from '../../components/shared/Loader'

export default function StudentAssignments() {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await getMyAssignments()
      if (fetchError) {
        setError(fetchError.message || 'Failed to load assignments.')
        setAssignments([])
      } else {
        setAssignments(data || [])
      }

      setLoading(false)
    }

    load()
  }, [])

  const groupedByCourse = useMemo(() => {
    const map = {}
    for (const assignment of assignments) {
      const courseCode = assignment.course?.code || 'N/A'
      const courseName = assignment.course?.name || 'Unknown Course'
      const key = `${courseCode}__${courseName}`
      if (!map[key]) {
        map[key] = {
          courseCode,
          courseName,
          items: [],
        }
      }
      map[key].items.push(assignment)
    }

    return Object.values(map).sort((a, b) =>
      `${a.courseCode}${a.courseName}`.localeCompare(`${b.courseCode}${b.courseName}`)
    )
  }, [assignments])

  function toggleQuestions(assignmentId) {
    setExpanded((prev) => ({
      ...prev,
      [assignmentId]: !prev[assignmentId],
    }))
  }

  return (
    <AppLayout title="Assignments">
      <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto p-2">
        <div className="bg-gray-50 dark:bg-gray-800/60 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700/50">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Course Assignments</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Read-only view: you can open assignment questions only when your attendance in that course is at least 75%.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <SpiralLoader />
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-100 dark:border-red-800/30 text-center text-sm font-medium">
            {error}
          </div>
        ) : groupedByCourse.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-12 text-center shadow-sm mt-2">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">No assignments available yet.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedByCourse.map((group) => (
              <section key={`${group.courseCode}-${group.courseName}`} className="space-y-4">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider pl-1">
                  {group.courseCode} — {group.courseName}
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {group.items
                    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                    .map((assignment) => {
                      const isOpen = !!expanded[assignment.id]
                      const isLocked = !assignment.isAccessible
                      const attendancePercent = assignment.attendance?.percentage ?? 0

                      return (
                        <article
                          key={assignment.id}
                          className={`rounded-2xl p-5 border transition-all ${
                            isLocked
                              ? 'bg-gray-50 dark:bg-gray-800/70 border-gray-200 dark:border-gray-700'
                              : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">{assignment.title}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Assigned by {assignment.teacher?.name || 'Assigned Teacher'}
                              </p>
                            </div>

                            {isLocked ? (
                              <span
                                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/40"
                                title="Locked due to attendance below 75%"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                Blocked
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-900/40">
                                Accessible
                              </span>
                            )}
                          </div>

                          {assignment.description ? (
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-3 leading-relaxed">
                              {assignment.description}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-400 dark:text-gray-500 mt-3 italic">No description provided.</p>
                          )}

                          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                            <div className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white/60 dark:bg-gray-900/50">
                              <p className="text-gray-500 dark:text-gray-400">Questions</p>
                              <p className="text-gray-900 dark:text-white font-semibold mt-0.5">
                                {assignment.questions?.length ?? assignment.questionCount ?? 0}
                              </p>
                            </div>
                            <div className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white/60 dark:bg-gray-900/50">
                              <p className="text-gray-500 dark:text-gray-400">Attendance</p>
                              <p className={`font-semibold mt-0.5 ${isLocked ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                {attendancePercent}%
                              </p>
                            </div>
                          </div>

                          {isLocked ? (
                            <div className="mt-4 rounded-xl border border-red-100 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/20 px-3 py-2">
                              <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                                {assignment.blockedReason || 'Minimum 75% attendance required in this course to access this assignment.'}
                              </p>
                            </div>
                          ) : (
                            <div className="mt-4">
                              <button
                                onClick={() => toggleQuestions(assignment.id)}
                                className="text-xs px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors"
                              >
                                {isOpen ? 'Hide Questions' : 'View Questions'}
                              </button>

                              {isOpen && (
                                <div className="mt-3 space-y-2">
                                  {assignment.questions?.length ? (
                                    assignment.questions.map((q, idx) => (
                                      <div
                                        key={q.id || `${assignment.id}-${idx}`}
                                        className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-3 py-2"
                                      >
                                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Q{idx + 1}</p>
                                        <p className="text-sm text-gray-800 dark:text-gray-200 mt-1">{q.text}</p>
                                        {(q.topic || q.difficulty) && (
                                          <div className="flex gap-2 mt-2">
                                            {q.topic && (
                                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300">
                                                {q.topic}
                                              </span>
                                            )}
                                            {q.difficulty && (
                                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300">
                                                {q.difficulty}
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    ))
                                  ) : (
                                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-3 py-3">
                                      <p className="text-xs text-gray-500 dark:text-gray-400">No questions linked to this assignment yet.</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </article>
                      )
                    })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
