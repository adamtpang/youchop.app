import * as React from "react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

interface QuickToggleProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
  description?: string
  disabled?: boolean
  className?: string
}

/**
 * QuickToggle - Instant feedback toggle for extension settings
 * - Fast visual response (<100ms)
 * - Clear label and description
 * - Optimized for popup width
 * - Accessible keyboard support
 */
export const QuickToggle = React.forwardRef<HTMLDivElement, QuickToggleProps>(
  ({ checked, onCheckedChange, label, description, disabled, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-between space-x-3",
          "py-2 transition-opacity",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <div className="flex-1 space-y-0.5">
          <label
            htmlFor={`toggle-${label}`}
            className={cn(
              "text-sm font-medium leading-none",
              !disabled && "cursor-pointer"
            )}
          >
            {label}
          </label>
          {description && (
            <p className="text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        <Switch
          id={`toggle-${label}`}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          className="transition-all duration-100"
        />
      </div>
    )
  }
)

QuickToggle.displayName = "QuickToggle"
