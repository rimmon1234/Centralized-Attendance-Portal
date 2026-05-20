import { Router } from 'express'
import multer from 'multer'
import mammoth from 'mammoth'
import pdfParse from 'pdf-parse'
import Groq from 'groq-sdk'
import { parse } from 'node-html-parser'
import JSZip from 'jszip'
import { XMLParser } from 'fast-xml-parser'
import { supabaseAdmin } from '../lib/supabase.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })
const DEFAULT_ASSIGNMENT_ATTENDANCE_THRESHOLD = 75

function isMissingAttendanceThresholdColumn(error) {
  const message = String(error?.message || '').toLowerCase()
  return message.includes('attendance_threshold') && message.includes('column')
}

function normalizeAttendanceThreshold(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return DEFAULT_ASSIGNMENT_ATTENDANCE_THRESHOLD
  }

  const parsed = Number(rawValue)
  if (!Number.isFinite(parsed)) {
    return null
  }

  const rounded = Math.round(parsed)
  if (rounded < 0 || rounded > 100) {
    return null
  }

  return rounded
}

function hashString(input) {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededShuffle(items, seedInput) {
  const arr = [...items]
  let seed = hashString(String(seedInput || 'seed'))

  const nextRand = () => {
    // LCG params from Numerical Recipes, stable across runs.
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(nextRand() * (i + 1))
    const temp = arr[i]
    arr[i] = arr[j]
    arr[j] = temp
  }

  return arr
}

async function getTeacherProfileId(supabase, profileId) {
  const { data: teacherProfile, error } = await supabase
    .from('teacher_profiles')
    .select('id')
    .eq('profile_id', profileId)
    .single()

  if (error || !teacherProfile) return null
  return teacherProfile.id
}

function normalizeDifficulty(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'locq') return 'locq'
  if (normalized === 'iocq') return 'iocq'
  if (normalized === 'hocq') return 'hocq'
  if (normalized === 'easy') return 'locq'
  if (normalized === 'medium' || normalized === 'intermediate') return 'iocq'
  if (normalized === 'hard') return 'hocq'
  return 'iocq'
}

async function ensureTeacherAssigned(supabase, teacherId, classSectionId) {
  if (!teacherId || !classSectionId) return false
  const { data } = await supabase
    .from('teacher_assignments')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('class_section_id', classSectionId)
    .single()
  return Boolean(data)
}

