import { supabase } from './supabase'

export async function getTeacherAssignedCourses() {
  try {
    const { data: user } = await supabase.auth.getUser()
    if (!user?.user?.id) return { error: 'Not authenticated' }

    const response = await fetch(
      `/api/v1/admin/teacher-assignments?teacherId=${user.user.id}`,
      {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch assignments')
    }

    return await response.json()
  } catch (err) {
    console.error('Error fetching teacher assignments:', err)
    return { error: err.message }
  }
}
