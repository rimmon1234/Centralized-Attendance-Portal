import React, { useState, useEffect } from 'react';
import AppLayout from '../../components/shared/AppLayout';

const timeSlots = [
  "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
  "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM"
];

const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

const mockSchedule = [
  // MON
  { day: 'MON', group: 'ALL', start: 0, duration: 2, title: 'CSE2201 Lecture', instructor: 'Prof. SM', room: 'ICT312', type: 'lecture' },
  { day: 'MON', group: 'ALL', start: 2, duration: 1, title: 'CSE2202 Lecture', instructor: 'Prof. DBS', room: 'ICT312', type: 'lecture' },
  { day: 'MON', group: 'ALL', start: 3, duration: 1, title: 'Lunch Break', type: 'break', isBreak: true },
  { day: 'MON', group: 'ALL', start: 4, duration: 1, title: 'CSE2203 Lecture', instructor: 'Prof. RRC', room: 'ICT308', type: 'lecture' },
  { day: 'MON', group: 'GR1', start: 5, duration: 2, title: 'CSE2254 Lab', instructor: 'AS', room: 'ICTB02', type: 'lab' },
  { day: 'MON', group: 'GR2', start: 5, duration: 2, title: 'AEI2255 Lab', instructor: 'IN+DMG', room: 'ICT 002', type: 'lab' },
  { day: 'MON', group: 'ALL', start: 7, duration: 1, title: 'Life Skills', instructor: 'BB', room: 'ICT207', type: 'lecture' },

  // TUE
  { day: 'TUE', group: 'GR1', start: 0, duration: 3, title: 'CSE2252 Lab', instructor: 'DBS', room: 'ICTB10', type: 'lab' },
  { day: 'TUE', group: 'GR2', start: 0, duration: 3, title: 'CSE2253 Lab', instructor: 'SDB', room: 'ICTB03', type: 'lab' },
  { day: 'TUE', group: 'ALL', start: 3, duration: 1, title: 'Lunch Break', type: 'break', isBreak: true },
  { day: 'TUE', group: 'GR1', start: 4, duration: 2, title: 'AEI2255 Lab', instructor: 'IN+DMG', room: 'ICT 002', type: 'lab' },
  { day: 'TUE', group: 'GR1', start: 6, duration: 1, title: 'Library', type: 'self-study' },
  { day: 'TUE', group: 'GR2', start: 4, duration: 3, title: 'CSE2252 Lab', instructor: 'PSD', room: 'ICTB10', type: 'lab' },
  { day: 'TUE', group: 'ALL', start: 7, duration: 1, title: 'AEI2205 Lecture', instructor: 'Prof. IN', room: 'ICT207', type: 'lecture' },
  { day: 'TUE', group: 'ALL', start: 8, duration: 1, title: 'Remedial', room: 'ICT207', type: 'lecture' },

  // WED
  { day: 'WED', group: 'ALL', start: 0, duration: 1, title: 'AEI2205 Lecture', instructor: 'Prof. IN', room: 'ICT207', type: 'lecture' },
  { day: 'WED', group: 'ALL', start: 1, duration: 1, title: 'MTH2201 Lecture', instructor: 'Prof. SG', room: 'ICT207', type: 'lecture' },
  { day: 'WED', group: 'ALL', start: 2, duration: 1, title: 'CSE2202 Lecture', instructor: 'Prof. DBS', room: 'ICT312', type: 'lecture' },
  { day: 'WED', group: 'ALL', start: 3, duration: 1, title: 'Lunch Break', type: 'break', isBreak: true },
  { day: 'WED', group: 'ALL', start: 4, duration: 1, title: 'CSE2203 Lecture', instructor: 'Prof. SDB', room: 'ICT304', type: 'lecture' },
  { day: 'WED', group: 'ALL', start: 5, duration: 1, title: 'MTH2201 Lecture', instructor: 'Prof. AP', room: 'ICT207', type: 'lecture' },
  { day: 'WED', group: 'ALL', start: 6, duration: 1, title: 'CSE2203 Lecture', instructor: 'Prof. RRC', room: 'ICT207', type: 'lecture' },
  { day: 'WED', group: 'ALL', start: 7, duration: 1, title: 'Mentoring', type: 'lecture' },

  // THU
  { day: 'THU', group: 'ALL', start: 0, duration: 1, title: 'MTH2201 Lecture', instructor: 'Prof. SG', room: 'ICT312', type: 'lecture' },
  { day: 'THU', group: 'ALL', start: 1, duration: 1, title: 'CSE2203 Lecture', instructor: 'Prof. SDB', room: 'ICT312', type: 'lecture' },
  { day: 'THU', group: 'ALL', start: 2, duration: 1, title: 'CSE2202 Lecture', instructor: 'Prof. DBS', room: 'ICT308', type: 'lecture' },
  { day: 'THU', group: 'ALL', start: 3, duration: 1, title: 'Lunch Break', type: 'break', isBreak: true },
  { day: 'THU', group: 'ALL', start: 4, duration: 1, title: 'CSE2202 Lecture', instructor: 'Prof. DBS', room: 'ICT308', type: 'lecture' },
  { day: 'THU', group: 'GR1', start: 5, duration: 3, title: 'CSE2251 Lab', instructor: 'SCB', room: 'ICTB03', type: 'lab' },
  { day: 'THU', group: 'GR2', start: 5, duration: 2, title: 'CSE2254 Lab', instructor: 'AS', room: 'ICTB09', type: 'lab' },
  { day: 'THU', group: 'GR2', start: 7, duration: 1, title: 'Library', type: 'self-study' },

  // FRI
  { day: 'FRI', group: 'ALL', start: 0, duration: 1, title: 'CSE2201 Lecture', instructor: 'Prof. SCB', room: 'ICT304', type: 'lecture' },
  { day: 'FRI', group: 'ALL', start: 1, duration: 1, title: 'AEI2205 Lecture', instructor: 'Prof. IN', room: 'ICT304', type: 'lecture' },
  { day: 'FRI', group: 'ALL', start: 2, duration: 1, title: 'MTH2201 Lecture', instructor: 'Prof. AP', room: 'ICT304', type: 'lecture' },
  { day: 'FRI', group: 'ALL', start: 3, duration: 1, title: 'Lunch Break', type: 'break', isBreak: true },
  { day: 'FRI', group: 'ALL', start: 4, duration: 1, title: 'CSE2201 Lecture', instructor: 'Prof. SCB', room: 'ICT311', type: 'lecture' },
  { day: 'FRI', group: 'GR1', start: 5, duration: 3, title: 'CSE2253 Lab', instructor: 'RRC', room: 'ICTB03', type: 'lab' },
  { day: 'FRI', group: 'GR2', start: 5, duration: 3, title: 'CSE2251 Lab', instructor: 'SCB', room: 'ICTB02', type: 'lab' }
];

