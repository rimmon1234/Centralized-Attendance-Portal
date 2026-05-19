import { Router } from 'express'
import multer from 'multer'
import * as XLSX from 'xlsx'
import { supabaseAdmin } from '../lib/supabase.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function pickValue(row, headers) {
  for (const key of Object.keys(row || {})) {
    const normalized = normalizeHeader(key)
    if (headers.has(normalized)) return row[key]
  }
  return undefined
}

function normalizeRoll(value) {
  return String(value || '').trim().toUpperCase()
}

function normalizeDepartment(value) {
  if (!value) return null
  return String(value).trim().toUpperCase()
}

function normalizeSection(value) {
  if (!value) return null
  return String(value).trim().toUpperCase()
}

function normalizeYear(value) {
  if (value == null || value === '') return null
  const parsed = parseInt(String(value).trim(), 10)
  return Number.isFinite(parsed) ? parsed : null
}

async function createMarksAnnouncement({ db, user, classSectionId, examName }) {
  if (!db || !user || !classSectionId || !examName) return

  const { data: sectionRow } = await db
    .from('class_sections')
    .select('id, department, year_of_study, section, courses ( name, code )')
    .eq('id', classSectionId)
    .single()

  if (!sectionRow) return

  const { data: profileRow } = await db
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  const teacherName =
    profileRow?.full_name || user?.user_metadata?.full_name || profileRow?.email || user?.email || 'Teacher'

  const courseName = sectionRow.courses?.name || 'Subject'
  const courseCode = sectionRow.courses?.code
  const courseLabel = courseCode ? `${courseName} (${courseCode})` : courseName

  const title = `Marks uploaded: ${examName}`
  const message = `${teacherName} has uploaded marks for ${examName} in ${courseLabel}.`

  const { data: createdRow, error } = await db
    .from('announcements')
    .insert({
      title,
      message,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error || !createdRow) return

  await db
    .from('announcement_targets')
    .insert({
      announcement_id: createdRow.id,
      target_role: 'student',
      department: normalizeDepartment(sectionRow.department),
      year_of_study: normalizeYear(sectionRow.year_of_study),
      section: normalizeSection(sectionRow.section),
    })
}

function parseMarksValue(raw) {
  const text = String(raw ?? '').trim().toUpperCase()
  if (!text || text === 'AB' || text === 'ABSENT') return { marks: 0, isAbsent: true }
  const num = Number(raw)
  if (Number.isNaN(num)) return { marks: null, isInvalid: true }
  return { marks: num, isAbsent: false }
}

function normalizeJsonRow(row) {
  const roll = normalizeRoll(
    row.rollNumber ?? row.roll_no ?? row.rollNo ?? row.roll ?? row['Roll No'] ?? row['Roll']
  )
  const rawMarks = row.marksObtained ?? row.marks ?? row.score ?? row['Marks'] ?? row['Score']
  const rawMax = row.maxMarks ?? row.max_marks ?? row.total ?? row['Max Marks'] ?? row['Total']
  const parsed = parseMarksValue(rawMarks)

  return {
    roll,
    marksValue: parsed.marks,
    isAbsent: parsed.isAbsent,
    isInvalid: parsed.isInvalid,
    maxValue: rawMax === '' || rawMax == null ? null : Number(rawMax),
  }
}

async function buildMarksRecords({ req, classSectionId, examName, maxMarks, rows }) {
  const { data: enrollmentRows, error: enrollmentError } = await req.supabase
    .from('enrollments')
    .select('student_profiles ( id, roll_number )')
    .eq('class_section_id', classSectionId)

  if (enrollmentError) {
    return { error: enrollmentError.message }
  }

  const rollMap = new Map(
    (enrollmentRows || [])
      .map((r) => r.student_profiles)
      .filter(Boolean)
      .map((sp) => [normalizeRoll(sp.roll_number), sp.id])
  )

  const resolvedMax = Number(maxMarks)
  const records = []
  const skipped = []

  rows.forEach((row, index) => {
    const normalized = normalizeJsonRow(row || {})
    if (!normalized.roll) {
      skipped.push({ row: index + 1, reason: 'missing_roll_number' })
      return
    }

    const studentId = rollMap.get(normalized.roll)
    if (!studentId) {
      skipped.push({ row: index + 1, roll: normalized.roll, reason: 'roll_not_in_section' })
      return
    }

    if (normalized.isInvalid) {
      skipped.push({ row: index + 1, roll: normalized.roll, reason: 'invalid_marks' })
      return
    }

    const maxValue = Number.isFinite(normalized.maxValue)
      ? normalized.maxValue
      : (Number.isFinite(resolvedMax) ? resolvedMax : null)

    if (!Number.isFinite(maxValue)) {
      skipped.push({ row: index + 1, roll: normalized.roll, reason: 'missing_max_marks' })
      return
    }

    records.push({
      class_section_id: classSectionId,
      student_id: studentId,
      exam_name: examName,
      marks_obtained: normalized.marksValue,
      max_marks: maxValue,
    })
  })

  return { records, skipped }
}

// POST /api/v1/marks/upload
router.post('/upload', async (req, res) => {
  try {
    const { classSectionId, examName, marksArray } = req.body
    const records = marksArray.map(m => ({
      class_section_id: classSectionId,
      student_id: m.studentId,
      exam_name: examName,
      marks_obtained: m.marksObtained,
      max_marks: m.maxMarks,
    }))
    const { data, error } = await req.supabase
      .from('exam_marks')
      .upsert(records, { onConflict: 'class_section_id,student_id,exam_name' })
      .select()
    if (error) return res.status(400).json({ error: error.message })
    try {
      const db = supabaseAdmin || req.supabase
      await createMarksAnnouncement({ db, user: req.user, classSectionId, examName })
    } catch (announceError) {
      console.warn('marks upload announcement failed:', announceError?.message || announceError)
    }
    return res.json({ data })
  } catch (err) { return res.status(500).json({ error: 'Internal server error' }) }
})

// POST /api/v1/marks/upload-excel
router.post('/upload-excel', upload.single('marksFile'), async (req, res) => {
  try {
    const { classSectionId, examName, maxMarks } = req.body

    if (!classSectionId || !examName) {
      return res.status(400).json({ error: 'classSectionId and examName are required' })
    }

    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'marksFile is required' })
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return res.status(400).json({ error: 'No worksheet found in the file' })
    }

    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
    if (!rows.length) {
      return res.status(400).json({ error: 'No rows found in the file' })
    }

    const rollHeaders = new Set(['rollno', 'rollnumber', 'roll'])
    const marksHeaders = new Set(['marks', 'mark', 'score', 'marksobtained'])
    const maxHeaders = new Set(['maxmarks', 'maxmark', 'maximum', 'total', 'fullmarks'])

    const { data: enrollmentRows, error: enrollmentError } = await req.supabase
      .from('enrollments')
      .select('student_profiles ( id, roll_number )')
      .eq('class_section_id', classSectionId)

    if (enrollmentError) {
      return res.status(400).json({ error: enrollmentError.message })
    }

    const rollMap = new Map(
      (enrollmentRows || [])
        .map((r) => r.student_profiles)
        .filter(Boolean)
        .map((sp) => [String(sp.roll_number || '').trim().toUpperCase(), sp.id])
    )

    const resolvedMax = Number(maxMarks)
    const records = []
    const skipped = []
    const parsed = []

    rows.forEach((row, index) => {
      const rawRoll = pickValue(row, rollHeaders)
      const rawMarks = pickValue(row, marksHeaders)
      const rawMax = pickValue(row, maxHeaders)

      const roll = String(rawRoll || '').trim().toUpperCase()
      if (!roll) {
        skipped.push({ row: index + 2, reason: 'missing_roll_number' })
        return
      }

      const studentId = rollMap.get(roll)
      if (!studentId) {
        skipped.push({ row: index + 2, roll, reason: 'roll_not_in_section' })
        return
      }

      const marksText = String(rawMarks || '').trim().toUpperCase()
      const isAbsent = marksText === 'AB' || marksText === 'ABSENT'
      const marksValue = isAbsent || marksText === '' ? 0 : Number(rawMarks)
      if (marksValue != null && Number.isNaN(marksValue)) {
        skipped.push({ row: index + 2, roll, reason: 'invalid_marks' })
        return
      }

      const rowMax = rawMax === '' ? null : Number(rawMax)
      const maxValue = Number.isFinite(rowMax) ? rowMax : (Number.isFinite(resolvedMax) ? resolvedMax : null)
      if (!Number.isFinite(maxValue)) {
        skipped.push({ row: index + 2, roll, reason: 'missing_max_marks' })
        return
      }

      records.push({
        class_section_id: classSectionId,
        student_id: studentId,
        exam_name: examName,
        marks_obtained: marksValue,
        max_marks: maxValue,
      })

      parsed.push({
        rollNumber: roll,
        marksObtained: marksValue,
        maxMarks: maxValue,
        isAbsent,
      })
    })

    if (!records.length) {
      return res.status(400).json({ error: 'No valid rows to import', skipped })
    }

    const { data, error } = await req.supabase
      .from('exam_marks')
      .upsert(records, { onConflict: 'class_section_id,student_id,exam_name' })
      .select()

    if (error) return res.status(400).json({ error: error.message })
    try {
      const db = supabaseAdmin || req.supabase
      await createMarksAnnouncement({ db, user: req.user, classSectionId, examName })
    } catch (announceError) {
      console.warn('marks upload announcement failed:', announceError?.message || announceError)
    }
    return res.json({ data, parsed, imported: records.length, skipped })
  } catch (err) {
    console.error('POST /marks/upload-excel error:', err)
    return res.status(500).json({ error: 'Failed to process file' })
  }
})

