export async function getStudentContacts() {
  // Mock data for contacts keeping options open for future database connection
  return {
    data: [
      {
        subjectId: 'S001',
        subjectName: 'Object Oriented Programming',
        type: 'Lecture',
        teachers: [
          {
            id: 'T001',
            name: 'Dr. Alan Turing',
            email: 'alan.turing@example.com',
            phone: '+1 234 567 8900',
            role: 'Primary Instructor'
          }
        ]
      },
      {
        subjectId: 'S003',
        subjectName: 'Database Management Systems',
        type: 'Lecture',
        teachers: [
          {
            id: 'T004',
            name: 'Edgar F. Codd',
            email: 'edgar.codd@example.com',
            phone: '',
            role: 'Professor'
          }
        ]
      }
    ],
    error: null
  }
}
