import { Router } from 'express'

const router = Router()

/**
 * POST /api/v1/assignments
 * Create a new assignment for a class section
 * Body: { classSectionId, title, questionCount, dueAt?, description? }
 */
router.post('/', async (req, res) => {
  try {
    const { classSectionId, title, questionCount, dueAt, description } = req.body
    const user = req.user

    if (!classSectionId || !title || !questionCount) {
      return res.status(400).json({
        error: 'classSectionId, title, and questionCount are required'
      })
    }

    // Verify user is a teacher assigned to this section
    const { data: assignment } = await req.supabase
      .from('teacher_assignments')
      .select('id')
      .eq('teacher_id', user.id)
      .eq('class_section_id', classSectionId)
      .single()

    if (!assignment) {
      return res.status(403).json({
        error: 'You are not assigned to this class section'
      })
    }

    // Create assignment
    const { data, error } = await req.supabase
      .from('assignments')
      .insert({
        class_section_id: classSectionId,
        created_by: user.id,
        title: title.trim(),
        question_count: questionCount,
        due_at: dueAt || null,
        description: description?.trim() || null,
      })
      .select()
      .single()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    return res.status(201).json({ data })
  } catch (err) {
    console.error('POST /assignments error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/v1/assignments/student
 * Get all assignments for the logged-in student across all enrolled sections
 */
router.get('/student', async (req, res) => {
  try {
    const user = req.user

    // Get student profile
    const { data: studentProfile, error: spError } = await req.supabase
      .from('student_profiles')
      .select('id')
      .eq('profile_id', user.id)
      .single()

    if (spError || !studentProfile) {
      return res.status(404).json({ error: 'Student profile not found' })
    }

    // Get enrollments and their assignments
    const { data: enrollments, error: enrollError } = await req.supabase
      .from('enrollments')
      .select(`
        class_section_id,
        class_sections (
          id,
          courses (
            id,
            name,
            code
          ),
          assignments (
            id,
            title,
            question_count,
            due_at,
            description,
            created_by,
            created_at
          )
        )
      `)
      .eq('student_id', studentProfile.id)

    if (enrollError) {
      return res.status(500).json({ error: 'Failed to fetch enrollments' })
    }

    // Flatten and enrich response
    const assignments = enrollments
      .flatMap((e) => {
        const section = e.class_sections
        if (!section?.assignments) return []
        return section.assignments.map((a) => ({
          id: a.id,
          title: a.title,
          description: a.description,
          questionCount: a.question_count,
          dueAt: a.due_at,
          createdAt: a.created_at,
          sectionId: section.id,
          course: {
            id: section.courses.id,
            name: section.courses.name,
            code: section.courses.code,
          },
        }))
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    return res.json({ data: assignments })
  } catch (err) {
    console.error('GET /assignments/student error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/v1/assignments/sections/:id
 * Get all assignments for a specific class section (teacher view)
 */
router.get('/sections/:id', async (req, res) => {
  try {
    const { id: classSectionId } = req.params
    const user = req.user

    // Verify teacher is assigned to this section
    const { data: assignment } = await req.supabase
      .from('teacher_assignments')
      .select('id')
      .eq('teacher_id', user.id)
      .eq('class_section_id', classSectionId)
      .single()

    if (!assignment) {
      return res.status(403).json({
        error: 'You are not assigned to this class section'
      })
    }

    // Get assignments for this section
    const { data: assignments, error } = await req.supabase
      .from('assignments')
      .select(`
        id,
        title,
        question_count,
        due_at,
        description,
        created_at,
        assignment_questions (count)
      `)
      .eq('class_section_id', classSectionId)
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    const data = assignments.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      questionCount: a.question_count,
      dueAt: a.due_at,
      createdAt: a.created_at,
      questionsLinked: a.assignment_questions?.[0]?.count || 0,
    }))

    return res.json({ data })
  } catch (err) {
    console.error('GET /assignments/sections/:id error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/v1/assignments/questions
 * Add a question to the question bank for a class section
 * Body: { classSectionId, questionText, topic?, difficulty?, assignmentIds? }
 */
router.post('/questions', async (req, res) => {
  try {
    const { classSectionId, questionText, topic, difficulty, assignmentIds } = req.body
    const user = req.user

    if (!classSectionId || !questionText) {
      return res.status(400).json({
        error: 'classSectionId and questionText are required'
      })
    }

    // Verify user is a teacher assigned to this section
    const { data: assignment } = await req.supabase
      .from('teacher_assignments')
      .select('id')
      .eq('teacher_id', user.id)
      .eq('class_section_id', classSectionId)
      .single()

    if (!assignment) {
      return res.status(403).json({
        error: 'You are not assigned to this class section'
      })
    }

    // Create question in bank
    const { data: question, error: qError } = await req.supabase
      .from('question_bank')
      .insert({
        class_section_id: classSectionId,
        created_by: user.id,
        question_text: questionText.trim(),
        topic: topic?.trim() || null,
        difficulty: difficulty || 'medium',
      })
      .select()
      .single()

    if (qError) {
      return res.status(400).json({ error: qError.message })
    }

    // Link to assignments if specified
    if (assignmentIds && Array.isArray(assignmentIds) && assignmentIds.length > 0) {
      const links = assignmentIds.map((assignmentId) => ({
        assignment_id: assignmentId,
        question_id: question.id,
      }))

      const { error: linkError } = await req.supabase
        .from('assignment_questions')
        .insert(links)

      if (linkError) {
        console.error('Failed to link questions to assignments:', linkError)
        // Don't fail the whole request, just warn
      }
    }

    return res.status(201).json({ data: question })
  } catch (err) {
    console.error('POST /assignments/questions error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/v1/assignments/questions/:sectionId
 * Get all questions in the question bank for a class section
 */
router.get('/questions/:sectionId', async (req, res) => {
  try {
    const { sectionId } = req.params
    const user = req.user

    // Verify user is a teacher assigned to this section
    const { data: assignment } = await req.supabase
      .from('teacher_assignments')
      .select('id')
      .eq('teacher_id', user.id)
      .eq('class_section_id', sectionId)
      .single()

    if (!assignment) {
      return res.status(403).json({
        error: 'You are not assigned to this class section'
      })
    }

    // Get questions
    const { data: questions, error } = await req.supabase
      .from('question_bank')
      .select(`
        id,
        question_text,
        topic,
        difficulty,
        created_at,
        assignment_questions (assignment_id)
      `)
      .eq('class_section_id', sectionId)
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    const data = questions.map((q) => ({
      id: q.id,
      text: q.question_text,
      topic: q.topic,
      difficulty: q.difficulty,
      createdAt: q.created_at,
      usedInAssignments: q.assignment_questions?.map((aq) => aq.assignment_id) || [],
    }))

    return res.json({ data })
  } catch (err) {
    console.error('GET /assignments/questions/:sectionId error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * DELETE /api/v1/assignments/:id
 * Delete an assignment (teacher only)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id: assignmentId } = req.params
    const user = req.user

    // Get assignment and verify ownership
    const { data: assignment, error: getError } = await req.supabase
      .from('assignments')
      .select('id, class_section_id, created_by')
      .eq('id', assignmentId)
      .single()

    if (getError || !assignment) {
      return res.status(404).json({ error: 'Assignment not found' })
    }

    if (assignment.created_by !== user.id) {
      return res.status(403).json({
        error: 'You can only delete your own assignments'
      })
    }

    // Delete assignment (cascade will handle assignment_questions)
    const { error: deleteError } = await req.supabase
      .from('assignments')
      .delete()
      .eq('id', assignmentId)

    if (deleteError) {
      return res.status(400).json({ error: deleteError.message })
    }

    return res.json({ success: true })
  } catch (err) {
    console.error('DELETE /assignments/:id error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
