"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MotionWrapper } from "@/components/motion-wrapper"
import { LucideIcon } from "lucide-react"

interface FeatureCardProps {
  icon: LucideIcon
  title: string
  description: string
  badgeText?: string
  buttonText?: string
  colorScheme?: "coral" | "teal" | "sky" | "amber" | "violet"
  onButtonClick?: () => void
  delay?: number
}

/**
 * FeatureCard - A sample component combining:
 * 1. shadcn/ui components (Card, Badge, Button)
 * 2. Framer Motion animations (via MotionWrapper)
 * 3. Coolors palette integration (color schemes)
 */
export function FeatureCard({
  icon: Icon,
  title,
  description,
  badgeText,
  buttonText,
  colorScheme = "sky",
  onButtonClick,
  delay = 0,
}: FeatureCardProps) {
  const colorClasses = {
    coral: "bg-coral text-white hover:bg-coral-dark border-coral",
    teal: "bg-teal text-white hover:bg-teal-dark border-teal",
    sky: "bg-sky text-white hover:bg-sky-dark border-sky",
    amber: "bg-amber text-white hover:bg-amber-dark border-amber",
    violet: "bg-violet text-white hover:bg-violet-dark border-violet",
  }

  const iconColorClasses = {
    coral: "text-coral",
    teal: "text-teal",
    sky: "text-sky",
    amber: "text-amber",
    violet: "text-violet",
  }

  const badgeColorClasses = {
    coral: "bg-coral-light text-coral-dark hover:bg-coral",
    teal: "bg-teal-light text-teal-dark hover:bg-teal",
    sky: "bg-sky-light text-sky-dark hover:bg-sky",
    amber: "bg-amber-light text-amber-dark hover:bg-amber",
    violet: "bg-violet-light text-violet-dark hover:bg-violet",
  }

  return (
    <MotionWrapper variant="fadeIn" delay={delay}>
      <Card className="h-full transition-shadow hover:shadow-lg">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className={`rounded-lg p-2 ${iconColorClasses[colorScheme]} bg-opacity-10`}>
              <Icon className="h-6 w-6" />
            </div>
            {badgeText && (
              <Badge className={badgeColorClasses[colorScheme]}>
                {badgeText}
              </Badge>
            )}
          </div>
          <CardTitle className="mt-4">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {buttonText && (
          <CardContent>
            <Button
              className={colorClasses[colorScheme]}
              onClick={onButtonClick}
            >
              {buttonText}
            </Button>
          </CardContent>
        )}
      </Card>
    </MotionWrapper>
  )
}