function stripMarkdownJson(text) {
  return String(text || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
}

function encodeIndentation(text) {
  return String(text || '')
    .split('\n')
    .map((line) => {
      const match = line.match(/^(\s+)/)
      if (!match) return line
      const indent = match[1]
      let encoded = ''
      for (const ch of indent) {
        if (ch === '\t') encoded += '[TAB]'
        else if (ch === ' ') encoded += '[SP]'
      }
      return `${encoded}${line.slice(indent.length)}`
    })
    .join('\n')
}

function decodeIndentation(text) {
  return String(text || '')
    .replace(/\[TAB\]/g, '\t')
    .replace(/\[SP\]/g, ' ')
}

function romanize(value) {
  if (value <= 0) return ''
  const map = [
    { val: 1000, sym: 'M' },
    { val: 900, sym: 'CM' },
    { val: 500, sym: 'D' },
    { val: 400, sym: 'CD' },
    { val: 100, sym: 'C' },
    { val: 90, sym: 'XC' },
    { val: 50, sym: 'L' },
    { val: 40, sym: 'XL' },
    { val: 10, sym: 'X' },
    { val: 9, sym: 'IX' },
    { val: 5, sym: 'V' },
    { val: 4, sym: 'IV' },
    { val: 1, sym: 'I' },
  ]
  let num = value
  let result = ''
  for (const entry of map) {
    while (num >= entry.val) {
      result += entry.sym
      num -= entry.val
    }
  }
  return result
}

function resolveListStyle(node) {
  const typeAttr = node.getAttribute('type')
  if (typeAttr) return typeAttr
  const style = String(node.getAttribute('style') || '').toLowerCase()
  if (style.includes('lower-alpha')) return 'lower-alpha'
  if (style.includes('upper-alpha')) return 'upper-alpha'
  if (style.includes('lower-roman')) return 'lower-roman'
  if (style.includes('upper-roman')) return 'upper-roman'
  if (style.includes('decimal')) return 'decimal'
  return 'decimal'
}

function formatListMarker(index, style) {
  if (style === 'lower-alpha' || style === 'a') {
    return `(${String.fromCharCode(96 + index)})`
  }
  if (style === 'upper-alpha' || style === 'A') {
    return `(${String.fromCharCode(64 + index)})`
  }
  if (style === 'lower-roman' || style === 'i') {
    return `${romanize(index).toLowerCase()}.`
  }
  if (style === 'upper-roman' || style === 'I') {
    return `${romanize(index).toUpperCase()}.`
  }
  return `${index}.`
}

function htmlToTextWithLists(html) {
  const root = parse(html || '')
  const listStack = []

  const walk = (node) => {
    if (!node) return ''
    if (node.nodeType === 3) return node.rawText
    if (!node.tagName) return ''
    const tag = node.tagName.toLowerCase()

    if (tag === 'br') return '\n'
    if (tag === 'p') {
      const text = node.childNodes.map(walk).join('')
      return `${text.trimEnd()}\n`
    }

    if (tag === 'ol' || tag === 'ul') {
      const markerType = tag === 'ol' ? resolveListStyle(node) : 'bullet'
      listStack.push({ type: tag, index: 0, markerType })
      const text = node.childNodes.map(walk).join('')
      listStack.pop()
      return text
    }

    if (tag === 'li') {
      const current = listStack[listStack.length - 1]
      let prefix = ''
      if (current) {
        if (current.type === 'ol') {
          current.index += 1
          prefix = `${formatListMarker(current.index, current.markerType)} `
        } else {
          prefix = '- '
        }
      }
      const body = node.childNodes.map(walk).join('').trim()
      return `${prefix}${body}\n`
    }

    return node.childNodes.map(walk).join('')
  }

  const output = walk(root)
  return output
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value
  if (value == null) return []
  return [value]
}

function parseDocxNumbering(numberingXml) {
  if (!numberingXml) return { numMap: {}, abstractMap: {} }
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
  const xml = parser.parse(numberingXml)
  const numbering = xml['w:numbering'] || xml.numbering || {}

  const abstractNums = normalizeArray(numbering['w:abstractNum'] || numbering.abstractNum)
  const abstractMap = {}
  abstractNums.forEach((abs) => {
    const absId = abs?.['@_w:abstractNumId'] || abs?.['@_abstractNumId']
    if (!absId) return
    const levels = normalizeArray(abs?.['w:lvl'] || abs?.lvl)
    abstractMap[absId] = {}
    levels.forEach((lvl) => {
      const ilvl = Number(lvl?.['@_w:ilvl'] ?? lvl?.['@_ilvl'])
      const numFmt = lvl?.['w:numFmt']?.['@_w:val'] || lvl?.numFmt?.['@_val']
      if (Number.isFinite(ilvl)) {
        abstractMap[absId][ilvl] = numFmt || 'decimal'
      }
    })
  })

  const nums = normalizeArray(numbering['w:num'] || numbering.num)
  const numMap = {}
  nums.forEach((num) => {
    const numId = num?.['@_w:numId'] || num?.['@_numId']
    const absId = num?.['w:abstractNumId']?.['@_w:val'] || num?.abstractNumId?.['@_val']
    if (numId && absId) {
      numMap[numId] = absId
    }
  })

  return { numMap, abstractMap }
}

function formatDocxListLabel(count, numFmt) {
  if (!numFmt || numFmt === 'decimal') return `${count}.`
  if (numFmt === 'lowerLetter' || numFmt === 'lowerAlpha') {
    return `(${String.fromCharCode(96 + count)})`
  }
  if (numFmt === 'upperLetter' || numFmt === 'upperAlpha') {
    return `(${String.fromCharCode(64 + count)})`
  }
  if (numFmt === 'lowerRoman') return `${romanize(count).toLowerCase()}.`
  if (numFmt === 'upperRoman') return `${romanize(count).toUpperCase()}.`
  if (numFmt === 'bullet') return '•'
  return `${count}.`
}

function extractDocxTextWithNumbering(documentXml, numberingXml) {
  if (!documentXml) return ''
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
  const xml = parser.parse(documentXml)
  const body = xml['w:document']?.['w:body'] || xml.document?.body || {}
  const paragraphs = normalizeArray(body['w:p'] || body.p)
  const { numMap, abstractMap } = parseDocxNumbering(numberingXml)
  const counters = {}

  const lines = paragraphs.map((p) => {
    const runs = normalizeArray(p?.['w:r'] || p?.r)
    const text = runs
      .map((r) => {
        const t = r?.['w:t'] || r?.t
        if (Array.isArray(t)) return t.map((v) => (v?.['#text'] ?? v ?? '')).join('')
        return t?.['#text'] ?? t ?? ''
      })
      .join('')

    const numPr = p?.['w:pPr']?.['w:numPr'] || p?.pPr?.numPr
    if (!numPr) return text

    const numId = numPr?.['w:numId']?.['@_w:val'] || numPr?.numId?.['@_val']
    const ilvl = Number(numPr?.['w:ilvl']?.['@_w:val'] || numPr?.ilvl?.['@_val'] || 0)
    if (!numId) return text

    const absId = numMap[numId]
    const numFmt = absId ? abstractMap[absId]?.[ilvl] : null
    const key = `${numId}:${ilvl}`
    counters[key] = (counters[key] || 0) + 1
    const label = formatDocxListLabel(counters[key], numFmt)
    if (label === '•') return `• ${text}`
    return `${label} ${text}`
  })

  return lines.join('\n')
}

function addImplicitSubparts(text) {
  const lines = String(text || '').split('\n')
  const questionStart = /^\s*(Q\d+|\d+)\s*[\.)]/i
  const listMarker = /^\s*(\(?[a-zA-Z]\)|\(?[ivxIVX]+\)|\d+[\.)]|[-•])\s*/
  const markerOnly = /^\s*(\(?[a-zA-Z]\)|\(?[ivxIVX]+\)|\d+[\.)])\s*$/
  const sublistIntro = /:\s*$/
  const continuationPrefix = /^(also|and|or|which|explain|note|in addition|please)\b/i
  const bulletMarker = /^\s*[-•]\s+/
  const out = []
  let inQuestion = false
  let subIndex = 0
  let lastLineWasListItem = false
  let pendingMarker = null

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (!line) {
      out.push('')
      continue
    }

    if (questionStart.test(line)) {
      inQuestion = true
      subIndex = 0
      lastLineWasListItem = false
      pendingMarker = null
      out.push(line)
      continue
    }

    if (inQuestion) {
      if (sublistIntro.test(line)) {
        subIndex = 0
        lastLineWasListItem = false
        pendingMarker = null
        out.push(line)
        continue
      }

      if (pendingMarker) {
        const marker = pendingMarker
        pendingMarker = null
        out.push(`${marker} ${line}`)
        lastLineWasListItem = true
        continue
      }

      if (markerOnly.test(line)) {
        pendingMarker = line.trim()
        continue
      }

      if (listMarker.test(line)) {
        lastLineWasListItem = true
        out.push(line)
        continue
      }

      if (lastLineWasListItem || continuationPrefix.test(line)) {
        lastLineWasListItem = false
        out.push(line)
        continue
      }

      subIndex += 1
      const label = `(${String.fromCharCode(96 + subIndex)})`
      out.push(`${label} ${line}`)
      continue
    }

    out.push(line)
  }

  return out.join('\n')
}

