'use client';

import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '../lib/utils';
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'success' | 'warning';
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variants = {
      default: 'bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200',
      destructive: 'bg-red-50 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-200',
      success: 'bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-200',
      warning: 'bg-yellow-50 text-yellow-900 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-200',
    };

    const icons = {
      default: <Info className="h-4 w-4" />,
      destructive: <AlertCircle className="h-4 w-4" />,
      success: <CheckCircle className="h-4 w-4" />,
      warning: <AlertTriangle className="h-4 w-4" />,
    };

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          'relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground',
          variants[variant],
          className
        )}
        {...props}
      >
        {icons[variant]}
        <div className="text-sm [&>p]:leading-relaxed">{children}</div>
      </div>
    );
  }
);
Alert.displayName = 'Alert';

export const AlertTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn('mb-1 font-medium leading-tight', className)} {...props} />
  )
);
AlertTitle.displayName = 'AlertTitle';

export const AlertDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />
  )
);
AlertDescription.displayName = 'AlertDescription';