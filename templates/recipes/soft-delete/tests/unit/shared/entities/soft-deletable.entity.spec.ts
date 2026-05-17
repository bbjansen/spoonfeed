import 'reflect-metadata';
import { SoftDeletableEntity } from '../../../../src/shared/entities/soft-deletable.entity';
import { getMetadataArgsStorage } from 'typeorm';

class TestEntity extends SoftDeletableEntity {
  name: string;
}

describe('SoftDeletableEntity', () => {
  it('should have a deletedAt column marked as DeleteDateColumn', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (col) => col.target === SoftDeletableEntity,
    );
    const deletedAtColumn = columns.find((col) => col.propertyName === 'deletedAt');

    expect(deletedAtColumn).toBeDefined();
    expect(deletedAtColumn!.mode).toBe('deleteDate');
  });

  it('should initialize deletedAt as undefined on a new instance', () => {
    const entity = new TestEntity();

    expect(entity.deletedAt).toBeUndefined();
  });

  it('should have uuid-based primary key generation', () => {
    const generatedColumns = getMetadataArgsStorage().generations.filter(
      (gen) => gen.target === SoftDeletableEntity,
    );
    const idGeneration = generatedColumns.find((gen) => gen.propertyName === 'id');

    expect(idGeneration).toBeDefined();
    expect(idGeneration!.strategy).toBe('uuid');
  });
});
