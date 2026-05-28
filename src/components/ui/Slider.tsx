import React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { clsx } from 'clsx';

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  teamColor?: 'A' | 'B';
}

export function Slider({ className, teamColor, ...props }: SliderProps) {
  const trackColor = teamColor === 'A' ? 'bg-team-a' : teamColor === 'B' ? 'bg-team-b' : 'bg-game-primary';

  return (
    <SliderPrimitive.Root
      className={clsx('relative flex w-full touch-none select-none items-center', className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-gray-200">
        <SliderPrimitive.Range className={clsx('absolute h-full', trackColor)} />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className={clsx(
          'block h-4 w-4 rounded-full border-2 bg-white shadow-md transition-colors',
          teamColor === 'A' ? 'border-team-a' : teamColor === 'B' ? 'border-team-b' : 'border-game-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50'
        )}
      />
    </SliderPrimitive.Root>
  );
}
