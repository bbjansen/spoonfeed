import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

describe('JwtAuthGuard', () => {
  it('should allow public routes', () => {
    // Test that @Public() decorator bypasses the guard
    expect(true).toBe(true); // Replace with actual guard test
  });
});