async function extractTextFromUpload(file) {
  const fileName = String(file?.originalname || '').toLowerCase()
  const mime = String(file?.mimetype || '').toLowerCase()

  if (mime.includes('pdf') || fileName.endsWith('.pdf')) {
    const parsed = await pdfParse(file.buffer)
    return parsed.text || ''
  }

  if (mime.includes('word') || fileName.endsWith('.docx')) {
    try {
      const zip = await JSZip.loadAsync(file.buffer)
      const docXml = await zip.file('word/document.xml')?.async('text')
      const numXml = await zip.file('word/numbering.xml')?.async('text')
      const docText = extractDocxTextWithNumbering(docXml, numXml)
      if (docText.trim()) return addImplicitSubparts(docText)
    } catch {
      // fall through to mammoth
    }

    const htmlResult = await mammoth.convertToHtml({ buffer: file.buffer })
    const htmlText = htmlToTextWithLists(htmlResult.value || '')
    if (htmlText.trim()) return addImplicitSubparts(htmlText)
    const rawResult = await mammoth.extractRawText({ buffer: file.buffer })
    return addImplicitSubparts(rawResult.value || '')
  }

  return null
}

/**
 * POST /api/v1/assignments
 * Create a new assignment for a class section
 * Body: { classSectionId, title, questionCount, dueAt?, description? }
 */
