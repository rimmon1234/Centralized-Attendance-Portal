import { useState, useEffect } from 'react'
import AppLayout from '../../components/shared/AppLayout'
import { apiFetch } from '../../lib/api'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true)
        const data = await apiFetch('/api/v1/admin/stats')
        setStats(data.data)
      } catch (err) {
        setError(err.message || 'Failed to load statistics')
        console.error('Error fetching admin stats:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <AppLayout title="Admin Dashboard">
        <div style={{ width: '100%' }} className="flex flex-col gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      </AppLayout>
    )
  }

  if (error) {
    return (
      <AppLayout title="Admin Dashboard">
        <div style={{ width: '100%' }} className="flex flex-col gap-6">
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl px-5 py-4">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  const StatCard = ({ label, value, subtext, color = 'blue' }) => {
    const colorClasses = {
      blue: 'bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30 text-blue-600 dark:text-blue-400',
      green: 'bg-green-50 dark:bg-green-950/20 border-green-100 dark:border-green-900/30 text-green-600 dark:text-green-400',
      amber: 'bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30 text-amber-600 dark:text-amber-400',
      red: 'bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400',
    }

    return (
      <div className={`border rounded-2xl px-5 py-6 ${colorClasses[color]}`}>
        <p className="text-xs font-medium opacity-75">{label}</p>
        <p className="text-3xl font-bold mt-2">{value}</p>
        {subtext && <p className="text-xs opacity-60 mt-1">{subtext}</p>}
      </div>
    )
  }

  return (
    <AppLayout title="Admin Dashboard">
      <div style={{ width: '100%' }} className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">System Overview</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Real-time statistics and alerts</p>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Students"
            value={stats?.totalStudents || 0}
            color="blue"
          />
          <StatCard
            label="Total Teachers"
            value={stats?.totalTeachers || 0}
            color="green"
          />
          <StatCard
            label="Total Courses"
            value={stats?.totalCourses || 0}
            color="amber"
          />
          <StatCard
            label="Class Sections"
            value={stats?.totalSections || 0}
            color="blue"
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            label="Sessions Today"
            value={stats?.sessionsToday || 0}
            subtext="Attendance sessions scheduled"
            color="green"
          />
          <StatCard
            label="Low Attendance Alerts"
            value={stats?.lowAttendanceAlerts || 0}
            subtext="Students below 75% attendance"
            color="red"
          />
        </div>

        {/* Role Distribution */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">User Roles Distribution</h3>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.roleDistribution?.students || 0}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Students</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.roleDistribution?.teachers || 0}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Teachers</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.roleDistribution?.admins || 0}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Admins</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            <a
              href="/users"
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
            >
              Manage Users
            </a>
            <a
              href="/courses"
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-green-600 dark:text-green-400 border border-green-100 dark:border-green-900/30 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors"
            >
              Manage Courses
            </a>
            <a
              href="/assign-courses"
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-colors"
            >
              Assign Courses
            </a>
            <a
              href="/schedule"
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-colors"
            >
              Schedule Management
            </a>
            <a
              href="/attendance"
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors"
            >
              View Attendance Report
            </a>
            <a
              href="/alerts"
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
            >
              View Alerts
            </a>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
