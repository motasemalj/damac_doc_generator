'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'checked' | 'onChange'> {
  checked?: boolean | 'indeterminate';
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    const isControlled = checked !== undefined;
    const [uncontrolled, setUncontrolled] = React.useState(false);
    const effectiveChecked = isControlled ? (checked === 'indeterminate' ? false : checked) : uncontrolled;

    return (
      <input
        type="checkbox"
        ref={ref}
        className={cn(
          'h-4 w-4 rounded border border-input bg-background shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer accent-brand-primary',
          className,
        )}
        checked={effectiveChecked}
        onChange={(e) => {
          if (!isControlled) setUncontrolled(e.target.checked);
          onCheckedChange?.(e.target.checked);
        }}
        {...props}
      />
    );
  },
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
