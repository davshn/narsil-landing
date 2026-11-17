import { describe, expect, it } from 'vitest'

import {
  assertHasKeys,
  assertNoDuplicateValues,
  assertTokenNaming,
  assertValuesStartWith,
} from '@/test-utils'

import {
  BORDER_WIDTH_TOKENS,
  BREAKPOINT_TOKENS,
  COLOR_TOKENS,
  DURATION_TOKENS,
  EASING_TOKENS,
  FONT_TOKENS,
  FONT_WEIGHT_TOKENS,
  LEADING_TOKENS,
  OPACITY_TOKENS,
  RADIUS_TOKENS,
  SHADOW_TOKENS,
  SIZE_TOKENS,
  SPACING_TOKENS,
  TEXT_SIZE_TOKENS,
  TRACKING_TOKENS,
  Z_INDEX_TOKENS,
  cssVar,
} from '../theme'

describe('COLOR_TOKENS', () => {
  it('every value follows the --color-{name} pattern', () => {
    assertTokenNaming(COLOR_TOKENS, 'color')
  })

  it('has no duplicate values', () => {
    assertNoDuplicateValues(COLOR_TOKENS)
  })

  it('every value is a CSS custom property', () => {
    assertValuesStartWith(COLOR_TOKENS, '--')
  })

  it('contains the required semantic tokens', () => {
    assertHasKeys(COLOR_TOKENS, [
      'primary',
      'primary-foreground',
      'background',
      'foreground',
      'muted',
      'muted-foreground',
      'border',
      'ring',
    ])
  })

  it('contains feedback state tokens', () => {
    assertHasKeys(COLOR_TOKENS, [
      'destructive',
      'destructive-foreground',
      'warning',
      'warning-foreground',
      'success',
      'success-foreground',
    ])
  })

  it('contains surface tokens (surface, card, muted)', () => {
    assertHasKeys(COLOR_TOKENS, [
      'surface',
      'surface-foreground',
      'card',
      'card-foreground',
      'muted',
      'muted-foreground',
    ])
  })

  it('contains the neumorphic light and shadow tones', () => {
    assertHasKeys(COLOR_TOKENS, ['neu-light', 'neu-dark'])
  })
})

describe('FONT_TOKENS', () => {
  it('every value follows the --font-{name} pattern', () => {
    assertTokenNaming(FONT_TOKENS, 'font')
  })

  it('has no duplicate values', () => {
    assertNoDuplicateValues(FONT_TOKENS)
  })

  it('includes the base font families', () => {
    assertHasKeys(FONT_TOKENS, ['sans', 'mono'])
  })
})

