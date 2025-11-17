/**
 * Motion Lite - Minimal animation presets for Chrome extensions
 * Keep animations FAST and LIGHTWEIGHT for popup performance
 */

import { animate } from "motion"

// Micro-interaction presets (< 200ms)
export const motionPresets = {
  // Button press feedback
  press: {
    scale: 0.95,
    transition: { duration: 0.1 }
  },

  // Success checkmark bounce
  success: {
    scale: [1, 1.2, 1],
    transition: { duration: 0.3, easing: "ease-out" }
  },

  // Toggle switch slide
  toggle: {
    x: [0, 20],
    transition: { duration: 0.15, easing: "ease-in-out" }
  },

  // Fade in (very fast)
  fadeIn: {
    opacity: [0, 1],
    transition: { duration: 0.15 }
  },

  // Badge pop
  badge: {
    scale: [0.8, 1],
    opacity: [0, 1],
    transition: { duration: 0.2, easing: "ease-out" }
  }
}

// Helper function for quick animations
export function quickAnimate(
  element: HTMLElement | null,
  preset: keyof typeof motionPresets
) {
  if (!element) return

  const config = motionPresets[preset]

  return animate(
    element,
    config as any,
    { duration: config.transition.duration }
  )
}

// Utility for spring-based micro-interactions (use sparingly!)
export function springPress(element: HTMLElement | null) {
  if (!element) return

  return animate(
    element,
    { scale: [1, 0.95, 1] },
    { duration: 0.2, easing: [0.34, 1.56, 0.64, 1] } // Slight overshoot
  )
}

// AVOID: Heavy animations that slow down popups
// - Page transitions
// - Layout shifts
// - Staggered animations
// - Complex physics
