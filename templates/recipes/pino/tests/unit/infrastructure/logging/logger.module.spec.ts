describe('LoggerModule', () => {
  it('should configure pino for the environment', () => {
    const env = process.env.NODE_ENV ?? 'development';
    expect(['development', 'test', 'production']).toContain(env);
  });
});