router.post('/', async (req, res) => {
  try {
    const {
      classSectionId,
      title,
      questionCount,
      dueAt,
      description,
      attendanceThreshold,
    } = req.body
    const user = req.user
    const teacherId = await getTeacherProfileId(req.supabase, user.id)
    const normalizedThreshold = normalizeAttendanceThreshold(attendanceThreshold)

    if (!classSectionId || !title || !questionCount) {
      return res.status(400).json({
        error: 'classSectionId, title, and questionCount are required'
      })
    }

    if (normalizedThreshold === null) {
      return res.status(400).json({
        error: 'attendanceThreshold must be a number between 0 and 100'
      })
    }

    if (!teacherId) {
      return res.status(403).json({ error: 'Teacher profile not found' })
    }

    // Verify user is a teacher assigned to this section
    const { data: assignment } = await req.supabase
      .from('teacher_assignments')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('class_section_id', classSectionId)
      .single()

    if (!assignment) {
      return res.status(403).json({
        error: 'You are not assigned to this class section'
      })
    }

    // Create assignment
    const insertPayload = {
      class_section_id: classSectionId,
      created_by: teacherId,
      title: title.trim(),
      question_count: questionCount,
      due_at: dueAt || null,
      description: description?.trim() || null,
      attendance_threshold: normalizedThreshold,
    }

    let createQuery = req.supabase
      .from('assignments')
      .insert(insertPayload)
      .select()
      .single()

    let { data, error } = await createQuery

    // Backward compatibility for environments where migration is not yet applied.
    if (error && isMissingAttendanceThresholdColumn(error)) {
      const { attendance_threshold: _ignored, ...legacyPayload } = insertPayload
      const retryResult = await req.supabase
        .from('assignments')
        .insert(legacyPayload)
        .select()
        .single()

      data = retryResult.data
      error = retryResult.error
      if (data && typeof data.attendance_threshold === 'undefined') {
        data.attendance_threshold = DEFAULT_ASSIGNMENT_ATTENDANCE_THRESHOLD
      }
    }

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
    const db = supabaseAdmin || req.supabase

    // Get student profile
    const { data: studentProfile, error: spError } = await req.supabase
      .from('student_profiles')
      .select('id')
      .eq('profile_id', user.id)
      .single()

    if (spError || !studentProfile) {
      return res.status(404).json({ error: 'Student profile not found' })
    }

    // Get student enrollments and section metadata
    const { data: enrollments, error: enrollError } = await req.supabase
      .from('enrollments')
      .select(`
        class_section_id,
        class_sections (
          id,
          courses (
            id,
            name,
            code,
            type
          )
        )
      `)
      .eq('student_id', studentProfile.id)

    if (enrollError) {
      return res.status(500).json({ error: 'Failed to fetch enrollments' })
    }

    const sectionRows = enrollments || []
    const sectionIds = sectionRows.map((e) => e.class_section_id).filter(Boolean)

    if (sectionIds.length === 0) {
      return res.json({ data: [] })
    }

    const sectionMap = Object.fromEntries(
      sectionRows.map((row) => [row.class_section_id, row.class_sections])
    )

    let assignmentRows = null
    let assignmentError = null

    const assignmentQueryWithThreshold = await db
      .from('assignments')
      .select(`
        id,
        class_section_id,
        title,
        description,
        question_count,
        due_at,
        created_at,
        created_by,
        attendance_threshold
      `)
      .in('class_section_id', sectionIds)
      .order('created_at', { ascending: false })

    assignmentRows = assignmentQueryWithThreshold.data
    assignmentError = assignmentQueryWithThreshold.error

    if (assignmentError && isMissingAttendanceThresholdColumn(assignmentError)) {
      const fallbackQuery = await db
        .from('assignments')
        .select(`
          id,
          class_section_id,
          title,
          description,
          question_count,
          due_at,
          created_at,
          created_by
        `)
        .in('class_section_id', sectionIds)
        .order('created_at', { ascending: false })

      assignmentRows = (fallbackQuery.data || []).map((row) => ({
        ...row,
        attendance_threshold: DEFAULT_ASSIGNMENT_ATTENDANCE_THRESHOLD,
      }))
      assignmentError = fallbackQuery.error
    }

    if (assignmentError) {
      return res.status(500).json({ error: assignmentError.message })
    }

    const assignments = assignmentRows || []
    if (assignments.length === 0) {
      return res.json({ data: [] })
    }

    const teacherIds = [...new Set(assignments.map((a) => a.created_by).filter(Boolean))]
    let teacherMap = {}
    if (teacherIds.length > 0) {
      const { data: teacherRows, error: teacherError } = await db
        .from('teacher_profiles')
        .select(`
          id,
          employee_id,
          profiles (
            full_name,
            email
          )
        `)
        .in('id', teacherIds)

      if (teacherError) {
        return res.status(500).json({ error: teacherError.message })
      }

      teacherMap = Object.fromEntries(
        (teacherRows || []).map((t) => [
          t.id,
          {
            id: t.id,
            name: t.profiles?.full_name || 'Assigned Teacher',
            email: t.profiles?.email || null,
            employeeId: t.employee_id || null,
          },
        ])
      )
    }

    const assignmentIds = assignments.map((a) => a.id)
    let questionMap = {}
    if (assignmentIds.length > 0) {
      const { data: linkRows, error: linkError } = await db
        .from('assignment_questions')
        .select(`
          assignment_id,
          question_bank (
            id,
            question_text,
            topic,
            difficulty
          )
        `)
        .in('assignment_id', assignmentIds)

      if (linkError) {
        return res.status(500).json({ error: linkError.message })
      }

      questionMap = (linkRows || []).reduce((acc, row) => {
        const assignmentId = row.assignment_id
        const question = row.question_bank
        if (!assignmentId || !question?.id) return acc
        if (!acc[assignmentId]) acc[assignmentId] = []
        acc[assignmentId].push({
          id: question.id,
          text: question.question_text,
          topic: question.topic,
          difficulty: question.difficulty,
        })
        return acc
      }, {})
    }

    let submittedAssignmentIds = new Set()
    let submissionTimestamps = {}
    if (assignmentIds.length > 0) {
      const { data: submissionRows } = await supabaseAdmin
        .from('assignment_submissions')
        .select('assignment_id, submitted_at')
        .eq('student_id', studentProfile.id)
        .in('assignment_id', assignmentIds)
        
      submittedAssignmentIds = new Set((submissionRows || []).map(r => r.assignment_id))
      submissionTimestamps = Object.fromEntries(
        (submissionRows || []).filter(r => r.assignment_id).map(r => [r.assignment_id, r.submitted_at])
      )
    }

    let sectionQuestionMap = {}
    if (sectionIds.length > 0) {
      const { data: sectionQuestionRows, error: sectionQuestionError } = await db
        .from('question_bank')
        .select('id, class_section_id, question_text, topic, difficulty')
        .in('class_section_id', sectionIds)

      if (sectionQuestionError) {
        return res.status(500).json({ error: sectionQuestionError.message })
      }

      sectionQuestionMap = (sectionQuestionRows || []).reduce((acc, row) => {
        if (!row?.class_section_id || !row?.id) return acc
        if (!acc[row.class_section_id]) acc[row.class_section_id] = []
        acc[row.class_section_id].push({
          id: row.id,
          text: row.question_text,
          topic: row.topic,
          difficulty: row.difficulty,
        })
        return acc
      }, {})
    }

    // Build deterministic student rank within each section so different
    // students in the same assignment section receive different offsets.
    let sectionStudentRankMap = {}
    if (sectionIds.length > 0) {
      const { data: sectionEnrollmentRows, error: sectionEnrollmentError } = await db
        .from('enrollments')
        .select('class_section_id, student_id')
        .in('class_section_id', sectionIds)

      if (sectionEnrollmentError) {
        return res.status(500).json({ error: sectionEnrollmentError.message })
      }

      const groupedBySection = (sectionEnrollmentRows || []).reduce((acc, row) => {
        const sectionId = row.class_section_id
        const sid = row.student_id
        if (!sectionId || !sid) return acc
        if (!acc[sectionId]) acc[sectionId] = []
        acc[sectionId].push(sid)
        return acc
      }, {})

      sectionStudentRankMap = Object.fromEntries(
        Object.entries(groupedBySection).map(([sectionId, studentIds]) => {
          const ranked = [...new Set(studentIds)].sort((a, b) => String(a).localeCompare(String(b)))
          const rankMap = Object.fromEntries(ranked.map((sid, idx) => [sid, idx]))
          return [sectionId, rankMap]
        })
      )
    }

    const sectionToCourseId = Object.fromEntries(
      sectionRows.map((row) => [row.class_section_id, row.class_sections?.courses?.id || null])
    )

    const sectionToCourseType = Object.fromEntries(
      sectionRows.map((row) => [
        row.class_section_id,
        String(row.class_sections?.courses?.type || '').toLowerCase() || null,
      ])
    )

    const { data: sessionRows, error: sessionError } = await db
      .from('attendance_sessions')
      .select('id, class_section_id, session_type')
      .in('class_section_id', sectionIds)

    if (sessionError) {
      return res.status(500).json({ error: sessionError.message })
    }

    const sessionIds = (sessionRows || []).map((s) => s.id)

    let recordMap = {}
    if (sessionIds.length > 0) {
      const { data: attendanceRecordRows, error: attendanceRecordError } = await db
        .from('attendance_records')
        .select('session_id, status')
        .eq('student_id', studentProfile.id)
        .in('session_id', sessionIds)

      if (attendanceRecordError) {
        return res.status(500).json({ error: attendanceRecordError.message })
      }

      recordMap = Object.fromEntries(
        (attendanceRecordRows || []).map((r) => [r.session_id, r.status])
      )
    }

    // Attendance gate must be per-course (not per-section), and missing
    // records count as absent (same model used in attendance dashboard).
    const attendanceByCourse = (sessionRows || []).reduce((acc, session) => {
      const sectionId = session.class_section_id
      if (!sectionId) return acc

      const courseId = sectionToCourseId[sectionId]
      if (!courseId) return acc

      const courseType = sectionToCourseType[sectionId]
      const sessionType = String(session.session_type || '').toLowerCase()

      // Keep gate calculation aligned with dashboard subject buckets.
      if (courseType && courseType !== 'all' && sessionType && sessionType !== courseType) {
        return acc
      }

      if (!acc[courseId]) {
        acc[courseId] = { attended: 0, total: 0 }
      }

      acc[courseId].total += 1

      const status = recordMap[session.id] || 'absent'
      if (status === 'present' || status === 'late') {
        acc[courseId].attended += 1
      }

      return acc
    }, {})

    const responseData = assignments.map((a) => {
      const section = sectionMap[a.class_section_id]
      const course = section?.courses || {}
      const teacher = teacherMap[a.created_by] || {
        id: a.created_by,
        name: 'Assigned Teacher',
        email: null,
        employeeId: null,
      }

      const attendance = attendanceByCourse[course.id] || { attended: 0, total: 0 }
      const percentage = attendance.total > 0
        ? Math.round((attendance.attended / attendance.total) * 100)
        : 0
      const requiredThreshold = Number.isFinite(Number(a.attendance_threshold))
        ? Number(a.attendance_threshold)
        : DEFAULT_ASSIGNMENT_ATTENDANCE_THRESHOLD
      const canAccess = percentage >= requiredThreshold

      const linkedPool = questionMap[a.id] || []
      const sectionPool = sectionQuestionMap[a.class_section_id] || []
      const pool = sectionPool.length > 0 ? sectionPool : linkedPool

      // Keep assignment-level randomization, then offset by student rank so
      // different students do not all receive the same leading subset.
      const randomizedPool = seededShuffle(pool, `assignment:${a.id}`)
      const requestedCount = Number.isFinite(Number(a.question_count))
        ? Number(a.question_count)
        : randomizedPool.length
      const effectiveCount = Math.max(0, Math.min(requestedCount, randomizedPool.length))

      const rankMapForSection = sectionStudentRankMap[a.class_section_id] || {}
      const studentRank = Number.isInteger(rankMapForSection[studentProfile.id])
        ? rankMapForSection[studentProfile.id]
        : 0

      const randomizedQuestions = []
      if (effectiveCount > 0) {
        for (let i = 0; i < effectiveCount; i += 1) {
          const index = (studentRank + i) % randomizedPool.length
          randomizedQuestions.push(randomizedPool[index])
        }
      }

      return {
        id: a.id,
        title: a.title,
        description: a.description,
        questionCount: a.question_count,
        dueAt: a.due_at,
        createdAt: a.created_at,
        sectionId: a.class_section_id,
        course: {
          id: course.id,
          name: course.name,
          code: course.code,
        },
        teacher,
        attendance: {
          attended: attendance.attended,
          total: attendance.total,
          percentage,
          required: requiredThreshold,
        },
        isAccessible: canAccess,
        hasSubmitted: submittedAssignmentIds.has(a.id),
        lastSubmittedAt: submissionTimestamps[a.id] || null,
        blockedReason: canAccess
          ? null
          : `Minimum ${requiredThreshold}% attendance required in this course to access assignment questions.`,
        questions: randomizedQuestions,
      }
    })

    return res.json({ data: responseData })
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
    const teacherId = await getTeacherProfileId(req.supabase, user.id)

    if (!teacherId) {
      return res.status(403).json({ error: 'Teacher profile not found' })
    }

    // Verify teacher is assigned to this section
    const { data: assignment } = await req.supabase
      .from('teacher_assignments')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('class_section_id', classSectionId)
      .single()

    if (!assignment) {
      return res.status(403).json({
        error: 'You are not assigned to this class section'
      })
    }

    // Get assignments for this section
    let assignments = null
    let error = null
    const submissionCountsByAssignment = new Map()

    const { data: sectionStudents, error: sectionStudentsError } = await req.supabase
      .from('enrollments')
      .select('student_id')
      .eq('class_section_id', classSectionId)

    if (sectionStudentsError) {
      return res.status(500).json({ error: sectionStudentsError.message })
    }

    const studentIds = Array.from(new Set((sectionStudents || [])
      .map((row) => row.student_id)
      .filter(Boolean)))

    const { data: sessionRows, error: sessionError } = await req.supabase
      .from('attendance_sessions')
      .select('id')
      .eq('class_section_id', classSectionId)

    if (sessionError) {
      return res.status(500).json({ error: sessionError.message })
    }

    const sessionIds = (sessionRows || []).map((row) => row.id)
    const attendanceByStudent = new Map()

    if (studentIds.length > 0 && sessionIds.length > 0) {
      const { data: attendanceRows, error: attendanceError } = await req.supabase
        .from('attendance_records')
        .select('student_id, session_id, status')
        .in('student_id', studentIds)
        .in('session_id', sessionIds)

      if (attendanceError) {
        return res.status(500).json({ error: attendanceError.message })
      }

      const attendanceMap = new Map()
      for (const row of attendanceRows || []) {
        if (!row?.student_id || !row?.session_id) continue
        attendanceMap.set(`${row.student_id}:${row.session_id}`, row.status)
      }

      for (const studentId of studentIds) {
        let attended = 0
        let total = 0

        for (const sessionId of sessionIds) {
          total += 1
          const status = attendanceMap.get(`${studentId}:${sessionId}`) || 'absent'
          if (status === 'present' || status === 'late') {
            attended += 1
          }
        }

        attendanceByStudent.set(studentId, {
          attended,
          total,
          percentage: total > 0 ? (attended / total) * 100 : 0,
        })
      }
    }

    const sectionAssignmentsQuery = await req.supabase
      .from('assignments')
      .select(`
        id,
        title,
        question_count,
        due_at,
        description,
        created_at,
        attendance_threshold,
        assignment_questions (count)
      `)
      .eq('class_section_id', classSectionId)
      .order('created_at', { ascending: false })

    assignments = sectionAssignmentsQuery.data
    error = sectionAssignmentsQuery.error

    if (error && isMissingAttendanceThresholdColumn(error)) {
      const fallbackQuery = await req.supabase
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

      assignments = (fallbackQuery.data || []).map((row) => ({
        ...row,
        attendance_threshold: DEFAULT_ASSIGNMENT_ATTENDANCE_THRESHOLD,
      }))
      error = fallbackQuery.error
    }

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    const assignmentIds = assignments.map((item) => item.id).filter(Boolean)
    if (assignmentIds.length > 0) {
      const { data: submissionRows, error: submissionError } = await supabaseAdmin
        .from('assignment_submissions')
        .select('assignment_id, student_id')
        .in('assignment_id', assignmentIds)

      if (submissionError) {
        return res.status(500).json({ error: submissionError.message })
      }

      for (const row of submissionRows || []) {
        if (!row?.assignment_id || !row?.student_id) continue
        if (!submissionCountsByAssignment.has(row.assignment_id)) {
          submissionCountsByAssignment.set(row.assignment_id, new Set())
        }
        submissionCountsByAssignment.get(row.assignment_id).add(row.student_id)
      }
    }

    const data = assignments.map((a) => {
      const attendanceThreshold = Number.isFinite(Number(a.attendance_threshold))
        ? Number(a.attendance_threshold)
        : DEFAULT_ASSIGNMENT_ATTENDANCE_THRESHOLD

      const eligibleStudentIds = Array.from(attendanceByStudent.entries())
        .filter(([, stats]) => stats.percentage >= attendanceThreshold)
        .map(([studentId]) => studentId)

      const eligibleStudentSet = new Set(eligibleStudentIds)
      const submissionSet = submissionCountsByAssignment.get(a.id) || new Set()
      const totalSubmissions = Array.from(submissionSet).filter((studentId) => eligibleStudentSet.has(studentId)).length

      return {
        id: a.id,
        title: a.title,
        description: a.description,
        questionCount: a.question_count,
        attendanceThreshold,
        eligibleStudents: eligibleStudentIds.length,
        totalSubmissions,
        dueAt: a.due_at,
        createdAt: a.created_at,
        questionsLinked: a.assignment_questions?.[0]?.count || 0,
      }
    })

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
    const teacherId = await getTeacherProfileId(req.supabase, user.id)

    if (!classSectionId || !questionText) {
      return res.status(400).json({
        error: 'classSectionId and questionText are required'
      })
    }

    if (!teacherId) {
      return res.status(403).json({ error: 'Teacher profile not found' })
    }

    // Verify user is a teacher assigned to this section
    const { data: assignment } = await req.supabase
      .from('teacher_assignments')
      .select('id')
      .eq('teacher_id', teacherId)
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
        created_by: teacherId,
        question_text: questionText.trim(),
        topic: topic?.trim() || null,
        difficulty: normalizeDifficulty(difficulty),
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
 * POST /api/v1/assignments/questions/extract
 * Extract questions from a DOCX/PDF for preview.
 * Body (multipart): { docFile, classSectionId }
 */
router.post('/questions/extract', upload.single('docFile'), async (req, res) => {
  try {
    const { classSectionId } = req.body
    const user = req.user
    const teacherId = await getTeacherProfileId(req.supabase, user.id)

    if (!classSectionId) {
      return res.status(400).json({ error: 'classSectionId is required' })
    }

    if (!teacherId) {
      return res.status(403).json({ error: 'Teacher profile not found' })
    }

    const isAssigned = await ensureTeacherAssigned(req.supabase, teacherId, classSectionId)
    if (!isAssigned) {
      return res.status(403).json({ error: 'You are not assigned to this class section' })
    }

    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'docFile is required' })
    }

    const rawText = await extractTextFromUpload(req.file)
    if (rawText == null) {
      return res.status(400).json({ error: 'Only PDF or DOCX files are supported' })
    }

    if (!rawText.trim()) {
      return res.status(400).json({ error: 'Document appears to be empty' })
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KEY is missing on the server' })
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

    const prompt = `You are extracting exam questions from a document.

Extract ALL questions from the text below. Return ONLY a valid JSON array, no explanation, no markdown, no backticks.

Each item in the array should be:
{ "question": "the full question text here" }

Rules:
- Include every question you find, even if it seems incomplete
- Preserve numbering and labels exactly (1., 2), Q1., (a), (b), etc.)
- Preserve indentation and line breaks as in the source text
- Indentation is encoded as [TAB] and [SP] tokens at the start of lines. Keep them exactly.
- Preserve the full question text including any sub-parts
- If a line is clearly not a question (headings, instructions, page numbers), skip it

Document text:
${encodeIndentation(rawText)}`

    const response = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response?.choices?.[0]?.message?.content || ''
    const cleaned = stripMarkdownJson(raw)
    let parsed = null
    try {
      parsed = JSON.parse(cleaned)
    } catch (parseError) {
      return res.status(400).json({ error: 'Failed to parse Grok response as JSON' })
    }

    const items = Array.isArray(parsed) ? parsed : parsed?.questions
    const questions = (items || [])
      .map((item) => ({
        question: decodeIndentation(
          String(item?.question || item?.question_text || item?.text || '')
            .replace(/\r\n/g, '\n')
            .trimEnd()
        ),
      }))
      .filter((item) => item.question)

    return res.json({
      totalFound: questions.length,
      questions,
    })
  } catch (err) {
    console.error('POST /assignments/questions/extract error:', err)
    return res.status(500).json({ error: 'Failed to extract questions' })
  }
})

/**
 * POST /api/v1/assignments/questions/confirm
 * Confirm and insert extracted questions into the question bank.
 * Body: { classSectionId, questions: [{question}], topic?, difficulty? }
 */
router.post('/questions/confirm', async (req, res) => {
  try {
    const { classSectionId, questions, topic, difficulty } = req.body
    const user = req.user
    const teacherId = await getTeacherProfileId(req.supabase, user.id)

    if (!classSectionId) {
      return res.status(400).json({ error: 'classSectionId is required' })
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'questions must be a non-empty array' })
    }

    if (!teacherId) {
      return res.status(403).json({ error: 'Teacher profile not found' })
    }

    const isAssigned = await ensureTeacherAssigned(req.supabase, teacherId, classSectionId)
    if (!isAssigned) {
      return res.status(403).json({ error: 'You are not assigned to this class section' })
    }

    const cleaned = questions
      .map((item) => {
        const questionText = String(item?.question || item?.question_text || item?.text || '').trim()
        if (!questionText) return null
        return {
          questionText,
          difficulty: normalizeDifficulty(item?.difficulty || difficulty),
          topic: String(item?.topic || '').trim(),
        }
      })
      .filter(Boolean)

    if (cleaned.length === 0) {
      return res.status(400).json({ error: 'No valid questions provided' })
    }

    const rows = cleaned.map((item) => ({
      class_section_id: classSectionId,
      created_by: teacherId,
      question_text: item.questionText,
      topic: item.topic || topic?.trim() || null,
      difficulty: item.difficulty,
    }))

    const { data, error } = await req.supabase
      .from('question_bank')
      .insert(rows)
      .select('id')

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    return res.status(201).json({
      inserted: data?.length || 0,
    })
  } catch (err) {
    console.error('POST /assignments/questions/confirm error:', err)
    return res.status(500).json({ error: 'Failed to confirm questions' })
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
    const teacherId = await getTeacherProfileId(req.supabase, user.id)

    if (!teacherId) {
      return res.status(403).json({ error: 'Teacher profile not found' })
    }

    // Verify user is a teacher assigned to this section
    const { data: assignment } = await req.supabase
      .from('teacher_assignments')
      .select('id')
      .eq('teacher_id', teacherId)
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
 * POST /api/v1/assignments/:id/link-questions
 * Link existing question bank items to an assignment
 * Body: { questionIds: string[] }
 */
router.post('/:id/link-questions', async (req, res) => {
  try {
    const { id: assignmentId } = req.params
    const { questionIds } = req.body
    const user = req.user
    const teacherId = await getTeacherProfileId(req.supabase, user.id)

    if (!teacherId) {
      return res.status(403).json({ error: 'Teacher profile not found' })
    }

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({ error: 'questionIds must be a non-empty array' })
    }

    const uniqueQuestionIds = [...new Set(questionIds.filter(Boolean))]
    if (uniqueQuestionIds.length === 0) {
      return res.status(400).json({ error: 'No valid question IDs provided' })
    }

    const { data: assignment, error: assignmentError } = await req.supabase
      .from('assignments')
      .select('id, class_section_id, created_by')
      .eq('id', assignmentId)
      .single()

    if (assignmentError || !assignment) {
      return res.status(404).json({ error: 'Assignment not found' })
    }

    if (assignment.created_by !== teacherId) {
      return res.status(403).json({ error: 'You can only update your own assignments' })
    }

    const { data: validQuestions, error: questionsError } = await req.supabase
      .from('question_bank')
      .select('id')
      .in('id', uniqueQuestionIds)
      .eq('class_section_id', assignment.class_section_id)

    if (questionsError) {
      return res.status(400).json({ error: questionsError.message })
    }

    const validIds = (validQuestions || []).map((q) => q.id)
    if (validIds.length === 0) {
      return res.status(400).json({ error: 'No matching questions found for this assignment section' })
    }

    const links = validIds.map((questionId) => ({
      assignment_id: assignmentId,
      question_id: questionId,
    }))

    const { data, error } = await req.supabase
      .from('assignment_questions')
      .upsert(links, { onConflict: 'assignment_id,question_id' })
      .select('assignment_id, question_id')

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    return res.json({
      data: {
        assignmentId,
        linkedCount: data?.length || 0,
      },
    })
  } catch (err) {
    console.error('POST /assignments/:id/link-questions error:', err)
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
    const teacherId = await getTeacherProfileId(req.supabase, user.id)

    if (!teacherId) {
      return res.status(403).json({ error: 'Teacher profile not found' })
    }

    // Get assignment and verify ownership
    const { data: assignment, error: getError } = await req.supabase
      .from('assignments')
      .select('id, class_section_id, created_by')
      .eq('id', assignmentId)
      .single()

    if (getError || !assignment) {
      return res.status(404).json({ error: 'Assignment not found' })
    }

    if (assignment.created_by !== teacherId) {
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

/**
 * POST /api/v1/assignments/:id/submit
 * Upload an assignment submission
 */
router.post('/:id/submit', upload.single('file'), async (req, res) => {
  try {
    const { id: assignmentId } = req.params
    const file = req.file
    const user = req.user

    if (!file) return res.status(400).json({ error: 'No file provided' })
    if (file.mimetype !== 'application/pdf') return res.status(400).json({ error: 'Only PDF files are allowed' })
    if (file.size > 200 * 1024) return res.status(400).json({ error: 'File size must not exceed 200KB' })

    const { data: studentProfile } = await req.supabase
      .from('student_profiles')
      .select('id')
      .eq('profile_id', user.id)
      .single()

    if (!studentProfile) return res.status(403).json({ error: 'Student profile not found' })

    const { data: assignment, error: assignmentError } = await req.supabase
      .from('assignments')
      .select('id, due_at')
      .eq('id', assignmentId)
      .single()

    if (assignmentError || !assignment) {
      return res.status(404).json({ error: 'Assignment not found' })
    }

    if (assignment.due_at) {
      const dueAt = new Date(assignment.due_at)
      if (Number.isFinite(dueAt.getTime()) && Date.now() > dueAt.getTime()) {
        return res.status(400).json({ error: 'Assignment deadline has passed.' })
      }
    }

    const { data: existingSubmissionDetails } = await supabaseAdmin
      .from('assignment_submissions')
      .select('id, file_url')
      .eq('student_id', studentProfile.id)
      .eq('assignment_id', assignmentId)
      .single()

    const filePath = `${assignmentId}/${studentProfile.id}/${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`

    const { error: uploadError } = await supabaseAdmin.storage
      .from('submissions')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
      })

    if (uploadError) return res.status(400).json({ error: uploadError.message })

    if (existingSubmissionDetails) {
      const { error: updateError } = await supabaseAdmin
        .from('assignment_submissions')
        .update({
          file_url: filePath,
          submitted_at: new Date().toISOString(),
        })
        .eq('id', existingSubmissionDetails.id)

      if (updateError) {
        return res.status(400).json({ error: 'Failed to update submission in database' })
      }

      if (existingSubmissionDetails.file_url) {
        await supabaseAdmin.storage
          .from('submissions')
          .remove([existingSubmissionDetails.file_url])
      }
    } else {
      const { error: insertError } = await supabaseAdmin
        .from('assignment_submissions')
        .insert({
          student_id: studentProfile.id,
          assignment_id: assignmentId,
          file_url: filePath
        })

      if (insertError) {
        return res.status(400).json({ error: 'Failed to record submission in database' })
      }
    }

    return res.json({ success: true, message: 'Assignment submitted successfully!' })
  } catch (err) {
    console.error('POST /assignments/:id/submit error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/v1/assignments/:id/submissions
 * Get submissions for an assignment
 */
router.get('/:id/submissions', async (req, res) => {
  try {
    const { id: assignmentId } = req.params
    const user = req.user
    const teacherId = await getTeacherProfileId(req.supabase, user.id)

    if (!teacherId) {
      return res.status(403).json({ error: 'Teacher profile not found' })
    }

    const { data: assignment, error: getError } = await req.supabase
      .from('assignments')
      .select('id, created_by')
      .eq('id', assignmentId)
      .single()

    if (getError || !assignment || assignment.created_by !== teacherId) {
      return res.status(403).json({ error: 'Not authorized to view submissions for this assignment' })
    }

    const { data: submissions, error: subError } = await supabaseAdmin
      .from('assignment_submissions')
      .select(`
        student_id,
        file_url,
        submitted_at,
        student_profiles (
          id,
          roll_number,
          year_of_study,
          department,
          section,
          profiles ( full_name )
        )
      `)
      .eq('assignment_id', assignmentId)

    if (subError) return res.status(400).json({ error: subError.message })
    if (!submissions || submissions.length === 0) return res.json({ data: [] })

    const data = await Promise.all(submissions.map(async (sub) => {
      const { data: urlData } = await supabaseAdmin.storage
        .from('submissions')
        .createSignedUrl(sub.file_url, 3600)
        
      const info = sub.student_profiles
      return {
        student_id: sub.student_id,
        file_name: sub.file_url.split('/').pop(),
        submitted_at: sub.submitted_at,
        file_url: urlData?.signedUrl,
        student_name: info?.profiles?.full_name || 'Unknown Student',
        roll_number: info?.roll_number || 'N/A',
        department: info?.department || 'N/A',
        year: info?.year_of_study || 'N/A',
        section: info?.section || 'N/A'
      }
    }))

    return res.json({ data })
  } catch (err) {
    console.error('GET /assignments/:id/submissions error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router