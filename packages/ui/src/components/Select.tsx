'use client';

import { forwardRef, SelectHTMLAttributes, OptionHTMLAttributes } from 'react';
import { cn } from '../lib/utils';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>option]:first-letter:uppercase [&>option]:py-1 [&>option]:px-2 [&>option]:bg-background [&>option]:text-foreground',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = 'Select';

interface SelectOptionProps extends OptionHTMLAttributes<HTMLOptionElement> {}

export const SelectOption = forwardRef<HTMLOptionElement, SelectOptionProps>(
  ({ className, children, ...props }, ref) => (
    <option ref={ref} className={cn('', className)} {...props}>
      {children}
    </option>
  )
);
SelectOption.displayName = 'SelectOption';