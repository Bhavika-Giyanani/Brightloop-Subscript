export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmailAddress(value: unknown): ValidationResult {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return { valid: false, error: 'Email is required.' };
  }

  const email = value.trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { valid: false, error: 'Enter a valid email address.' };
  }

  return { valid: true };
}

export function validatePassword(password: unknown): ValidationResult {
  if (typeof password !== 'string' || password.length === 0) {
    return { valid: false, error: 'Password is required.' };
  }
  if (password.length <= 8) {
    return { valid: false, error: 'Password must be longer than 8 characters.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter.' };
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one special character.' };
  }
  return { valid: true };
}
