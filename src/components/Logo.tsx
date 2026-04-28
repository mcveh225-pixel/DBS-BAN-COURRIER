import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function Logo({ className = '', size = 'md' }: LogoProps) {
  const sizes = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-48 h-48'
  };

  const ringStroke = size === 'lg' ? 4 : 2;
  const fontSizeInner = size === 'lg' ? '32px' : '8px';
  const fontSizeOuter = size === 'lg' ? '14px' : '4px';

  return (
    <div className={`relative ${sizes[size]} shrink-0 ${className}`}>
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full drop-shadow-md"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer Circle Ring */}
        <circle cx="50" cy="50" r="49" fill="white" stroke="#003399" strokeWidth="1" />
        <circle cx="50" cy="50" r="45" fill="none" stroke="#003399" strokeWidth="0.5" />
        
        <defs>
          <linearGradient id="sunsetGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#87CEEB" /> {/* Light blue sky */}
            <stop offset="30%" stopColor="#FFD700" /> {/* Gold sun area */}
            <stop offset="50%" stopColor="#FFA500" /> {/* Orange sunset line */}
            <stop offset="50.1%" stopColor="#003399" /> {/* Dark sea water */}
            <stop offset="80%" stopColor="#0055CC" /> {/* Blue water reflecting */}
            <stop offset="100%" stopColor="#FFFFFF" /> {/* Bottom light/reflection */}
          </linearGradient>
          
          <path id="topCurve" d="M 15 50 A 35 35 0 1 1 85 50" fill="transparent" />
          <path id="bottomCurve" d="M 15 50 A 35 35 0 1 0 85 50" fill="transparent" />
        </defs>

        {/* Inner circle with sunset and sea */}
        <circle cx="50" cy="50" r="38" fill="url(#sunsetGrad)" stroke="#000000" strokeWidth="0.5" />
        
        {/* Glowing Sun center */}
        <circle cx="50" cy="50" r="10" fill="white" className="blur-[2px] opacity-90" />

        {/* Text DIOMANDE at top (arched) */}
        <text fill="#003399" fontWeight="900" style={{ fontSize: '12px', fontFamily: 'Arial, sans-serif' }}>
          <textPath xlinkHref="#topCurve" startOffset="50%" textAnchor="middle">
            DIOMANDE
          </textPath>
        </text>

        {/* Text BAN SERVICE at bottom (arched) */}
        <text fill="#003399" fontWeight="900" style={{ fontSize: '11px', fontFamily: 'Arial, sans-serif' }}>
          <textPath xlinkHref="#bottomCurve" startOffset="50%" textAnchor="middle">
            BAN SERVICE
          </textPath>
        </text>

        {/* Stars on the sides */}
        <path d="M 12 50 L 15 45 L 18 50 L 12 47 L 18 47 Z" fill="#FFD700" stroke="#8B4513" strokeWidth="0.2" />
        <path d="M 82 50 L 85 45 L 88 50 L 82 47 L 88 47 Z" fill="#FFD700" stroke="#8B4513" strokeWidth="0.2" />
        
        {/* Main "DBS" text in the center */}
        <text 
          x="50" 
          y="45" 
          textAnchor="middle" 
          fill="#1d4ed8" 
          stroke="white" 
          strokeWidth="1.5" 
          paintOrder="stroke"
          fontWeight="900" 
          style={{ fontSize: '28px', fontFamily: 'Arial Black, sans-serif' }}
        >
          DBS
        </text>
      </svg>
    </div>
  );
}
