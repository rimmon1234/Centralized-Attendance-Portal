import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const CircularProgress = ({ name, percentage, isOverall, color, size = 150, strokeWidth = 14, delay = 0 }) => {
  const [mounted, setMounted] = useState(false);
  const radius = (size / 2) - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const visualPercentage = Math.min(Math.max(percentage, 0), 100);
  
  // Start offset at maximum to create drawing effect
  const initialOffset = circumference;
  const targetOffset = circumference - (visualPercentage / 100) * circumference;
  
  // Use state for offset to trigger animation after mount
  const [offset, setOffset] = useState(initialOffset);

  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => {
      setOffset(targetOffset);
    }, 100 + delay); // staggering animation
    return () => clearTimeout(timer);
  }, [targetOffset, delay]);

  return (
    <div 
      className={`group relative flex flex-col items-center justify-start p-5 sm:p-6 bg-white border ${
        isOverall ? 'border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.08)]' : 'border-gray-50 shadow-sm hover:border-gray-100 hover:shadow-[0_8px_20px_rgb(0,0,0,0.04)]'
      } rounded-[2rem] transition-all duration-300 ease-out hover:-translate-y-1 overflow-hidden h-full
      ${!mounted ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}
      style={{ transitionDelay: `${mounted ? 0 : delay}ms` }}
    >
      {/* Decorative background glow for overall ring */}
      {isOverall && (
        <div 
          className="absolute inset-0 opacity-5 blur-2xl rounded-full scale-150 transition-all duration-700 ease-in-out group-hover:scale-[1.8]"
          style={{ backgroundColor: color }}
        />
      )}

      <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className={`transform -rotate-90 drop-shadow-sm transition-transform duration-500 ease-out group-hover:scale-105`}
        >
          {/* Background Track - thicker and lighter */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            className="opacity-10"
            strokeLinecap="round"
          />
          {/* Progress Foreground */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center transition-transform duration-300 group-hover:scale-110">
          <span 
            className={`font-black tracking-tight ${isOverall ? 'text-4xl text-gray-900' : 'text-2xl text-gray-800'}`}
            style={{ color: isOverall ? '#111827' : '' }}
          >
            {percentage.toFixed(0)}<span className="text-[0.6em] text-gray-400 font-bold ml-0.5">%</span>
          </span>
        </div>
      </div>
      
      <div className="flex flex-col items-center mt-4 w-full flex-1 justify-between z-10 gap-3">
        <h4 className={`font-bold text-center leading-tight px-1 flex-1 flex items-center ${isOverall ? 'text-gray-900 text-[1.1rem]' : 'text-gray-500 text-[0.95rem]'}`}>
          {name}
        </h4>
        
        {!isOverall && percentage < 75 && (
          <span className="text-[10px] uppercase tracking-wider text-[#ef4444] font-bold bg-[#fef2f2] border border-[#fca5a5] px-3 py-1 rounded-full inline-block text-center whitespace-nowrap shadow-sm group-hover:bg-[#ef4444] group-hover:text-white transition-colors duration-300">
            Ineligible
          </span>
        )}
      </div>
    </div>
  );
};


const AttendanceRings = ({ title, subjects, detailsPath }) => {
  const navigate = useNavigate();

  // calculate overall percentage
  const total = subjects.reduce((acc, sub) => acc + sub.percentage, 0);
  const overallPercentage = subjects.length > 0 ? total / subjects.length : 0;

  const getColor = (p) => {
    if (p >= 90) return '#10b981'; // Bold Emerald
    if (p >= 80) return '#f59e0b'; // Bold Amber
    if (p >= 75) return '#f97316'; // Bold Orange
    return '#ef4444'; // Bold Red
  };

  // Combine overall with subjects
  const allData = [
    { name: 'Total Overview', percentage: overallPercentage, isOverall: true },
    ...subjects
  ].map(item => ({
    ...item,
    color: getColor(item.percentage)
  }));

  return (
    <div className="bg-white/80 p-6 md:p-8 rounded-[2.5rem] shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-gray-100/50 w-full mb-8 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-8 pb-5 border-b border-gray-100">
        <h3 className="text-2xl font-extrabold tracking-tight text-gray-900">{title}</h3>
        {detailsPath && (
          <button
            onClick={() => navigate(detailsPath)}
            className="hidden sm:flex text-sm font-bold text-gray-400 hover:text-gray-800 transition-colors bg-gray-50 hover:bg-gray-100 rounded-full px-4 py-2 cursor-pointer"
          >
            View Details
          </button>
        )}
      </div>
      
      {/* Container for Rings */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5 sm:gap-6">
        {allData.map((item, index) => (
          <CircularProgress 
            key={index} 
            name={item.name} 
            percentage={item.percentage} 
            isOverall={item.isOverall}
            color={item.color}
            size={item.isOverall ? 160 : 120}
            strokeWidth={item.isOverall ? 16 : 12}
            delay={index * 100} // Staggered animation
          />
        ))}
      </div>
    </div>
  );
};

export default AttendanceRings;
