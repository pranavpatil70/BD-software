/**
 * Phone Number Standardizer and Validator
 * Formats, cleans, and standardizes phone numbers (primarily Indian mobile numbers).
 */

export interface PhoneCleanResult {
  raw: string
  cleaned: string | null // Canonical E.164 without spaces, e.g. "+919876543210"
  national: string | null // 10-digit national number, e.g. "9876543210"
  formatted: string | null // Readable format, e.g. "+91 98765 43210"
  isValid: boolean
  reason?: string
}

/**
 * Cleans and standardizes an input phone string.
 * Supports variations like:
 * - 9876543210
 * - 09876543210
 * - 919876543210
 * - +91 98765 43210
 * - +91-98765-43210
 * - (022) 28374829
 */
export function cleanPhoneNumber(raw: unknown): PhoneCleanResult {
  if (raw === null || raw === undefined) {
    return { raw: '', cleaned: null, national: null, formatted: null, isValid: false, reason: 'Empty phone number' }
  }

  const rawStr = String(raw).trim()
  if (!rawStr) {
    return { raw: '', cleaned: null, national: null, formatted: null, isValid: false, reason: 'Empty phone number' }
  }

  // Extract only digits and leading plus sign
  const hasPlus = rawStr.startsWith('+')
  const digitsOnly = rawStr.replace(/\D/g, '')

  if (!digitsOnly || digitsOnly.length < 10) {
    return {
      raw: rawStr,
      cleaned: null,
      national: null,
      formatted: null,
      isValid: false,
      reason: 'Phone number too short (minimum 10 digits required)'
    }
  }

  let nationalDigits = digitsOnly

  // Case 1: 12 digits starting with 91 (e.g. 919876543210 or +919876543210)
  if (nationalDigits.length === 12 && nationalDigits.startsWith('91')) {
    nationalDigits = nationalDigits.slice(2)
  }
  // Case 2: 13 digits starting with 091
  else if (nationalDigits.length === 13 && nationalDigits.startsWith('091')) {
    nationalDigits = nationalDigits.slice(3)
  }
  // Case 3: 14 digits starting with 0091
  else if (nationalDigits.length === 14 && nationalDigits.startsWith('0091')) {
    nationalDigits = nationalDigits.slice(4)
  }
  // Case 4: 11 digits starting with 0 (e.g. 09876543210)
  else if (nationalDigits.length === 11 && nationalDigits.startsWith('0')) {
    nationalDigits = nationalDigits.slice(1)
  }

  // Check if standard 10-digit number
  if (nationalDigits.length === 10) {
    // Check if it's not all repetitive digits like 0000000000 or 1111111111
    if (/^(\d)\1{9}$/.test(nationalDigits)) {
      return {
        raw: rawStr,
        cleaned: null,
        national: null,
        formatted: null,
        isValid: false,
        reason: 'Invalid repetitive number'
      }
    }

    // Standard Indian mobile numbers begin with 6, 7, 8, 9
    // Indian landlines might begin with 2-5
    const canonical = `+91${nationalDigits}`
    const readable = `+91 ${nationalDigits.slice(0, 5)} ${nationalDigits.slice(5)}`

    return {
      raw: rawStr,
      cleaned: canonical,
      national: nationalDigits,
      formatted: readable,
      isValid: true
    }
  }

  // If international number with explicit + and valid length (10 to 15 digits)
  if (hasPlus && digitsOnly.length >= 10 && digitsOnly.length <= 15) {
    return {
      raw: rawStr,
      cleaned: `+${digitsOnly}`,
      national: digitsOnly,
      formatted: `+${digitsOnly}`,
      isValid: true
    }
  }

  return {
    raw: rawStr,
    cleaned: null,
    national: null,
    formatted: null,
    isValid: false,
    reason: `Invalid phone length (${digitsOnly.length} digits)`
  }
}

/**
 * Returns true if the phone number can be cleaned into a valid standard number.
 */
export function isValidPhoneNumber(raw: unknown): boolean {
  return cleanPhoneNumber(raw).isValid
}

/**
 * Generates a clean WhatsApp link
 */
export function toWhatsAppUrl(phone: string, message?: string): string {
  const result = cleanPhoneNumber(phone)
  const targetNumber = result.isValid && result.cleaned ? result.cleaned.replace('+', '') : phone.replace(/\D/g, '')
  const encodedMsg = message ? `?text=${encodeURIComponent(message)}` : ''
  return `https://wa.me/${targetNumber}${encodedMsg}`
}

/**
 * Generates a clean dialer link
 */
export function toTelUrl(phone: string): string {
  const result = cleanPhoneNumber(phone)
  const targetNumber = result.isValid && result.cleaned ? result.cleaned : phone.trim()
  return `tel:${targetNumber}`
}

export type ParsedContact =
  | { kind: 'phone'; display: string; e164: string; href: string }
  | { kind: 'email'; address: string; href: string }
  | { kind: 'unknown'; raw: string }

/**
 * Parses contact info into email, phone, or unknown for UI dialer popups.
 */
export function parseContact(contact: string): ParsedContact {
  const trimmed = contact?.trim() || ''
  if (!trimmed) {
    return { kind: 'unknown', raw: '' }
  }

  if (trimmed.includes('@')) {
    return {
      kind: 'email',
      address: trimmed,
      href: `mailto:${trimmed}`
    }
  }

  const phoneRes = cleanPhoneNumber(trimmed)
  if (phoneRes.isValid && phoneRes.cleaned) {
    return {
      kind: 'phone',
      display: phoneRes.formatted || phoneRes.cleaned,
      e164: phoneRes.cleaned,
      href: `tel:${phoneRes.cleaned}`
    }
  }

  return { kind: 'unknown', raw: trimmed }
}
