import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export const Loading: React.FC<LoadingProps> = ({ size = 'md', text = 'Loading...' }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <Loader2 className={`${sizes[size]} animate-spin text-blue-600 dark:text-blue-400 mb-2`} />
      <p className="text-sm text-gray-600 dark:text-gray-400">{text}</p>
    </div>
  );
};