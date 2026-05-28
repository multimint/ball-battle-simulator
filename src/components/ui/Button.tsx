import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';

const buttonVariants = cva(
  'inline-flex items-center justify-center font-retro transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 border-2',
  {
    variants: {
      variant: {
        primary:
          'bg-game-primary text-white border-game-primary hover:bg-opacity-80 shadow-md',
        teamA:
          'bg-team-a text-white border-team-a hover:opacity-80 shadow-md',
        teamB:
          'bg-team-b text-white border-team-b hover:opacity-80 shadow-md',
        ghost:
          'bg-transparent text-game-primary border-game-primary hover:bg-game-primary hover:text-white',
        danger:
          'bg-red-500 text-white border-red-500 hover:opacity-80',
        success:
          'bg-hud-green text-white border-hud-green hover:opacity-80 shadow-md',
      },
      size: {
        sm: 'px-3 py-2 text-[8px]',
        md: 'px-4 py-3 text-[9px]',
        lg: 'px-6 py-4 text-[10px]',
        xl: 'px-8 py-5 text-[11px]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={clsx(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
);

Button.displayName = 'Button';
