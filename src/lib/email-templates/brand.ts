// Stili condivisi per le email di autenticazione Cicla Qui.
// Nota: il background del Body resta bianco per compatibilità client email.

export const BRAND_GREEN = '#12B76A'
export const BRAND_DARK = '#0E1512'

export const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
}

export const container = {
  padding: '32px 28px',
  maxWidth: '560px',
  margin: '0 auto',
}

export const card = {
  backgroundColor: BRAND_DARK,
  borderRadius: '20px',
  padding: '32px 28px',
}

export const brand = {
  fontSize: '13px',
  letterSpacing: '2px',
  textTransform: 'uppercase' as const,
  color: BRAND_GREEN,
  fontWeight: 'bold' as const,
  margin: '0 0 18px',
}

export const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#ffffff',
  margin: '0 0 16px',
  lineHeight: '1.25',
}

export const text = {
  fontSize: '15px',
  color: '#C7D0CB',
  lineHeight: '1.6',
  margin: '0 0 22px',
}

export const link = { color: BRAND_GREEN, textDecoration: 'underline' }

export const button = {
  backgroundColor: BRAND_GREEN,
  color: '#06210F',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '999px',
  padding: '14px 26px',
  textDecoration: 'none',
  display: 'inline-block',
}

export const codeStyle = {
  fontFamily: "'Space Grotesk', Courier, monospace",
  fontSize: '30px',
  letterSpacing: '6px',
  fontWeight: 'bold' as const,
  color: BRAND_GREEN,
  margin: '0 0 24px',
}

export const footer = {
  fontSize: '12px',
  color: '#7E8B84',
  margin: '28px 0 0',
  lineHeight: '1.5',
}
