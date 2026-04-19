import { Router } from 'express'

const router = Router()

// GET /api/v1/contacts/student
router.get('/student', async (req, res) => {
  try {
    const supabase = req.supabase
    const user = req.user

    // Get student profile
    const { data: studentProfile, error: spError } = await supabase
      .from('student_profiles')
      .select('id')
      .eq('profile_id', user.id)
      .single()

    if (spError || !studentProfile) {
      return res.status(404).json({ error: 'Student profile not found' })
    }

    // Get all enrollments with full chain
    const { data: enrollments, error: enrollError } = await supabase
      .from('enrollments')
      .select(`
        class_sections (
          id,
          section,
          courses (
            id,
            name,
            code
          ),
          teacher_assignments (
            teacher_profiles (
              id,
              employee_id,
              department,
              profiles (
                full_name,
                email
              )
            )
          )
        )
      `)
      .eq('student_id', studentProfile.id)

    if (enrollError) {
      return res.status(500).json({ error: 'Failed to fetch enrollments' })
    }

    // Shape the response
    const contacts = enrollments
      .map((e) => {
        const section = e.class_sections
        if (!section) return null

        const teachers = section.teacher_assignments
          .map((ta) => {
            const tp = ta.teacher_profiles
            if (!tp) return null
            return {
              id: tp.id,
              name: tp.profiles.full_name,
              email: tp.profiles.email,
              employeeId: tp.employee_id,
              department: tp.department,
              role: 'Lecturer',
            }
          })
          .filter(Boolean)

        return {
          subjectId: section.courses.id,
          subjectName: section.courses.name,
          subjectCode: section.courses.code,
          section: section.section,
          type: 'Lecture',
          teachers,
        }
      })
      .filter(Boolean)

    return res.json({ data: contacts })
  } catch (err) {
    console.error('contactRoutes /student error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router