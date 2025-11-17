import * as React from "react"
import { Badge, BadgeProps } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface MinimalBadgeProps extends Omit<BadgeProps, 'variant'> {
  count?: number
  dot?: boolean
  pulse?: boolean
}

/**
 * MinimalBadge - Space-efficient badge for extension UI
 * - Ultra-compact for tight spaces
 * - Optional count display
 * - Optional pulsing dot
 * - Fits in compact toolbars and cards
 */
export const MinimalBadge = React.forwardRef<HTMLDivElement, MinimalBadgeProps>(
  ({ className, children, count, dot, pulse, ...props }, ref) => {
    return (
      <Badge
        ref={ref}
        variant="minimal"
        className={cn(
          "h-5 min-w-[20px] items-center justify-center",
          dot && "w-2 h-2 p-0 rounded-full",
          pulse && "animate-pulse",
          className
        )}
        {...props}
      >
        {dot ? null : count !== undefined ? count : children}
      </Badge>
    )
  }
)

MinimalBadge.displayName = "MinimalBadge"
