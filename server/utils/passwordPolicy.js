export const COMMON_PASSWORDS = new Set([
  'password123',
  'password1234',
  'password12345',
  '1234567890',
  '12345678901',
  '123456789012',
  'admin123456',
  'administrator',
  'qwertyuiop',
  'qwerty12345',
  'welcome1234',
  'letmein1234',
  'iloveyou123',
  'sunshine123',
  'princess123',
  'football123',
  'monkey12345',
  'dragon12345',
  'shadow12345',
  'superman123',
  'trustno1123',
  'master12345',
  'changeme123',
]);

export function validatePassword(password, { minLength = 10 } = {}) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required' };
  }
  const clean = password.trim();
  const requiredMin = Math.max(10, Math.min(16, parseInt(minLength, 10) || 10));
  if (clean.length < requiredMin) {
    return { valid: false, message: `Password must be at least ${requiredMin} characters long` };
  }
  if (COMMON_PASSWORDS.has(clean.toLowerCase())) {
    return { valid: false, message: 'This password is too common. Choose a stronger password.' };
  }
  return { valid: true };
}
