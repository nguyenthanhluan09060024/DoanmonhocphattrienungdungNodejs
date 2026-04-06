import React from 'react';
import { TrendingUp } from 'lucide-react';

interface ExperienceBarProps {
  level: number;
  currentLevelExp: number;
  maxExp: number;
  totalExp: number;
  expToNextLevel: number;
}

export const ExperienceBar: React.FC<ExperienceBarProps> = ({
  level,
  currentLevelExp,
  maxExp,
  totalExp,
  expToNextLevel,
}) => {
  const percentage = maxExp > 0 ? (currentLevelExp / maxExp) * 100 : 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            Level {level}
          </span>
        </div>
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {currentLevelExp}/{maxExp} EXP
        </span>
      </div>
      
      {/* Progress Bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-gray-400 via-gray-500 to-gray-600 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      
      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-center">
        {expToNextLevel > 0 ? (
          <span>Còn {expToNextLevel} EXP để lên Level {level + 1}</span>
        ) : (
          <span className="text-gray-600 dark:text-gray-300 font-medium">
            Đã đủ EXP! Level up sẵn sàng
          </span>
        )}
      </div>
      
      <div className="mt-2 text-center">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Tổng EXP: <span className="font-semibold text-gray-700 dark:text-gray-300">{totalExp}</span>
        </span>
      </div>
    </div>
  );
};

