import { useState } from 'react'
import AppLayout from '../../components/shared/AppLayout'

const assignments = [
  { id: 1, title: 'Linked List Implementation', course: 'Data Structures', due: 'Apr 18, 2026', submissions: 34, total: 58 },
  { id: 2, title: 'Sorting Algorithm Analysis', course: 'Algorithms', due: 'Apr 20, 2026', submissions: 12, total: 54 },
  { id: 3, title: 'ER Diagram Design', course: 'DBMS', due: 'Apr 22, 2026', submissions: 0, total: 60 },
]

export default function TeacherAssignments() {
  const [tab, setTab] = useState('active')

  return (
    <AppLayout title="Assignments">
      <div style={{ width: '100%' }} className="flex flex-col gap-8">

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
          {['active', 'past'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                tab === t
                  ? 'bg-white dark:bg-gray-900 text-gray-800 dark:text-white shadow-sm'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Create button */}
        <button className="self-start text-sm px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors">
          + New assignment
        </button>

        {/* Assignment list */}
        <div className="flex flex-col gap-3">
          {assignments.map((a) => (
            <div
              key={a.id}
              className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-white">
                    {a.title}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {a.course} · Due {a.due}
                  </p>
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {a.submissions}/{a.total} submitted
                </span>
              </div>

              {/* Submission progress */}
              <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-400 rounded-full"
                  style={{ width: `${(a.submissions / a.total) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}

//just checking if the file is being tracked by git