import * as React from "react"
import { Button, ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

interface CompactButtonProps extends ButtonProps {
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

/**
 * CompactButton - Optimized for Chrome extension popups
 * - Smaller than default button
 * - Fits 400px width constraint
 * - Instant visual feedback
 * - Loading state support
 */
export const CompactButton = React.forwardRef<HTMLButtonElement, CompactButtonProps>(
  ({ className, children, loading, leftIcon, rightIcon, disabled, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        size="compact"
        disabled={disabled || loading}
        className={cn(
          "gap-1.5 transition-all duration-100",
          "active:scale-95",
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : leftIcon ? (
          <span className="flex-shrink-0">{leftIcon}</span>
        ) : null}
        {children}
        {rightIcon && !loading && (
          <span className="flex-shrink-0">{rightIcon}</span>
        )}
      </Button>
    )
  }
)

CompactButton.displayName = "CompactButton"
