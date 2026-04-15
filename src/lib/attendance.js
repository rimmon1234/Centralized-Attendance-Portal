import { supabase } from './supabase'
import { getMyTeacherProfile, getMyStudentProfile } from './profile'

// Create a new attendance session for a class
export async function createAttendanceSession(classSectionId, sessionType = 'regular') {
  const { data: teacherProfile } = await getMyTeacherProfile()
  if (!teacherProfile) return { data: null, error: new Error('No teacher profile') }

  // Check if session already exists for today
  const today = new Date().toISOString().split('T')[0]
  const { data: existing } = await supabase
    .from('attendance_sessions')
    .select('id')
    .eq('class_section_id', classSectionId)
    .eq('session_date', today)
    .single()

  if (existing) {
    return { data: existing, error: new Error('Session already exists for today') }
  }

  const { data, error } = await supabase
    .from('attendance_sessions')
    .insert({
      class_section_id: classSectionId,
      teacher_id: teacherProfile.id,
      session_date: today,
      session_type: sessionType,
    })
    .select()
    .single()

  return { data, error }
}

// Submit attendance records for a session
// attendanceMap = { studentProfileId: 'present' | 'absent' | 'late' }
export async function submitAttendanceRecords(sessionId, attendanceMap) {
  const records = Object.entries(attendanceMap).map(([studentId, status]) => ({
    session_id: sessionId,
    student_id: studentId,
    status,
  }))

  const { data, error } = await supabase
    .from('attendance_records')
    .upsert(records, { onConflict: 'session_id,student_id' })
    .select()

  return { data, error }
}

// Get all sessions for a class section
export async function getSessionsForSection(classSectionId) {
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select('*')
    .eq('class_section_id', classSectionId)
    .order('session_date', { ascending: false })

  return { data, error }
}

// Get attendance records for a specific session
export async function getRecordsForSession(sessionId) {
  const { data, error } = await supabase
    .from('attendance_records')
    .select(`
      *,
      student_profiles (
        id,
        roll_number,
        profiles (
          full_name
        )
      )
    `)
    .eq('session_id', sessionId)

  return { data, error }
}

// Get a student's attendance summary across all their enrolled sections
export async function getMyAttendanceSummary() {
  let studentProfile
  try {
    const result = await getMyStudentProfile()
    studentProfile = result.data
  } catch (e) {
    return { data: [], error: null }
  }
  if (!studentProfile) return { data: [], error: null }

  const { data: enrollments, error } = await supabase
    .from('enrollments')
    .select(`
      class_section_id,
      class_sections (
        courses ( name, code )
      )
    `)
    .eq('student_id', studentProfile.id)

  if (error) return { data: [], error }

  // For each enrollment, count total sessions and present count
  const summaries = await Promise.all(
    enrollments.map(async (enrollment) => {
      const { data: sessions } = await supabase
        .from('attendance_sessions')
        .select('id')
        .eq('class_section_id', enrollment.class_section_id)

      const sessionIds = sessions?.map((s) => s.id) || []

      if (sessionIds.length === 0) {
        return {
          classSectionId: enrollment.class_section_id,
          courseName: enrollment.class_sections.courses.name,
          courseCode: enrollment.class_sections.courses.code,
          totalClasses: 0,
          present: 0,
          percentage: 0,
        }
      }

      const { data: records } = await supabase
        .from('attendance_records')
        .select('status')
        .eq('student_id', studentProfile.id)
        .in('session_id', sessionIds)

      const present = records?.filter((r) => r.status === 'present').length || 0

      return {
        classSectionId: enrollment.class_section_id,
        courseName: enrollment.class_sections.courses.name,
        courseCode: enrollment.class_sections.courses.code,
        totalClasses: sessionIds.length,
        present,
        percentage: sessionIds.length > 0
          ? Math.round((present / sessionIds.length) * 100)
          : 0,
      }
    })
  )

  return { data: summaries, error: null }
}

// Calculate safe skips remaining for a student in a section
// Safe skip = how many more classes they can miss and still stay above 75%
export function calculateSafeSkips(totalClasses, presentCount, threshold = 75) {
  const future = totalClasses
  let safeSkips = 0
  let t = totalClasses
  let p = presentCount

  while (true) {
    t += 1
    const pct = (p / t) * 100
    if (pct < threshold) break
    safeSkips += 1
    if (safeSkips > 50) break
  }

  return safeSkips
}

// Predict attendance % after N future absences or presences
export function predictAttendance(totalClasses, presentCount, futurePresent, futureAbsent) {
  const newTotal = totalClasses + futurePresent + futureAbsent
  const newPresent = presentCount + futurePresent
  if (newTotal === 0) return 0
  return Math.round((newPresent / newTotal) * 100)
}


// ─── Helpers ────────────────────────────────────────────────────