describe('TEXT_SIZE_TOKENS', () => {
  it('every value follows the --text-{name} pattern', () => {
    assertTokenNaming(TEXT_SIZE_TOKENS, 'text')
  })

  it('has no duplicate values', () => {
    assertNoDuplicateValues(TEXT_SIZE_TOKENS)
  })

  it('includes the full type scale', () => {
    assertHasKeys(TEXT_SIZE_TOKENS, ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl'])
  })
})

describe('FONT_WEIGHT_TOKENS', () => {
  it('every value follows the --font-weight-{name} pattern', () => {
    assertTokenNaming(FONT_WEIGHT_TOKENS, 'font-weight')
  })

  it('has no duplicate values', () => {
    assertNoDuplicateValues(FONT_WEIGHT_TOKENS)
  })

  it('includes the semantic font weights', () => {
    assertHasKeys(FONT_WEIGHT_TOKENS, ['regular', 'medium', 'semibold', 'bold'])
  })
})

describe('LEADING_TOKENS', () => {
  it('every value follows the --leading-{name} pattern', () => {
    assertTokenNaming(LEADING_TOKENS, 'leading')
  })

  it('has no duplicate values', () => {
    assertNoDuplicateValues(LEADING_TOKENS)
  })

  it('includes the line-height scale', () => {
    assertHasKeys(LEADING_TOKENS, ['tight', 'snug', 'normal', 'relaxed'])
  })
})

describe('TRACKING_TOKENS', () => {
  it('every value follows the --tracking-{name} pattern', () => {
    assertTokenNaming(TRACKING_TOKENS, 'tracking')
  })

  it('has no duplicate values', () => {
    assertNoDuplicateValues(TRACKING_TOKENS)
  })

  it('includes the letter-spacing scale', () => {
    assertHasKeys(TRACKING_TOKENS, ['tight', 'normal', 'wide'])
  })
})

describe('SPACING_TOKENS', () => {
  it('every value follows the --spacing-{name} pattern', () => {
    assertTokenNaming(SPACING_TOKENS, 'spacing')
  })

  it('has no duplicate values', () => {
    assertNoDuplicateValues(SPACING_TOKENS)
  })

  it('includes the base spacing scale', () => {
    assertHasKeys(SPACING_TOKENS, ['0', '1', '2', '3', '4', '6', '8', '12', '16', '24'])
  })
})

describe('RADIUS_TOKENS', () => {
  it('every value follows the --radius-{name} pattern', () => {
    assertTokenNaming(RADIUS_TOKENS, 'radius')
  })

  it('has no duplicate values', () => {
    assertNoDuplicateValues(RADIUS_TOKENS)
  })

  it('includes the full radius scale', () => {
    assertHasKeys(RADIUS_TOKENS, ['sm', 'md', 'lg', 'xl', 'full'])
  })
})

describe('BORDER_WIDTH_TOKENS', () => {
  it('every value follows the --border-width-{name} pattern', () => {
    assertTokenNaming(BORDER_WIDTH_TOKENS, 'border-width')
  })

  it('has no duplicate values', () => {
    assertNoDuplicateValues(BORDER_WIDTH_TOKENS)
  })

  it('includes thin, medium, thick', () => {
    assertHasKeys(BORDER_WIDTH_TOKENS, ['thin', 'medium', 'thick'])
  })
})

describe('SHADOW_TOKENS', () => {
  it('every value follows the --shadow-{name} pattern', () => {
    assertTokenNaming(SHADOW_TOKENS, 'shadow')
  })

  it('has no duplicate values', () => {
    assertNoDuplicateValues(SHADOW_TOKENS)
  })

  it('includes the shadow scale', () => {
    assertHasKeys(SHADOW_TOKENS, ['sm', 'md', 'lg', 'xl'])
  })

  it('includes the raised and inset neumorphic shadows', () => {
    assertHasKeys(SHADOW_TOKENS, ['neu-sm', 'neu-md', 'neu-lg', 'neu-inset-sm', 'neu-inset-md'])
  })
})

describe('DURATION_TOKENS', () => {
  it('every value follows the --duration-{name} pattern', () => {
    assertTokenNaming(DURATION_TOKENS, 'duration')
  })

  it('has no duplicate values', () => {
    assertNoDuplicateValues(DURATION_TOKENS)
  })

  it('includes animation speeds: fast, base, slow', () => {
    assertHasKeys(DURATION_TOKENS, ['fast', 'base', 'slow'])
  })
})

describe('EASING_TOKENS', () => {
  it('every value follows the --ease-{name} pattern', () => {
    assertTokenNaming(EASING_TOKENS, 'ease')
  })

  it('has no duplicate values', () => {
    assertNoDuplicateValues(EASING_TOKENS)
  })

  it('includes the easing curves', () => {
    assertHasKeys(EASING_TOKENS, ['default', 'in', 'out', 'in-out', 'spring'])
  })
})

describe('OPACITY_TOKENS', () => {
  it('every value follows the --opacity-{name} pattern', () => {
    assertTokenNaming(OPACITY_TOKENS, 'opacity')
  })

  it('has no duplicate values', () => {
    assertNoDuplicateValues(OPACITY_TOKENS)
  })

  it('includes disabled, muted, overlay', () => {
    assertHasKeys(OPACITY_TOKENS, ['disabled', 'muted', 'overlay'])
  })
})

describe('Z_INDEX_TOKENS', () => {
  it('every value follows the --z-{name} pattern', () => {
    assertTokenNaming(Z_INDEX_TOKENS, 'z')
  })

  it('has no duplicate values', () => {
    assertNoDuplicateValues(Z_INDEX_TOKENS)
  })

  it('includes the z-index layers', () => {
    assertHasKeys(Z_INDEX_TOKENS, [
      'base',
      'dropdown',
      'sticky',
      'overlay',
      'modal',
      'popover',
      'toast',
      'tooltip',
      'skip-nav',
    ])
  })
})

describe('BREAKPOINT_TOKENS', () => {
  it('every value follows the --breakpoint-{name} pattern', () => {
    assertTokenNaming(BREAKPOINT_TOKENS, 'breakpoint')
  })

  it('has no duplicate values', () => {
    assertNoDuplicateValues(BREAKPOINT_TOKENS)
  })

  it('includes the breakpoint scale', () => {
    assertHasKeys(BREAKPOINT_TOKENS, ['sm', 'md', 'lg', 'xl', '2xl'])
  })
})

describe('SIZE_TOKENS', () => {
  it('every value follows the --size-{name} pattern', () => {
    assertTokenNaming(SIZE_TOKENS, 'size')
  })

  it('has no duplicate values', () => {
    assertNoDuplicateValues(SIZE_TOKENS)
  })

  it('includes touch target and button heights', () => {
    assertHasKeys(SIZE_TOKENS, [
      'touch-target',
      'icon-sm',
      'icon-md',
      'icon-lg',
      'button-height-sm',
      'button-height-md',
      'button-height-lg',
    ])
  })
})

describe('cssVar', () => {
  it('wraps the property in var()', () => {
    expect(cssVar('--color-primary')).toBe('var(--color-primary)')
  })

  it('works with COLOR_TOKENS', () => {
    expect(cssVar(COLOR_TOKENS.primary)).toBe('var(--color-primary)')
    expect(cssVar(COLOR_TOKENS.warning)).toBe('var(--color-warning)')
    expect(cssVar(COLOR_TOKENS.surface)).toBe('var(--color-surface)')
  })

  it('works with SPACING_TOKENS', () => {
    expect(cssVar(SPACING_TOKENS['4'])).toBe('var(--spacing-4)')
    expect(cssVar(SPACING_TOKENS['16'])).toBe('var(--spacing-16)')
  })

  it('works with TEXT_SIZE_TOKENS', () => {
    expect(cssVar(TEXT_SIZE_TOKENS.base)).toBe('var(--text-base)')
    expect(cssVar(TEXT_SIZE_TOKENS['2xl'])).toBe('var(--text-2xl)')
  })

  it('works with EASING_TOKENS', () => {
    expect(cssVar(EASING_TOKENS.spring)).toBe('var(--ease-spring)')
    expect(cssVar(EASING_TOKENS['in-out'])).toBe('var(--ease-in-out)')
  })

  it('works with Z_INDEX_TOKENS', () => {
    expect(cssVar(Z_INDEX_TOKENS.modal)).toBe('var(--z-modal)')
    expect(cssVar(Z_INDEX_TOKENS['skip-nav'])).toBe('var(--z-skip-nav)')
  })

  it('works with SIZE_TOKENS', () => {
    expect(cssVar(SIZE_TOKENS['touch-target'])).toBe('var(--size-touch-target)')
    expect(cssVar(SIZE_TOKENS['button-height-md'])).toBe('var(--size-button-height-md)')
  })
})
