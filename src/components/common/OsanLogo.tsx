import React from 'react';

interface OsanLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  lightBg?: boolean;
}

export const OsanLogo: React.FC<OsanLogoProps> = ({ className = '', size = 'md' }) => {
  const dimensions = {
    sm: { width: 140, height: 60 },
    md: { width: 200, height: 85 },
    lg: { width: 260, height: 110 },
    xl: { width: 320, height: 135 },
  }[size];

  return (
    <div className={`inline-flex flex-col items-center justify-center ${className}`}>
      <svg
        width={dimensions.width}
        height={dimensions.height}
        viewBox="0 0 280 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-auto h-auto max-w-full"
      >
        {/* Arabic Calligraphy "أوسان" */}
        <path
          d="M135 15 V65 M150 25 C150 55, 175 60, 185 30 C190 20, 200 20, 200 40 C200 65, 170 70, 140 68"
          stroke="#475569"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Rightmost Blue Curved Sail / Wing */}
        <path
          d="M210 80 C215 50, 225 25, 235 10 C228 32, 220 58, 212 80 Z"
          fill="#1D70B8"
        />
        <path
          d="M218 80 L238 10 C234 32, 226 58, 220 80 Z"
          fill="#0090E7"
          opacity="0.85"
        />

        {/* English Text "OSAN" */}
        {/* "O" Circle with inner dot */}
        <circle cx="50" cy="62" r="18" stroke="#475569" strokeWidth="6" fill="none" />
        <circle cx="50" cy="62" r="6" fill="#1D70B8" />

        {/* "S" */}
        <path
          d="M95 52 C90 48, 80 48, 80 54 C80 60, 95 62, 95 68 C95 74, 82 74, 78 70"
          stroke="#475569"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />

        {/* "A" */}
        <path
          d="M105 74 L115 50 L125 74 M108 66 L122 66"
          stroke="#475569"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* "N" */}
        <path
          d="M136 74 V50 L152 74 V50"
          stroke="#475569"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Blue Accent Horizontal Line under OSAN */}
        <line x1="40" y1="85" x2="225" y2="85" stroke="#1D70B8" strokeWidth="4" strokeLinecap="round" />

        {/* English Subtext "GROUP" */}
        <text
          x="132.5"
          y="108"
          textAnchor="middle"
          fill="#475569"
          fontSize="20"
          fontWeight="800"
          letterSpacing="4"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          GROUP
        </text>
      </svg>
    </div>
  );
};
