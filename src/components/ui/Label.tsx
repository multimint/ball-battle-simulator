import React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { clsx } from 'clsx';

type LabelProps = React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>;

export function Label({ className, ...props }: LabelProps) {
  return (
    <LabelPrimitive.Root
      className={clsx('font-retro text-[8px] text-game-primary leading-tight', className)}
      {...props}
    />
  );
}