const getTypeStyles = (type) => {
  switch(type) {
    case 'lecture': 
      return 'bg-gradient-to-br from-indigo-500/10 to-indigo-600/20 border border-indigo-500/30 hover:border-indigo-400/60 shadow-[0_4px_20px_-10px_rgba(99,102,241,0.1)] text-indigo-50';
    case 'lab': 
      return 'bg-gradient-to-br from-emerald-500/10 to-emerald-600/20 border border-emerald-500/30 hover:border-emerald-400/60 shadow-[0_4px_20px_-10px_rgba(16,185,129,0.1)] text-emerald-50';
    case 'break': 
      return 'bg-slate-800/30 border border-slate-700/50 text-slate-500 border-dashed';
    case 'self-study': 
      return 'bg-slate-800/50 border border-slate-600/40 hover:border-slate-500/60 text-slate-300';
    default: 
      return 'bg-slate-800/60 border border-slate-600/50 text-slate-200';
  }
}

export default function StudentSchedule() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger entrance animation after component mounts
    setMounted(true);
  }, []);

  return (
    <AppLayout title="Schedule">
      <div className="p-4 md:p-8 max-w-[1400px] mx-auto min-h-[calc(100vh-80px)] flex flex-col">
        {/* Header Section */}
        <div 
          className={`flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8 transition-all duration-700 transform ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Class Schedule</h1>
            <p className="text-gray-500 mt-2 text-lg">Your weekly academic timeline</p>
          </div>
          
          <div className="bg-slate-900 rounded-2xl p-4 flex items-center gap-4 shadow-xl shadow-slate-900/10 sm:min-w-[280px]">
            <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-indigo-400">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                <line x1="16" x2="16" y1="2" y2="6"/>
                <line x1="8" x2="8" y1="2" y2="6"/>
                <line x1="3" x2="21" y1="10" y2="10"/>
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Current Section</p>
              <p className="text-sm font-medium text-slate-200 mt-0.5">CSE Section B • 2nd Year</p>
            </div>
          </div>
        </div>

        {/* Schedule Grid Container - Modern Dark Theme */}
        <div 
          className={`flex-1 bg-slate-900 rounded-[2rem] border border-slate-800 shadow-2xl overflow-hidden flex flex-col transition-all duration-1000 delay-100 transform ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {/* Internal padding for the scrollable area */}
          <div className="p-4 md:p-6 overflow-x-auto custom-scrollbar flex-1">
            <div 
              className="grid gap-2.5 select-none" 
              style={{ 
                gridTemplateColumns: '60px 35px repeat(9, minmax(160px, 1fr))',
                gridAutoRows: 'minmax(35px, auto)'
              }}
            >
              
              {/* Layer 1: Continuous Grid Lines for Time Axes and Days */}
              {/* Vertical Lines */}
              {timeSlots.map((_, i) => (
                <div 
                  key={`vline-${i}`} 
                  className="border-l border-slate-800/60 pointer-events-none" 
                  style={{ gridColumn: `${i+3}/${i+4}`, gridRow: '1/12' }}
                ></div>
              ))}
              {/* End border for the last column */}
              <div className="border-l border-slate-800/60 pointer-events-none" style={{ gridColumn: '12/13', gridRow: '1/12' }}></div>

              {/* Horizontal Lines between Days */}
              {days.map((_, i) => (
                <div 
                  key={`hline-${i}`} 
                  className="border-t border-slate-800/60 pointer-events-none" 
                  style={{ gridColumn: '1/13', gridRow: `${2 + i*2}/${2 + i*2 + 1}` }}
                ></div>
              ))}

              {/* Time Slot Headers */}
              {timeSlots.map((slot, i) => (
                <div 
                  key={`header-slot-${i}`} 
                  className="pb-2 pt-1 font-semibold text-left pl-3 text-[12px] text-slate-500 z-10" 
                  style={{ gridColumn: `${i+3}/${i+4}`, gridRow: '1/2' }}
                >
                  {slot}
                </div>
              ))}

              {/* Corner Empty Space */}
              <div style={{ gridColumn: '1/3', gridRow: '1/2' }}></div>

              {/* Day & Group Labels */}
              {days.map((day, i) => {
                const rowBase = 2 + i * 2;
                return (
                  <React.Fragment key={`label-${day}`}>
                    <div 
                      className="font-bold text-slate-200 text-center flex items-center justify-center text-lg tracking-wider z-10" 
                      style={{ gridColumn: '1/2', gridRow: `${rowBase}/${rowBase+2}` }}
                    >
                      {day}
                    </div>
                    <div 
                      className="font-medium text-slate-500 text-center flex items-center justify-center text-xs z-10 bg-slate-800/30 rounded-l-xl my-0.5 border-y border-l border-slate-800/50" 
                      style={{ gridColumn: '2/3', gridRow: `${rowBase}/${rowBase+1}` }}
                    >
                      G1
                    </div>
                    <div 
                      className="font-medium text-slate-500 text-center flex items-center justify-center text-xs z-10 bg-slate-800/30 rounded-l-xl my-0.5 border-y border-l border-slate-800/50" 
                      style={{ gridColumn: '2/3', gridRow: `${rowBase+1}/${rowBase+2}` }}
                    >
                      G2
                    </div>
                  </React.Fragment>
                );
              })}

              {/* Layer 2: Animated Schedule Items */}
              {mockSchedule.map((item, i) => {
                const dayIndex = days.indexOf(item.day);
                const rowBase = 2 + dayIndex * 2;
                let rowStart = rowBase;
                let rowEnd = rowBase + 2;

                // Provide a slight visual margin if it's a specific group
                let marginTop = 'mt-0';
                let marginBottom = 'mb-0';

                if (item.group === 'GR1') {
                  rowEnd = rowBase + 1;
                  marginBottom = 'mb-1';
                } else if (item.group === 'GR2') {
                  rowStart = rowBase + 1;
                  marginTop = 'mt-1';
                }

                const colStart = 3 + item.start;
                const colEnd = colStart + item.duration;
                
                const isBreak = item.isBreak;
                const styleClasses = getTypeStyles(item.type);

                return (
                  <div 
                    key={`item-${i}`} 
                    className={`
                      ${styleClasses} 
                      ${marginTop} ${marginBottom}
                      rounded-[10px] z-20 px-3 py-2.5
                      flex flex-col justify-center items-center text-center
                      transition-all duration-300 ease-out backdrop-blur-md
                      ${!isBreak ? 'hover:-translate-y-1 hover:scale-[1.02] hover:z-30 cursor-pointer shadow-lg' : ''}
                      group overflow-hidden
                    `} 
                    style={{ 
                      gridColumn: `${colStart}/${colEnd}`, 
                      gridRow: `${rowStart}/${rowEnd}`,
                      // Adding a staggered animation delay based on day and start time
                      animationDelay: `${(dayIndex * 100) + (item.start * 50)}ms`,
                      animationFillMode: 'both',
                      animation: mounted ? `fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards` : 'none'
                    }}
                  >
                    {isBreak ? (
                      <div className="text-center w-full h-full flex items-center justify-center uppercase tracking-widest text-sm font-bold opacity-60 text-slate-400">
                        {item.title}
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col items-center justify-center w-full gap-1 mb-2">
                          <span className="font-bold text-[14px] leading-tight group-hover:text-white transition-colors break-words text-center">
                            {item.title}
                          </span>
                          {item.group !== 'ALL' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/10 text-white/80 whitespace-nowrap mt-0.5">
                              {item.group}
                            </span>
                          )}
                        </div>
                        
                        {(item.room || item.instructor) && (
                          <div className="flex flex-col items-center gap-y-1.5 text-[12px] opacity-85 group-hover:opacity-100 transition-opacity">
                            {item.room && (
                              <div className="flex items-center gap-1.5">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                                <span className="truncate">{item.room}</span>
                              </div>
                            )}
                            {item.instructor && (
                              <div className="flex items-center gap-1.5">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                <span className="truncate">{item.instructor}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}

            </div>
          </div>
          
          {/* Subtle footer */}
          <div className="bg-slate-950/50 px-8 py-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
            <div className="flex gap-4">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500/50"></div> Lecture
              </span>
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500/50"></div> Lab
              </span>
            </div>
            <p>Targeting 100% attendance</p>
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}} />
    </AppLayout>
  );
}
