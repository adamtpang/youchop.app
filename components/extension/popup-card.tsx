import * as React from "react"
import { cn } from "@/lib/utils"

interface PopupCardProps extends React.HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean
}

/**
 * PopupCard - Fits perfectly in 400px popup width
 * - Optimized spacing for extension popups
 * - Clean borders and shadows
 * - Optional no-padding mode for custom layouts
 */
export const PopupCard = React.forwardRef<HTMLDivElement, PopupCardProps>(
  ({ className, children, noPadding, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border bg-card text-card-foreground shadow-sm",
          !noPadding && "p-4",
          "no-shift", // Prevent layout shift
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

PopupCard.displayName = "PopupCard"

interface PopupCardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export const PopupCardHeader = React.forwardRef<HTMLDivElement, PopupCardHeaderProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex flex-col space-y-1.5", className)}
        {...props}
      />
    )
  }
)

PopupCardHeader.displayName = "PopupCardHeader"

interface PopupCardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export const PopupCardTitle = React.forwardRef<HTMLParagraphElement, PopupCardTitleProps>(
  ({ className, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={cn(
          "text-lg font-semibold leading-none tracking-tight",
          className
        )}
        {...props}
      />
    )
  }
)

PopupCardTitle.displayName = "PopupCardTitle"

interface PopupCardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export const PopupCardDescription = React.forwardRef<
  HTMLParagraphElement,
  PopupCardDescriptionProps
>(({ className, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
})

PopupCardDescription.displayName = "PopupCardDescription"

interface PopupCardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const PopupCardContent = React.forwardRef<HTMLDivElement, PopupCardContentProps>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} className={cn("pt-0", className)} {...props} />
  }
)

PopupCardContent.displayName = "PopupCardContent"

interface PopupCardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const PopupCardFooter = React.forwardRef<HTMLDivElement, PopupCardFooterProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex items-center pt-4", className)}
        {...props}
      />
    )
  }
)

PopupCardFooter.displayName = "PopupCardFooter"
