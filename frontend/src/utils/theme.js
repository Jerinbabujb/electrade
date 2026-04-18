// ── Color theme utilities ─────────────────────────────────────

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h, s, l = (max + min) / 2
  if (max === min) { h = s = 0 }
  else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 }
}

function hslToHex(h, s, l) {
  h /= 360; s /= 100; l /= 100
  let r, g, b
  if (s === 0) { r = g = b = l }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1/6) return p + (q - p) * 6 * t
      if (t < 1/2) return q
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }
  return '#' + [r, g, b].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('')
}

// Derive full palette from a single hex brand color
export function deriveTheme(hex) {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) hex = '#1a5fa8'
  const { r, g, b } = hexToRgb(hex)
  const { h, s, l } = rgbToHsl(r, g, b)
  // Clamp lightness so we always get a readable primary
  const baseL = Math.min(Math.max(l, 28), 52)
  return {
    '--blue':       hslToHex(h, s, baseL),
    '--blue-dark':  hslToHex(h, s, Math.max(baseL - 12, 15)),
    '--blue-mid':   hslToHex(h, Math.max(s - 10, 30), baseL + 22),
    '--blue-light': hslToHex(h, Math.min(s * 0.35, 40), 95),
    '--nav-active': hslToHex(h, s, baseL),
  }
}

// Apply a theme to the document root
export function applyTheme(hex) {
  const vars = deriveTheme(hex)
  for (const [k, v] of Object.entries(vars)) {
    document.documentElement.style.setProperty(k, v)
  }
  localStorage.setItem('et_theme', hex)
}

// Load saved theme on app start (before company data fetches)
export function loadSavedTheme() {
  const saved = localStorage.getItem('et_theme')
  if (saved) applyTheme(saved)
}

// ── Extract dominant brand color from a logo image (data URL) ─
export function extractLogoColor(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const size = 80
      canvas.width = size; canvas.height = size
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, size, size)
      const { data } = ctx.getImageData(0, 0, size, size)

      // Collect pixels with decent saturation and opacity, skip near-white/black/gray
      const buckets = {}
      for (let i = 0; i < data.length; i += 4) {
        const [r, g, b, a] = [data[i], data[i+1], data[i+2], data[i+3]]
        if (a < 128) continue  // transparent
        const { h, s, l } = rgbToHsl(r, g, b)
        if (s < 15 || l < 8 || l > 88) continue  // gray/white/black
        // Bucket by hue in 15° increments
        const key = Math.round(h / 15) * 15
        buckets[key] = (buckets[key] || 0) + 1
      }

      if (!Object.keys(buckets).length) { resolve(null); return }

      // Find dominant hue bucket
      const dominant = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0]
      const domH = parseInt(dominant[0])

      // Average the color of all pixels in that hue range
      let rSum = 0, gSum = 0, bSum = 0, count = 0
      for (let i = 0; i < data.length; i += 4) {
        const [r, g, b, a] = [data[i], data[i+1], data[i+2], data[i+3]]
        if (a < 128) continue
        const { h, s, l } = rgbToHsl(r, g, b)
        if (s < 15 || l < 8 || l > 88) continue
        if (Math.abs(h - domH) < 20 || Math.abs(h - domH) > 340) {
          rSum += r; gSum += g; bSum += b; count++
        }
      }
      if (!count) { resolve(null); return }
      const avg = '#' + [rSum, gSum, bSum]
        .map(x => Math.round(x / count).toString(16).padStart(2, '0')).join('')
      resolve(avg)
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

// Preset brand palettes
export const THEME_PRESETS = [
  { name: 'Ocean Blue',    color: '#1a5fa8' },
  { name: 'Deep Navy',     color: '#1a237e' },
  { name: 'Teal',          color: '#00695c' },
  { name: 'Forest Green',  color: '#2e7d32' },
  { name: 'Charcoal',      color: '#37474f' },
  { name: 'Royal Purple',  color: '#6a1b9a' },
  { name: 'Crimson',       color: '#b71c1c' },
  { name: 'Burnt Orange',  color: '#bf360c' },
  { name: 'Gold',          color: '#f57f17' },
  { name: 'Slate',         color: '#455a64' },
]