// Format a time string like "09:00:00" into "9 AM"
function formatTime(timeStr) {
  if (!timeStr) return ''
  const [hours, minutes] = timeStr.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  if (minutes > 0) {
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`
  }
  return `${displayHours} ${period}`
}

// Compute stats from a teacher's records array
function enrichTeacher(teacher) {
  const total = teacher.records.length
  const attended = teacher.records.filter(r => r.status === 'present').length
  const percentage = total > 0 ? Math.round((attended / total) * 100) : 0
  return { ...teacher, attended, total, percentage }
}

// Compute overall stats from a subject's teachers array
function enrichSubject(subject) {
  const teachers = subject.teachers.map(enrichTeacher)
  const totalRecords = teachers.reduce((acc, t) => acc + t.total, 0)
  const totalAttended = teachers.reduce((acc, t) => acc + t.attended, 0)
  const overallPercentage = totalRecords > 0 ? Math.round((totalAttended / totalRecords) * 100) : 0
  return { ...subject, teachers, overallPercentage }
}


// ─── Detail Page Data (grouped by subject → teacher) ────────────

/**
 * Fetch full attendance details for the logged-in student.
 * Returns data in the shape: [{ subjectCode, subjectName, overallPercentage, teachers: [{ name, initials, attended, total, percentage, records }] }]
 * @param {'lecture' | 'lab'} sessionType
 */
export async function getMyAttendanceDetails(sessionType) {
  let studentProfile
  try {
    const result = await getMyStudentProfile()
    studentProfile = result.data
  } catch (e) {
    // No student profile found (e.g., user is testing via dev role switcher)
    return { data: [], error: null }
  }
  if (!studentProfile) return { data: [], error: null }

  // 1. Get enrollments with course info
  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select(`
      class_section_id,
      class_sections (
        id,
        courses ( name, code )
      )
    `)
    .eq('student_id', studentProfile.id)

  if (enrollError || !enrollments?.length) return { data: [], error: enrollError }

  // 2. Build detail for each enrollment
  const subjects = await Promise.all(
    enrollments.map(async (enrollment) => {
      const classSectionId = enrollment.class_section_id
      const course = enrollment.class_sections?.courses

      if (!course) return null

      // Get sessions of the requested type with teacher info
      const { data: sessions } = await supabase
        .from('attendance_sessions')
        .select(`
          id,
          session_date,
          session_type,
          teacher_id,
          teacher_profiles (
            id,
            profiles (
              full_name
            )
          )
        `)
        .eq('class_section_id', classSectionId)
        .eq('session_type', sessionType)
        .order('session_date', { ascending: false })

      if (!sessions?.length) return null

      // Get this student's records for these sessions
      const sessionIds = sessions.map(s => s.id)
      const { data: records } = await supabase
        .from('attendance_records')
        .select('session_id, status')
        .eq('student_id', studentProfile.id)
        .in('session_id', sessionIds)

      const recordMap = {}
      records?.forEach(r => { recordMap[r.session_id] = r.status })

      // Get schedules for time display
      const { data: schedules } = await supabase
        .from('schedules')
        .select('day_of_week, start_time, end_time')
        .eq('class_section_id', classSectionId)

      const scheduleMap = {}
      schedules?.forEach(s => {
        const day = s.day_of_week || ''
        scheduleMap[day] = { start: s.start_time, end: s.end_time }
      })

      // Group sessions by teacher
      const teacherGroupMap = {}
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

      sessions.forEach(session => {
        const teacherId = session.teacher_id
        const teacherName = session.teacher_profiles?.profiles?.full_name || 'Unknown'

        if (!teacherGroupMap[teacherId]) {
          const nameParts = teacherName.split(' ').filter(Boolean)
          const initials = nameParts.map(p => p[0]).join('').toUpperCase().slice(0, 2)
          teacherGroupMap[teacherId] = {
            name: teacherName,
            initials,
            records: [],
          }
        }

        // Format date
        const dateObj = new Date(session.session_date + 'T00:00:00')
        const dayOfWeek = dayNames[dateObj.getDay()]
        const dateStr = `${monthNames[dateObj.getMonth()]} ${dateObj.getDate()}`

        // Format time from schedule
        let timeStr = ''
        const schedule = scheduleMap[dayOfWeek]
        if (schedule) {
          timeStr = `${formatTime(schedule.start)}–${formatTime(schedule.end)}`
        }

        teacherGroupMap[teacherId].records.push({
          date: dateStr,
          time: timeStr,
          status: recordMap[session.id] || 'absent',
        })
      })

      return {
        subjectCode: course.code,
        subjectName: course.name,
        teachers: Object.values(teacherGroupMap),
      }
    })
  )

  // Filter out nulls and enrich with stats
  const validSubjects = subjects.filter(Boolean).map(enrichSubject)

  return { data: validSubjects, error: null }
}


// ─── Dashboard Summary Data ─────────────────────────────────────

/**
 * Get summary for dashboard rings (just name + percentage per subject).
 * @param {'lecture' | 'lab'} sessionType
 */
export async function getMyAttendanceSummaryByType(sessionType) {
  const { data, error } = await getMyAttendanceDetails(sessionType)
  if (error || !data?.length) return { data: [], error }

  const summary = data.map(s => ({
    name: s.subjectName,
    percentage: s.overallPercentage,
  }))

  return { data: summary, error: null }
}