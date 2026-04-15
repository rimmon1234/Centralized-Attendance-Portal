import { useState, useEffect } from 'react'
import AppLayout from '../../components/shared/AppLayout'
import AttendanceRings from '../../components/student/AttendanceRings'
import { getMyAttendanceSummaryByType } from '../../lib/attendance'

export default function StudentDashboard() { 
  const [lectureData, setLectureData] = useState([])
  const [labData, setLabData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const [lectureRes, labRes] = await Promise.all([
          getMyAttendanceSummaryByType('lecture'),
          getMyAttendanceSummaryByType('lab'),
        ])

        if (lectureRes.error) console.warn('Lecture fetch error:', lectureRes.error)
        if (labRes.error) console.warn('Lab fetch error:', labRes.error)

        setLectureData(lectureRes.data || [])
        setLabData(labRes.data || [])
      } catch (err) {
        console.warn('Attendance fetch issue:', err)
        // Don't show error state — just show empty data
        setLectureData([])
        setLabData([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return (
    <AppLayout title="Student Dashboard">
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Welcome Back, Student!</h2>
          <p className="text-gray-500">Here is an overview of your current attendance status across all subjects.</p>
        </div>

        {loading ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                border: '3px solid rgba(99,102,241,0.15)',
                borderTopColor: '#6366f1',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <p style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 500 }}>
                Loading attendance data...
              </p>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          </div>
        ) : error ? (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: '#f87171',
            fontSize: '14px',
            fontWeight: 500,
            background: 'rgba(248,113,113,0.06)',
            borderRadius: '16px',
            border: '1px solid rgba(248,113,113,0.15)',
          }}>
            Failed to load attendance data. Please try again.
          </div>
        ) : (lectureData.length === 0 && labData.length === 0) ? (
          <div style={{
            padding: '60px 20px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '15px', color: '#64748b', fontWeight: 500 }}>
              No attendance data available yet.
            </p>
            <p style={{ fontSize: '13px', color: '#475569', marginTop: '6px' }}>
              Attendance records will appear here once your instructors start marking.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-8 items-start">
            {lectureData.length > 0 && (
              <AttendanceRings title="Lecture Attendance" subjects={lectureData} detailsPath="/lectures" />
            )}
            {labData.length > 0 && (
              <AttendanceRings title="Lab Attendance" subjects={labData} detailsPath="/labs" />
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
