import { NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const studentLinks = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/schedule', label: 'Schedule' },
  { to: '/assignments', label: 'Assignments' },
  { to: '/notes', label: 'Notes' },
  { to: '/contacts', label: 'Contacts' },
]

const teacherLinks = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/courses', label: 'My Courses' },
  { to: '/attendance', label: 'Attendance' },
  { to: '/assignments', label: 'Assignments' },
  { to: '/notes', label: 'Notes' },
]

const adminLinks = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/departments', label: 'Departments' },
  { to: '/courses', label: 'Courses' },
  { to: '/users', label: 'Users' },
  { to: '/attendance', label: 'Attendance' },
  { to: '/alerts', label: 'Alerts' },
]

const linksByRole = {
  student: studentLinks,
  teacher: teacherLinks,
  admin: adminLinks,
}

export default function Sidebar() {
  const { role } = useAuth()
  const links = linksByRole[role] || []

  return (
    <aside className="hidden md:flex flex-col w-52 shrink-0 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 py-6 px-3">
      {/* Logo */}
      <div className="px-3 mb-8">
        <p className="text-xs font-semibold text-gray-800 dark:text-white leading-tight">
          Heritage Institute
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Attendance Portal
        </p>
      </div>

      {/* Role badge */}
      <div className="px-3 mb-4">
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900 capitalize">
          {role}
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex flex-col gap-0.5">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}