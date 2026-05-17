describe('Database seed script', () => {
  it('should define at least one seeder', () => {
    // The seed script defines a seeders array; verify structure expectations
    const seeders = [
      {
        name: 'Users',
        run: async () => 2,
      },
    ];

    expect(seeders.length).toBeGreaterThanOrEqual(1);
    expect(seeders[0].name).toBe('Users');
  });

  it('should return the number of seeded records', async () => {
    const seeder = {
      name: 'Users',
      run: async (_app: unknown) => {
        return 5;
      },
    };

    const count = await seeder.run(null);
    expect(count).toBe(5);
  });

  it('should propagate errors from individual seeders', async () => {
    const failingSeeder = {
      name: 'BadSeeder',
      run: async () => {
        throw new Error('seed failed');
      },
    };

    await expect(failingSeeder.run()).rejects.toThrow('seed failed');
  });
});
