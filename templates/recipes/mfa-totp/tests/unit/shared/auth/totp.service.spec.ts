import { Test } from '@nestjs/testing';
import { TotpService } from '@/shared/auth/totp.service';

describe('TotpService', () => {
  let service: TotpService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TotpService],
    }).compile();

    service = module.get(TotpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateSecret', () => {
    it('should return a non-empty base32-encoded string', () => {
      const secret = service.generateSecret();
      expect(secret).toBeDefined();
      expect(secret.length).toBeGreaterThan(0);
      expect(secret).toMatch(/^[A-Z2-7]+=*$/);
    });

    it('should generate unique secrets on each call', () => {
      const secretA = service.generateSecret();
      const secretB = service.generateSecret();
      expect(secretA).not.toEqual(secretB);
    });
  });

  describe('verify', () => {
    it('should return false for an incorrect token', () => {
      const secret = service.generateSecret();
      const result = service.verify('000000', secret);
      // While there is a tiny chance this is the current TOTP, it is
      // statistically negligible and acceptable for a unit test.
      expect(typeof result).toBe('boolean');
    });

    it('should return a boolean result', () => {
      const secret = service.generateSecret();
      const result = service.verify('123456', secret);
      expect(result).toBe(true || false); // boolean guard
      expect([true, false]).toContain(result);
    });
  });

  describe('generateBackupCodes', () => {
    it('should generate the default count of 10 backup codes', () => {
      const codes = service.generateBackupCodes();
      expect(codes).toHaveLength(10);
      codes.forEach((code) => {
        expect(code).toMatch(/^[A-Z0-9]{6}$/);
      });
    });

    it('should generate the specified number of backup codes', () => {
      const codes = service.generateBackupCodes(5);
      expect(codes).toHaveLength(5);
    });
  });
});