// POST /api/v1/marks/upload-json (raw JSON body)
router.post('/upload-json', async (req, res) => {
  try {
    const { classSectionId, examName, maxMarks, rows } = req.body || {}

    if (!classSectionId || !examName) {
      return res.status(400).json({ error: 'classSectionId and examName are required' })
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'rows must be a non-empty array' })
    }

    const { records, skipped, error } = await buildMarksRecords({
      req,
      classSectionId,
      examName,
      maxMarks,
      rows,
    })

    if (error) return res.status(400).json({ error })
    if (!records.length) return res.status(400).json({ error: 'No valid rows to import', skipped })

    const { data, error: upsertError } = await req.supabase
      .from('exam_marks')
      .upsert(records, { onConflict: 'class_section_id,student_id,exam_name' })
      .select()

    if (upsertError) return res.status(400).json({ error: upsertError.message })
    try {
      const db = supabaseAdmin || req.supabase
      await createMarksAnnouncement({ db, user: req.user, classSectionId, examName })
    } catch (announceError) {
      console.warn('marks upload announcement failed:', announceError?.message || announceError)
    }
    return res.json({ data, imported: records.length, skipped })
  } catch (err) {
    console.error('POST /marks/upload-json error:', err)
    return res.status(500).json({ error: 'Failed to process JSON' })
  }
})

