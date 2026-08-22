'use client';

import { HTMLAttributes, forwardRef, useEffect, useState } from 'react';
import { cn } from '../lib/utils';
import { getInitials } from '../lib/utils';

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, size = 'md', ...props }, ref) => {
    const [imageError, setImageError] = useState(false);

    const sizes = {
      sm: 'h-8 w-8 text-xs',
      md: 'h-10 w-10 text-sm',
      lg: 'h-12 w-12 text-base',
      xl: 'h-16 w-16 text-lg',
    };

    const showFallback = !src || imageError;

    return (
      <div
        ref={ref}
        className={cn(
          'relative inline-flex shrink-0 overflow-hidden rounded-full',
          sizes[size],
          className
        )}
        {...props}
      >
        {!showFallback && (
          <img
            src={src}
            alt={alt || fallback || 'Avatar'}
            className="aspect-square h-full w-full object-cover"
            onError={() => setImageError(true)}
          />
        )}
        {showFallback && (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
            {fallback || '?'}
          </div>
        )}
      </div>
    );
  }
);
Avatar.displayName = 'Avatar';

interface AvatarWithFallbackProps extends AvatarProps {
  name?: string;
}

export function AvatarWithFallback({ src, name, fallback, ...props }: AvatarWithFallbackProps) {
  const computedFallback = fallback || (name ? getInitials(name) : '?');
  return <Avatar src={src} fallback={computedFallback} alt={name} {...props} />;
}