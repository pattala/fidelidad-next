import React from 'react';
import { motion } from 'framer-motion';

interface CircularProgressProps {
  progress: number;
  total: number;
  label: string;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({ progress, total, label }) => {
  const percentage = Math.min((progress / total) * 100, 100);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-3xl shadow-sm border border-gray-100">
      <div className="relative w-32 h-32 flex items-center justify-center">
        {/* Background Circle */}
        <svg className="absolute w-full h-full transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-gray-100"
          />
          {/* Progress Circle */}
          <motion.circle
            cx="64"
            cy="64"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            strokeLinecap="round"
            className="text-primary"
          />
        </svg>
        <div className="flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-black text-gray-800 tracking-tighter">{progress}</span>
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">PTS</span>
        </div>
      </div>
      <p className="mt-2 text-sm text-gray-600 font-medium">
        Faltan <strong className="text-primary">{total - progress} pts</strong> para {label}
      </p>
    </div>
  );
};