// POST /api/v1/marks/upload-json-file (multipart file)
router.post('/upload-json-file', upload.single('marksFile'), async (req, res) => {
  try {
    const { classSectionId, examName, maxMarks } = req.body || {}

    if (!classSectionId || !examName) {
      return res.status(400).json({ error: 'classSectionId and examName are required' })
    }

    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'marksFile is required' })
    }

    let rows = null
    try {
      const parsed = JSON.parse(req.file.buffer.toString('utf-8'))
      rows = Array.isArray(parsed) ? parsed : parsed?.rows
    } catch (parseError) {
      return res.status(400).json({ error: 'Invalid JSON file' })
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'rows must be a non-empty array' })
    }

    const { records, skipped, error } = await buildMarksRecords({
      req,
      classSectionId,
      examName,
      maxMarks,
      rows,
    })

    if (error) return res.status(400).json({ error })
    if (!records.length) return res.status(400).json({ error: 'No valid rows to import', skipped })

    const { data, error: upsertError } = await req.supabase
      .from('exam_marks')
      .upsert(records, { onConflict: 'class_section_id,student_id,exam_name' })
      .select()

    if (upsertError) return res.status(400).json({ error: upsertError.message })
    try {
      const db = supabaseAdmin || req.supabase
      await createMarksAnnouncement({ db, user: req.user, classSectionId, examName })
    } catch (announceError) {
      console.warn('marks upload announcement failed:', announceError?.message || announceError)
    }
    return res.json({ data, imported: records.length, skipped })
  } catch (err) {
    console.error('POST /marks/upload-json-file error:', err)
    return res.status(500).json({ error: 'Failed to process JSON file' })
  }
})

