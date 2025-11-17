# Chaptr Design System - Chrome Extension Optimized

## 🎨 Stack Overview

### Core Libraries
- **shadcn/ui** - Minimal component selection
- **Motion** - Ultra-lightweight animations (<200ms)
- **Tailwind CSS** - Chrome-optimized configuration
- **Lucide React** - Icon library

### Extension Constraints
- Popup width: 400px (fixed)
- Bundle size: <2MB target
- Render time: <100ms target
- CSP compliant: No inline scripts

---

## 🎨 Color Palette

### Primary (Purple)
```css
--primary-50: #f0f4ff
--primary-100: #dfe8ff
--primary-200: #c6d7ff
--primary-300: #a3bcff
--primary-400: #7e96ff
--primary-500: #667eea /* Main brand */
--primary-600: #5563d1
--primary-700: #4a4fb8
--primary-800: #3f4295
--primary-900: #373977
```

### Secondary (Deep Purple)
```css
--secondary-50: #f5f3ff
--secondary-100: #ede9fe
--secondary-200: #ddd6fe
--secondary-300: #c4b5fd
--secondary-400: #a78bfa
--secondary-500: #764ba2 /* Secondary brand */
--secondary-600: #6d43a0
--secondary-700: #5e3a8a
--secondary-800: #4c2f70
--secondary-900: #3f2659
```

### Usage
- **Primary**: Main CTAs, active states, brand elements
- **Secondary**: Accents, hover states, secondary actions
- **Gradient**: `bg-gradient-to-r from-primary-500 to-secondary-500`

---

## 📦 Component Library

### shadcn/ui Components (Minimal Selection)

#### Installed:
- ✅ `button` - Core interactions
- ✅ `input` - Text entry
- ✅ `badge` - Status indicators
- ✅ `switch` - Settings toggles

#### NOT Installed (Keep bundle small):
- ❌ `dialog` - Too heavy for popup
- ❌ `sheet` - Not needed in 400px width
- ❌ `command` - Overkill for extension
- ❌ `dropdown-menu` - Use native select instead

---

## 🎯 Extension-Specific Components

### 1. CompactButton
**Purpose:** Space-efficient buttons for 400px popup

```tsx
import { CompactButton } from "@/components/extension"

<CompactButton
  loading={isLoading}
  leftIcon={<Zap className="h-3 w-3" />}
>
  Chapterize
</CompactButton>
```

**Features:**
- Size: `compact` (h-8)
- Active state: Scale 0.95
- Loading state: Spinner animation
- Icon support: Left/right icons

### 2. PopupCard
**Purpose:** Container optimized for popup width

```tsx
import { PopupCard, PopupCardHeader, PopupCardTitle } from "@/components/extension"

<PopupCard>
  <PopupCardHeader>
    <PopupCardTitle>Credit Balance</PopupCardTitle>
  </PopupCardHeader>
  <PopupCardContent>
    {/* Content */}
  </PopupCardContent>
</PopupCard>
```

**Features:**
- Width: Auto-fits 400px
- Padding: 16px (p-4)
- Layout shift prevention: `contain: layout`

### 3. MinimalBadge
**Purpose:** Space-efficient status indicators

```tsx
import { MinimalBadge } from "@/components/extension"

<MinimalBadge count={10} />
<MinimalBadge dot pulse /> {/* Notification dot */}
```

**Features:**
- Size: Ultra-compact (h-5)
- Variants: Count, dot, pulse
- Text: 10px font size

### 4. QuickToggle
**Purpose:** Instant feedback toggles

```tsx
import { QuickToggle } from "@/components/extension"

<QuickToggle
  checked={enabled}
  onCheckedChange={setEnabled}
  label="Auto-post comments"
  description="Earn +2 credits automatically"
/>
```

**Features:**
- Layout: Label + description + switch
- Speed: <100ms response
- Accessibility: Keyboard support

---

## ⚡ Motion Library Usage

### Presets (lib/motion-lite.ts)

```tsx
import { motionPresets, quickAnimate } from "@/lib/motion-lite"

// Button press
quickAnimate(buttonRef.current, 'press')

// Success checkmark
quickAnimate(checkRef.current, 'success')

// Toggle slide
quickAnimate(toggleRef.current, 'toggle')

// Fade in
quickAnimate(elementRef.current, 'fadeIn')

// Badge pop
quickAnimate(badgeRef.current, 'badge')
```

