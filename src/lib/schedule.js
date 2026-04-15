import { supabase } from './supabase'
import { getMyStudentProfile } from './profile'

// Upload marks for multiple students in a section
// marksArray = [{ studentId, marksObtained, maxMarks }]
export async function uploadExamMarks(classSectionId, examName, marksArray) {
  const records = marksArray.map((m) => ({
    class_section_id: classSectionId,
    student_id: m.studentId,
    exam_name: examName,
    marks_obtained: m.marksObtained,
    max_marks: m.maxMarks,
  }))

  const { data, error } = await supabase
    .from('exam_marks')
    .upsert(records, { onConflict: 'class_section_id,student_id,exam_name' })
    .select()

  return { data, error }
}

// Get all exam marks for a specific section
export async function getMarksForSection(classSectionId) {
  const { data, error } = await supabase
    .from('exam_marks')
    .select(`
      *,
      student_profiles (
        roll_number,
        profiles ( full_name )
      )
    `)
    .eq('class_section_id', classSectionId)
    .order('exam_name', { ascending: true })

  return { data, error }
}

// Get current student's own marks across all sections
export async function getMyMarks() {
  const { data: studentProfile } = await getMyStudentProfile()
  if (!studentProfile) return { data: [], error: new Error('No student profile') }

  const { data, error } = await supabase
    .from('exam_marks')
    .select(`
      *,
      class_sections (
        courses ( name, code )
      )
    `)
    .eq('student_id', studentProfile.id)
    .order('recorded_at', { ascending: false })

  return { data, error }
}

// Get class average for a specific exam in a section
export async function getClassAverage(classSectionId, examName) {
  const { data, error } = await supabase
    .from('exam_marks')
    .select('marks_obtained, max_marks')
    .eq('class_section_id', classSectionId)
    .eq('exam_name', examName)

  if (error || !data?.length) return { average: 0, error }

  const avg = data.reduce((sum, r) => sum + (r.marks_obtained / r.max_marks) * 100, 0) / data.length
  return { average: Math.round(avg), error: null }
}

// Get today's schedule for teacher or student
export async function getTodaySchedule(role) {
  // TODO: Fetch real schedule from database (e.g., routines table) 
  // Returning empty array as fallback to unblock rendering
  return { data: [], error: null }
}