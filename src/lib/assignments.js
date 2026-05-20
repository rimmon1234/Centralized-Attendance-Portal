import { apiFetch } from './api'

const CACHE_TTL_MS = 2 * 60 * 1000
const STALE_WINDOW_MS = 5 * 60 * 1000

export async function getMyAssignments() {
  try {
    const result = await apiFetch('/api/v1/assignments/student', {
      cache: true,
      cacheTtlMs: CACHE_TTL_MS,
      staleWindowMs: STALE_WINDOW_MS,
      staleWhileRevalidate: true,
    })
    return { data: result.data || [], error: null }
  } catch (err) {
    return { data: [], error: err }
  }
}

export async function getAssignmentsForSection(classSectionId) {
  try {
    const result = await apiFetch(`/api/v1/assignments/sections/${classSectionId}`, {
      cache: true,
      cacheTtlMs: CACHE_TTL_MS,
      staleWindowMs: STALE_WINDOW_MS,
      staleWhileRevalidate: true,
    })
    return { data: result.data || [], error: null }
  } catch (err) {
    return { data: [], error: err }
  }
}

export async function createAssignment(payload) {
  try {
    const result = await apiFetch('/api/v1/assignments', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return { data: result.data, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

export async function getQuestionBank(sectionId) {
  try {
    const result = await apiFetch(`/api/v1/assignments/questions/${sectionId}`, {
      cache: true,
      cacheTtlMs: CACHE_TTL_MS,
      staleWindowMs: STALE_WINDOW_MS,
      staleWhileRevalidate: true,
    })
    return { data: result.data || [], error: null }
  } catch (err) {
    return { data: [], error: err }
  }
}

export async function addQuestion(payload) {
  try {
    const result = await apiFetch('/api/v1/assignments/questions', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return { data: result.data, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

export async function extractQuestionBankFromFile(file, classSectionId) {
  try {
    const formData = new FormData()
    formData.append('docFile', file)
    formData.append('classSectionId', classSectionId)

    const result = await apiFetch('/api/v1/assignments/questions/extract', {
      method: 'POST',
      body: formData,
      headers: {},
    })

    return { data: result, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

export async function confirmQuestionBankBulk(classSectionId, questions, topic, difficulty) {
  try {
    const result = await apiFetch('/api/v1/assignments/questions/confirm', {
      method: 'POST',
      body: JSON.stringify({ classSectionId, questions, topic, difficulty }),
    })
    return { data: result, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

export async function linkQuestionsToAssignment(assignmentId, questionIds) {
  try {
    const result = await apiFetch(`/api/v1/assignments/${assignmentId}/link-questions`, {
      method: 'POST',
      body: JSON.stringify({ questionIds }),
    })
    return { data: result.data, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}
