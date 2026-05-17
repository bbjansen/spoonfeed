type DefaultsFn<T> = () => T;
type Overrides<T> = Partial<T>;

interface Factory<T> {
  /** Build a single entity with optional overrides */
  build(overrides?: Overrides<T>): T;

  /** Build multiple entities with optional shared overrides */
  buildMany(count: number, overrides?: Overrides<T>): T[];

  /** Build an entity and transform it before returning */
  buildWith<R>(transform: (entity: T) => R, overrides?: Overrides<T>): R;
}

/**
 * Create a type-safe factory for generating test data.
 *
 * @param defaultsFn - A function returning the default values for each entity.
 *                     Called for every build to ensure unique values (e.g. UUIDs).
 *
 * @example
 * ```typescript
 * const userFactory = createFactory<User>(() => ({
 *   id: crypto.randomUUID(),
 *   email: `user-${Date.now()}@example.com`,
 *   name: 'Test User',
 *   isActive: true,
 * }));
 *
 * const user = userFactory.build({ name: 'Alice' });
 * const users = userFactory.buildMany(3);
 * ```
 */
export function createFactory<T>(defaultsFn: DefaultsFn<T>): Factory<T> {
  return {
    build(overrides: Overrides<T> = {}): T {
      return {
        ...defaultsFn(),
        ...overrides,
      };
    },

    buildMany(count: number, overrides: Overrides<T> = {}): T[] {
      return Array.from({ length: count }, () => this.build(overrides));
    },

    buildWith<R>(transform: (entity: T) => R, overrides: Overrides<T> = {}): R {
      return transform(this.build(overrides));
    },
  };
}
