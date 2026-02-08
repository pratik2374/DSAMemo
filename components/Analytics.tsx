
import React from 'react';
import { UserStats } from '../types';

interface AnalyticsProps {
  stats: UserStats;
}

export const Analytics: React.FC<AnalyticsProps> = ({ stats }) => {
  const readinessScore = Math.min(100, (stats.solvedCount * 10) + (Object.keys(stats.hintsUsedCount).length * 5));
  
  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Struggle Analytics</h4>
        <div className="space-y-2">
          {Object.entries(stats.hintsUsedCount).map(([level, count]) => (
            <div key={level} className="flex items-center gap-2">
              <span className="text-[10px] w-12 text-gray-500">Lvl {level}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  // Fix: Explicitly convert count to number to resolve arithmetic operation type error
                  style={{ width: `${Math.min(100, (Number(count) / 10) * 100)}%` }}
                ></div>
              </div>
              <span className="text-[10px] font-bold text-gray-700">{count}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-4 rounded-xl text-white shadow-lg">
        <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest mb-1">Interview Readiness</p>
        <div className="flex items-end justify-between">
          <span className="text-3xl font-black">{readinessScore}%</span>
          <div className="text-right">
            <p className="text-[10px] opacity-70">Based on patterns & independence</p>
          </div>
        </div>
      </div>
    </div>
  );
};
