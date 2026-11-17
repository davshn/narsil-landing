export const COLOR_TOKENS = {
  primary: '--color-primary',
  'primary-foreground': '--color-primary-foreground',
  secondary: '--color-secondary',
  'secondary-foreground': '--color-secondary-foreground',
  accent: '--color-accent',
  'accent-foreground': '--color-accent-foreground',
  destructive: '--color-destructive',
  'destructive-foreground': '--color-destructive-foreground',
  warning: '--color-warning',
  'warning-foreground': '--color-warning-foreground',
  success: '--color-success',
  'success-foreground': '--color-success-foreground',
  background: '--color-background',
  foreground: '--color-foreground',
  surface: '--color-surface',
  'surface-foreground': '--color-surface-foreground',
  muted: '--color-muted',
  'muted-foreground': '--color-muted-foreground',
  card: '--color-card',
  'card-foreground': '--color-card-foreground',
  border: '--color-border',
  ring: '--color-ring',
  'neu-light': '--color-neu-light',
  'neu-dark': '--color-neu-dark',
} as const

export const FONT_TOKENS = {
  sans: '--font-sans',
  mono: '--font-mono',
} as const

export const TEXT_SIZE_TOKENS = {
  xs: '--text-xs',
  sm: '--text-sm',
  base: '--text-base',
  lg: '--text-lg',
  xl: '--text-xl',
  '2xl': '--text-2xl',
  '3xl': '--text-3xl',
  '4xl': '--text-4xl',
} as const

export const FONT_WEIGHT_TOKENS = {
  regular: '--font-weight-regular',
  medium: '--font-weight-medium',
  semibold: '--font-weight-semibold',
  bold: '--font-weight-bold',
} as const

export const LEADING_TOKENS = {
  tight: '--leading-tight',
  snug: '--leading-snug',
  normal: '--leading-normal',
  relaxed: '--leading-relaxed',
} as const

export const TRACKING_TOKENS = {
  tight: '--tracking-tight',
  normal: '--tracking-normal',
  wide: '--tracking-wide',
} as const

export const SPACING_TOKENS = {
  '0': '--spacing-0',
  '1': '--spacing-1',
  '2': '--spacing-2',
  '3': '--spacing-3',
  '4': '--spacing-4',
  '5': '--spacing-5',
  '6': '--spacing-6',
  '8': '--spacing-8',
  '10': '--spacing-10',
  '12': '--spacing-12',
  '16': '--spacing-16',
  '20': '--spacing-20',
  '24': '--spacing-24',
  '32': '--spacing-32',
} as const

export const RADIUS_TOKENS = {
  sm: '--radius-sm',
  md: '--radius-md',
  lg: '--radius-lg',
  xl: '--radius-xl',
  full: '--radius-full',
} as const

export const BORDER_WIDTH_TOKENS = {
  thin: '--border-width-thin',
  medium: '--border-width-medium',
  thick: '--border-width-thick',
} as const

export const SHADOW_TOKENS = {
  sm: '--shadow-sm',
  md: '--shadow-md',
  lg: '--shadow-lg',
  xl: '--shadow-xl',
  'neu-sm': '--shadow-neu-sm',
  'neu-md': '--shadow-neu-md',
  'neu-lg': '--shadow-neu-lg',
  'neu-inset-sm': '--shadow-neu-inset-sm',
  'neu-inset-md': '--shadow-neu-inset-md',
} as const

export const DURATION_TOKENS = {
  fast: '--duration-fast',
  base: '--duration-base',
  slow: '--duration-slow',
} as const

export const EASING_TOKENS = {
  default: '--ease-default',
  in: '--ease-in',
  out: '--ease-out',
  'in-out': '--ease-in-out',
  spring: '--ease-spring',
} as const

export const OPACITY_TOKENS = {
  disabled: '--opacity-disabled',
  muted: '--opacity-muted',
  overlay: '--opacity-overlay',
} as const

export const Z_INDEX_TOKENS = {
  base: '--z-base',
  dropdown: '--z-dropdown',
  sticky: '--z-sticky',
  overlay: '--z-overlay',
  modal: '--z-modal',
  popover: '--z-popover',
  toast: '--z-toast',
  tooltip: '--z-tooltip',
  'skip-nav': '--z-skip-nav',
} as const

export const BREAKPOINT_TOKENS = {
  sm: '--breakpoint-sm',
  md: '--breakpoint-md',
  lg: '--breakpoint-lg',
  xl: '--breakpoint-xl',
  '2xl': '--breakpoint-2xl',
} as const

export const SIZE_TOKENS = {
  'touch-target': '--size-touch-target',
  'icon-sm': '--size-icon-sm',
  'icon-md': '--size-icon-md',
  'icon-lg': '--size-icon-lg',
  'button-height-sm': '--size-button-height-sm',
  'button-height-md': '--size-button-height-md',
  'button-height-lg': '--size-button-height-lg',
} as const

export type ColorToken = keyof typeof COLOR_TOKENS
export type FontToken = keyof typeof FONT_TOKENS
export type TextSizeToken = keyof typeof TEXT_SIZE_TOKENS
export type FontWeightToken = keyof typeof FONT_WEIGHT_TOKENS
export type LeadingToken = keyof typeof LEADING_TOKENS
export type TrackingToken = keyof typeof TRACKING_TOKENS
export type SpacingToken = keyof typeof SPACING_TOKENS
export type RadiusToken = keyof typeof RADIUS_TOKENS
export type BorderWidthToken = keyof typeof BORDER_WIDTH_TOKENS
export type ShadowToken = keyof typeof SHADOW_TOKENS
export type DurationToken = keyof typeof DURATION_TOKENS
export type EasingToken = keyof typeof EASING_TOKENS
export type OpacityToken = keyof typeof OPACITY_TOKENS
export type ZIndexToken = keyof typeof Z_INDEX_TOKENS
export type BreakpointToken = keyof typeof BREAKPOINT_TOKENS
export type SizeToken = keyof typeof SIZE_TOKENS

export function cssVar(property: string): string {
  return `var(${property})`
}
