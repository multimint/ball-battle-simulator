import React from 'react';
import { clsx } from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  teamColor?: 'A' | 'B';
}

export function Card({ className, selected, teamColor, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-lg border-2 p-3 transition-all duration-150 cursor-pointer',
        selected && teamColor === 'A' && 'border-team-a bg-team-a/10 shadow-lg scale-105',
        selected && teamColor === 'B' && 'border-team-b bg-team-b/10 shadow-lg scale-105',
        selected && !teamColor && 'border-game-primary bg-game-primary/10 shadow-lg',
        !selected && 'border-gray-300 hover:border-gray-500 hover:bg-white/50',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={clsx('font-retro text-[8px] text-game-primary mb-1 leading-tight', className)} {...props}>
      {children}
    </p>
  );
}

export function CardBadge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-block font-retro text-[6px] px-1 py-0.5 rounded text-white mr-1"
      style={{ backgroundColor: color }}
    >
      {children}
    </span>
  );
}
