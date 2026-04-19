export const mockSkipData = {
  overall: {
    totalClasses: 180,
    attendedClasses: 142,
    percentage: 78.89,
  },
  subjects: [
    {
      id: 'cs-101',
      name: 'Data Structures & Algorithms',
      code: 'CS101',
      totalClasses: 45,
      attendedClasses: 38,
      percentage: 84.44,
      teachers: [
        { id: 't1', name: 'Dr. Alan Turing', total: 25, attended: 21 },
        { id: 't2', name: 'Prof. Grace Hopper', total: 20, attended: 17 }
      ]
    },
    {
      id: 'cs-102',
      name: 'Computer Networks',
      code: 'CS102',
      totalClasses: 40,
      attendedClasses: 28,
      percentage: 70.00,
      teachers: [
        { id: 't3', name: 'Dr. Vint Cerf', total: 40, attended: 28 }
      ]
    },
    {
      id: 'cs-103',
      name: 'Operating Systems',
      code: 'CS103',
      totalClasses: 55,
      attendedClasses: 48,
      percentage: 87.27,
      teachers: [
        { id: 't4', name: 'Prof. Linus Torvalds', total: 30, attended: 27 },
        { id: 't5', name: 'Dr. Ken Thompson', total: 25, attended: 21 }
      ]
    },
    {
      id: 'cs-104',
      name: 'Database Management Systems',
      code: 'CS104',
      totalClasses: 40,
      attendedClasses: 28,
      percentage: 70.00,
      teachers: [
        { id: 't6', name: 'Dr. Edgar Codd', total: 40, attended: 28 }
      ]
    }
  ]
};
