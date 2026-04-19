import { useState, useEffect } from 'react'
import AppLayout from '../../components/shared/AppLayout'
import { apiFetch } from '../../lib/api'

export default function AdminAssignCourses() {
  const [teachers, setTeachers] = useState([])
  const [sections, setSections] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [courses, setCourses] = useState([])
  const [selectedCourse, setSelectedCourse] = useState('')

  useEffect(() => {
    fetchTeachers()
    fetchCourses()
  }, [])

  useEffect(() => {
    if (selectedTeacher) {
      fetchTeacherAssignments()
    }
  }, [selectedTeacher])

  async function fetchTeachers() {
    try {
      const data = await apiFetch('/api/v1/admin/users?role=teacher')
      setTeachers(data.data || [])
    } catch (err) {
      setError(err.message)
      console.error('Error fetching teachers:', err)
    }
  }

  async function fetchCourses() {
    try {
      const data = await apiFetch('/api/v1/admin/courses')
      setCourses(data.data || [])
    } catch (err) {
      console.error('Error fetching courses:', err)
    }
  }

  async function fetchSections() {
    try {
      if (selectedCourse) {
        const data = await apiFetch(`/api/v1/admin/courses/${selectedCourse}/sections`)
        setSections(data.data || [])
      }
    } catch (err) {
      console.error('Error fetching sections:', err)
    }
  }

  async function fetchTeacherAssignments() {
    try {
      const data = await apiFetch(`/api/v1/admin/teacher-assignments?teacherId=${selectedTeacher}`)
      setAssignments(data.data || [])
    } catch (err) {
      console.error('Error fetching assignments:', err)
    }
  }

  useEffect(() => {
    if (selectedCourse) {
      fetchSections()
    }
  }, [selectedCourse])

  async function handleAssignCourse() {
    if (!selectedTeacher || !selectedSection) {
      setError('Please select both teacher and section')
      return
    }

    try {
      setLoading(true)
      await apiFetch(`/api/v1/admin/teacher-assignments`, {
        method: 'POST',
        body: JSON.stringify({
          teacherId: selectedTeacher,
          sectionId: selectedSection,
        }),
      })

      setSelectedSection('')
      setSelectedCourse('')
      setError(null)
      await fetchTeacherAssignments()
    } catch (err) {
      setError(err.message)
      console.error('Error assigning course:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleRemoveAssignment(assignmentId) {
    if (!window.confirm('Remove this assignment?')) return

    try {
      await apiFetch(`/api/v1/admin/teacher-assignments/${assignmentId}`, {
        method: 'DELETE',
      })
      await fetchTeacherAssignments()
    } catch (err) {
      setError(err.message)
      console.error('Error removing assignment:', err)
    }
  }

  return (
    <AppLayout title="Assign Courses to Teachers">
      <div style={{ width: '100%' }} className="flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Assign Courses to Teachers
          </h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Link teachers to course sections
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl px-4 py-3">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Teacher Selection */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Step 1: Select Teacher
          </h3>
          <select
            value={selectedTeacher}
            onChange={(e) => setSelectedTeacher(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Select Teacher --</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.fullName} ({teacher.email})
              </option>
            ))}
          </select>
        </div>

        {selectedTeacher && (
          <>
            {/* Course & Section Selection */}
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Step 2: Select Course & Section
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Course
                  </label>
                  <select
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                    className="w-full mt-2 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Course</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.code} - {course.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Section
                  </label>
                  <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    disabled={!selectedCourse}
                    className="w-full mt-2 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option value="">Select Section</option>
                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        Section {section.section} (Year {section.yearOfStudy})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleAssignCourse}
                disabled={loading || !selectedSection}
                className="w-full px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Assigning...' : 'Assign Course'}
              </button>
            </div>

            {/* Current Assignments */}
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Current Assignments
              </h3>

              {assignments.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  No assignments for this teacher yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-start justify-between bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 border border-gray-100 dark:border-gray-700"
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {assignment.course?.code} - {assignment.course?.name}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Section {assignment.section} • Year {assignment.yearOfStudy}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                          Students: {assignment.studentsEnrolled}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveAssignment(assignment.id)}
                        className="text-xs text-red-600 dark:text-red-400 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}