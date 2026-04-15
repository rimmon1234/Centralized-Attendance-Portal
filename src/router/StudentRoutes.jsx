import { Routes, Route, Navigate } from 'react-router-dom'

import StudentDashboard from '../pages/student/StudentDashboard'
import StudentSchedule from '../pages/student/StudentSchedule'
import StudentAssignments from '../pages/student/StudentAssignments'
import StudentNotes from '../pages/student/StudentNotes'
import StudentLectureDetails from '../pages/student/StudentLectureDetails'
import StudentLabDetails from '../pages/student/StudentLabDetails'

export default function StudentRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<StudentDashboard />} />
      <Route path="/schedule" element={<StudentSchedule />} />
      <Route path="/assignments" element={<StudentAssignments />} />
      <Route path="/notes" element={<StudentNotes />} />
      <Route path="/lectures" element={<StudentLectureDetails />} />
      <Route path="/labs" element={<StudentLabDetails />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}