### ⚠️ Animation Guidelines

**DO:**
- ✅ Micro-interactions (<200ms)
- ✅ Button press feedback
- ✅ Success states
- ✅ Toggle switches

**DON'T:**
- ❌ Page transitions
- ❌ Layout animations
- ❌ Staggered lists
- ❌ Complex physics
- ❌ Heavy spring animations

**Why:** Popups need to feel instant. Heavy animations make the UI feel sluggish.

---

## 🎨 Tailwind Configuration

### Chrome Extension Optimizations

```tsx
// Container maxWidth: 400px (popup constraint)
className="container"

// Fast animations only
className="animate-fast" // 150ms

// Prevent layout shift
className="no-shift"

// Compact scrollbar
className="compact-scroll"
```

### Custom Animations

```css
/* fade-in: 150ms */
animate-fade-in

/* slide-up: 200ms */
animate-slide-up

/* pop: 150ms */
animate-pop
```

---

## 📱 Responsive Design

### Popup Constraints
```css
Width: 400px (fixed)
Min Height: 500px
Max Height: 600px (recommended)
```

### Layout Tips
1. **Use flexbox** for vertical stacking
2. **Avoid horizontal scroll** at all costs
3. **Stack buttons vertically** in tight spaces
4. **Use compact variants** of all components

### Example Layout
```tsx
<div className="popup-container p-4 space-y-4">
  <PopupCard>
    {/* Header */}
  </PopupCard>

  <PopupCard>
    {/* Stats */}
  </PopupCard>

  <div className="flex flex-col gap-2">
    <CompactButton>Action 1</CompactButton>
    <CompactButton>Action 2</CompactButton>
  </div>
</div>
```

---

## 🌗 Dark Mode Support

Automatically matches Chrome's theme:

```tsx
// Tailwind handles this via CSS variables
// No JavaScript needed

// To force dark mode:
<html className="dark">
```

### Testing
1. Chrome Settings → Appearance → Theme
2. Switch between Light/Dark/Auto
3. Extension should match instantly

---

## 🎯 Performance Targets

### Bundle Size
- Target: <2MB total
- Current components: ~150KB
- Motion library: ~20KB
- Tailwind: ~10KB (purged)

### Render Performance
- Initial render: <100ms
- Animation duration: <200ms
- No jank: 60fps minimum

### Best Practices
1. **Lazy load heavy components**
2. **Use `React.memo` for static content**
3. **Avoid re-renders** in popup
4. **Pre-fetch data** in background script

---

## 🔧 Development Workflow

### Adding New Components

```bash
# DON'T use shadcn CLI (too heavy)
# Instead, copy minimal components manually

# Add to components/ui/
# Import minimal dependencies only
# Keep file size <5KB per component
```

### Testing in Extension

```bash
# 1. Build extension
npm run build:extension

# 2. Load in Chrome
chrome://extensions/ → Load unpacked → extension/build

# 3. Test popup
Click extension icon → Verify layout fits 400px

# 4. Test performance
F12 → Performance tab → Should render <100ms
```

---

## 📚 Component API Reference

### CompactButton
```tsx
interface CompactButtonProps {
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  variant?: "default" | "outline" | "ghost" | "destructive"
  size?: "compact" // Fixed for extension
}
```

### PopupCard
```tsx
interface PopupCardProps {
  noPadding?: boolean // Remove default padding
  className?: string
}
```

### MinimalBadge
```tsx
interface MinimalBadgeProps {
  count?: number // Show number
  dot?: boolean // Show dot instead
  pulse?: boolean // Pulsing animation
}
```

### QuickToggle
```tsx
interface QuickToggleProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}
```

---

## 🚀 Ready to Use

All components are:
- ✅ CSP compliant (no inline scripts)
- ✅ Manifest V3 compatible
- ✅ 400px width optimized
- ✅ Dark mode ready
- ✅ Performance tested
- ✅ Accessible (WCAG AA)

Start building your popup with:
```tsx
import { CompactButton, PopupCard, MinimalBadge, QuickToggle } from "@/components/extension"
```

Happy building! 🎨
