import { GraphqlModule } from '../../../../src/infrastructure/graphql/graphql.module';

describe('GraphqlModule', () => {
  it('should be defined', () => {
    expect(GraphqlModule).toBeDefined();
  });

  it('should be a class that can be referenced as a module', () => {
    expect(typeof GraphqlModule).toBe('function');
    expect(GraphqlModule.name).toBe('GraphqlModule');
  });
});
