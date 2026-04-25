import { supabase } from './supabase'
import { apiFetch } from './api'

export async function getTeacherAssignedCourses() {
  try {
    const { data: user } = await supabase.auth.getUser()
    if (!user?.user?.id) return { error: 'Not authenticated' }

    const result = await apiFetch(`/api/v1/admin/teacher-assignments?teacherId=${user.user.id}`, {
      cache: false,
      forceRefresh: true,
    })

    return { data: result.data || [], error: null }
  } catch (err) {
    console.error('Error fetching teacher assignments:', err)
    return { data: [], error: err.message }
  }
}
