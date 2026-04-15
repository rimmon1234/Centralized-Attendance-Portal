import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

const DEPARTMENTS = [
  { value: 'CSE', label: 'Computer Science & Engineering' },
  { value: 'IT', label: 'Information Technology' },
  { value: 'ECE', label: 'Electronics & Communication Engineering' },
  { value: 'EE', label: 'Electrical Engineering' },
  { value: 'ME', label: 'Mechanical Engineering' },
  { value: 'CE', label: 'Civil Engineering' },
]

const YEARS = ['1st', '2nd', '3rd', '4th']
const SECTIONS = ['A', 'B', 'C', 'D']

export default function OnboardingPage() {
  const { user, role, loading } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1) // 1 = role select, 2 = details
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Form state
  const [selectedRole, setSelectedRole] = useState(null)
  const [fullName, setFullName] = useState('')
  const [department, setDepartment] = useState('')
  const [year, setYear] = useState('')
  const [section, setSection] = useState('')
  const [rollNumber, setRollNumber] = useState('')
  const [employeeId, setEmployeeId] = useState('')

  // If already onboarded, redirect
  useEffect(() => {
    if (!loading && user && role) {
      navigate('/dashboard', { replace: true })
    }
    if (!loading && !user) {
      navigate('/auth', { replace: true })
    }
    // Pre-fill name from Google
    if (user?.user_metadata?.full_name) {
      setFullName(user.user_metadata.full_name)
    }
  }, [user, role, loading, navigate])

  async function handleSubmit() {
    setError(null)

    // Validation
    if (!fullName.trim()) return setError('Please enter your full name.')
    if (!department) return setError('Please select your department.')

    if (selectedRole === 'student') {
      if (!year) return setError('Please select your year.')
      if (!rollNumber.trim()) return setError('Please enter your roll number.')
    }
    if (selectedRole === 'teacher') {
      if (!employeeId.trim()) return setError('Please enter your employee ID.')
    }

    setSubmitting(true)

    try {
      // 1. Update profiles table with role and name
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          role: selectedRole,
          college_name: 'Heritage Institute of Technology',
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      // 2. Insert into role-specific table
      if (selectedRole === 'student') {
        const { error: studentError } = await supabase
          .from('student_profiles')
          .insert({
            profile_id: user.id,
            year_of_study: year,
            department,
            section: section || null,
            roll_number: rollNumber.trim(),
          })
        if (studentError) throw studentError
      }

      if (selectedRole === 'teacher') {
        const { error: teacherError } = await supabase
          .from('teacher_profiles')
          .insert({
            profile_id: user.id,
            department,
            employee_id: employeeId.trim(),
          })
        if (teacherError) throw teacherError
      }

      // 3. Redirect — role is now set so RoleRouter will pick it up
      navigate('/dashboard', { replace: true })

    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-8 flex flex-col gap-6">

        {/* Header */}
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            {step === 1 ? 'Welcome! Who are you?' : 'Fill in your details'}
          </h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            {step === 1
              ? 'This helps us show you the right dashboard.'
              : `Setting up your ${selectedRole} profile.`}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2">
          <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
          <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
        </div>

        {/* Step 1 — Role selection */}
        {step === 1 && (
          <div className="flex flex-col gap-3">
            {[
              { value: 'student', label: 'Student', desc: 'View attendance, notes and assignments' },
              { value: 'teacher', label: 'Teacher', desc: 'Take attendance, upload notes and assignments' },
            ].map((r) => (
              <button
                key={r.value}
                onClick={() => setSelectedRole(r.value)}
                className={`w-full text-left px-4 py-4 rounded-xl border transition-colors ${
                  selectedRole === r.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <p className={`text-sm font-medium ${selectedRole === r.value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'}`}>
                  {r.label}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {r.desc}
                </p>
              </button>
            ))}

            <button
              onClick={() => setStep(2)}
              disabled={!selectedRole}
              className="mt-2 w-full py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2 — Details form */}
        {step === 2 && (
          <div className="flex flex-col gap-4">

            {/* Full name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Full name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Department */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select department</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>

            {/* Student-only fields */}
            {selectedRole === 'student' && (
              <>
                <div className="flex gap-3">
                  {/* Year */}
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Year
                    </label>
                    <select
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Year</option>
                      {YEARS.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>

                  {/* Section */}
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Section (optional)
                    </label>
                    <select
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">None</option>
                      {SECTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Roll number */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Roll number
                  </label>
                  <input
                    type="text"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    placeholder="e.g. 22052026"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            {/* Teacher-only fields */}
            {selectedRole === 'teacher' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Employee ID
                </label>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="e.g. TCH2024001"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => { setStep(1); setError(null) }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? 'Saving...' : 'Finish setup'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}