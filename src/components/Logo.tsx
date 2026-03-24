import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const sizes = {
    xs: 'h-4',
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-12',
    xl: 'h-16'
  };

  const green = "#005438";

  return (
    <div className={`flex items-center ${sizes[size]} ${className}`}>
      <svg 
        viewBox="0 0 420 120" 
        className="h-full w-auto" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Text Only - Bold Sans-Serif */}
        <text 
          x="0" 
          y="92" 
          fill={green} 
          style={{ 
            font: 'bold 105px "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif',
            letterSpacing: '-0.05em'
          }}
        >
          Petmaps
        </text>
      </svg>
    </div>
  );
};