// GET /api/v1/marks/sections/:id
router.get('/sections/:id', async (req, res) => {
  try {
    const client = supabaseAdmin || req.supabase
    const { data, error } = await client
      .from('exam_marks')
      .select('*, student_profiles ( id, roll_number, profile_id )')
      .eq('class_section_id', req.params.id)
      .order('exam_name', { ascending: true })
    if (error) return res.status(400).json({ error: error.message })
    if (supabaseAdmin && data?.length) {
      const missingProfileIds = data
        .map((row) => row.student_profiles?.profile_id)
        .filter(Boolean)
        .filter((profileId) => {
          const profile = data.find((row) => row.student_profiles?.profile_id === profileId)?.student_profiles?.profiles
          if (Array.isArray(profile)) return !profile[0]?.full_name
          return !profile?.full_name
        })

      if (missingProfileIds.length) {
        const { data: profilesData } = await supabaseAdmin
          .from('profiles')
          .select('id, full_name')
          .in('id', missingProfileIds)

        const profileMap = new Map((profilesData || []).map((p) => [p.id, p.full_name]))
        data.forEach((row) => {
          const profileId = row.student_profiles?.profile_id
          if (!profileId) return
          const fullName = profileMap.get(profileId)
          if (!fullName) return
          row.student_profiles.profile_name = fullName
          row.student_profiles.profiles = { full_name: fullName }
        })
      }
    }
    return res.json({ data })
  } catch (err) { return res.status(500).json({ error: 'Internal server error' }) }
})

// GET /api/v1/marks/mine
router.get('/mine', async (req, res) => {
  try {
    const { data: sp } = await req.supabase.from('student_profiles').select('id').eq('profile_id', req.user.id).single()
    if (!sp) return res.json({ data: [] })
    const { data, error } = await req.supabase
      .from('exam_marks')
      .select('*, class_sections ( courses ( name, code ) )')
      .eq('student_id', sp.id)
      .order('recorded_at', { ascending: false })
    if (error) return res.status(400).json({ error: error.message })
    return res.json({ data })
  } catch (err) { return res.status(500).json({ error: 'Internal server error' }) }
})

// GET /api/v1/marks/average/:sectionId/:examName
router.get('/average/:sectionId/:examName', async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('exam_marks')
      .select('marks_obtained, max_marks')
      .eq('class_section_id', req.params.sectionId)
      .eq('exam_name', req.params.examName)
    if (error || !data?.length) return res.json({ average: 0 })
    const avg = data.reduce((sum, r) => sum + (r.marks_obtained / r.max_marks) * 100, 0) / data.length
    return res.json({ average: Math.round(avg) })
  } catch (err) { return res.status(500).json({ error: 'Internal server error' }) }
})

export default router