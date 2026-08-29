import React from 'react';

interface OsanLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const OsanLogo: React.FC<OsanLogoProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'h-10 max-w-[160px]',
    md: 'h-16 max-w-[220px]',
    lg: 'h-24 max-w-[300px]',
    xl: 'h-32 max-w-[380px]',
  }[size];

  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <img
        src="/osan-logo.png"
        alt="Osan Group"
        className={`${sizeClasses} w-auto object-contain mix-blend-multiply transition-all`}
      />
    </div>
  );
};
