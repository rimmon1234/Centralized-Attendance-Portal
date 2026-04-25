import { apiFetch } from './api'

export async function getMyAssignments() {
  try {
    const result = await apiFetch('/api/v1/assignments/student', {
      cache: false,
      forceRefresh: true,
    })
    return { data: result.data || [], error: null }
  } catch (err) {
    return { data: [], error: err }
  }
}

export async function getAssignmentsForSection(classSectionId) {
  try {
    const result = await apiFetch(`/api/v1/assignments/sections/${classSectionId}`, {
      cache: false,
      forceRefresh: true,
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
      cache: false,
      forceRefresh: true,
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
