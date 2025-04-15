import tinycolor from 'tinycolor2'

const COLOR_CONFIG = {
  LINK_COLOR: '#ff634c',
  DARK_BG: '#121212',
  LIGHT_TEXT: '#f0f0f0',
  DARK_TEXT: '#121212',
  WHITE: '#ffffff',
  MIN_CONTRAST_RATIO: 4.5,
  LOW_ALPHA_THRESHOLD: 0.1,
  HIGH_LUMINANCE: 0.7,
  LOW_LUMINANCE: 0.2
} as const

export function adjustElementColor(el: HTMLElement): void {
  const computed = window.getComputedStyle(el)
  const textColor = tinycolor(computed.color)
  const bgColor = tinycolor(computed.backgroundColor)

  if (!textColor.isValid() || !bgColor.isValid()) return

  const bgAlpha = bgColor.getAlpha()
  const bgLuminance = bgColor.getLuminance()

  if (el.tagName === 'A') {
    adjustLinkColor(el, bgAlpha)
  } else if (bgAlpha !== 0) {
    adjustElementWithBackground(el, textColor, bgColor, bgLuminance)
  } else {
    adjustElementWithoutBackground(el, textColor)
  }
}

function adjustLinkColor(el: HTMLElement, bgAlpha: number): void {
  if (bgAlpha <= COLOR_CONFIG.LOW_ALPHA_THRESHOLD) {
    const contrastWithDark = tinycolor.readability(COLOR_CONFIG.LINK_COLOR, COLOR_CONFIG.DARK_BG)
    el.style.color =
      contrastWithDark < COLOR_CONFIG.MIN_CONTRAST_RATIO
        ? tinycolor(COLOR_CONFIG.LINK_COLOR).lighten(15).toString()
        : COLOR_CONFIG.LINK_COLOR
  }
}

function adjustElementWithBackground(
  el: HTMLElement,
  textColor: tinycolor.Instance,
  bgColor: tinycolor.Instance,
  bgLuminance: number
): void {
  if (bgLuminance > COLOR_CONFIG.HIGH_LUMINANCE) {
    el.style.setProperty('background-color', 'transparent', 'important')
    el.style.color = COLOR_CONFIG.WHITE
  } else if (bgLuminance < COLOR_CONFIG.LOW_LUMINANCE) {
    el.style.setProperty('background-color', 'transparent', 'important')
  } else {
    const contrastRatio = tinycolor.readability(textColor, bgColor)
    if (contrastRatio < COLOR_CONFIG.MIN_CONTRAST_RATIO) {
      el.style.color = bgLuminance > 0.5 ? COLOR_CONFIG.DARK_TEXT : COLOR_CONFIG.LIGHT_TEXT
    }
  }
}

function adjustElementWithoutBackground(el: HTMLElement, textColor: tinycolor.Instance): void {
  if (textColor.getLuminance() < COLOR_CONFIG.HIGH_LUMINANCE) {
    el.style.color = COLOR_CONFIG.WHITE
  }
}
