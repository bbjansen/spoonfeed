import { maskEmail, maskPhone, maskCreditCard, maskIban } from '@/shared/utils/mask.util';

describe('Masking Utilities', () => {
  it('should mask email', () => {
    expect(maskEmail('john@example.com')).toMatch(/^\w\*+\w@example\.com$/);
  });

  it('should mask phone', () => {
    expect(maskPhone('+31612345678')).toMatch(/\*+5678$/);
  });

  it('should mask credit card', () => {
    expect(maskCreditCard('4111111111111111')).toMatch(/\*+1111$/);
  });

  it('should mask IBAN', () => {
    const masked = maskIban('NL91ABNA0417164300');
    expect(masked.startsWith('NL91')).toBe(true);
    expect(masked.endsWith('4300')).toBe(true);
  });
});
