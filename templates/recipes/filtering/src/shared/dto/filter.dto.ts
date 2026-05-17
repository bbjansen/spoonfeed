import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class SortDto {
  @ApiPropertyOptional({ description: 'Field to sort by' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.ASC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder: SortOrder = SortOrder.ASC;
}

export class BaseFilterDto extends SortDto {
  @ApiPropertyOptional({ description: 'Search term applied across searchable fields' })
  @IsOptional()
  @IsString()
  search?: string;

  /**
   * Build a where clause from the filter properties.
   * Override in subclasses to add domain-specific filters.
   */
  toWhere(): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (this.search) {
      where._search = this.search;
    }

    return where;
  }

  toOrder(): Record<string, SortOrder> | undefined {
    if (!this.sortBy) {
      return undefined;
    }

    return { [this.sortBy]: this.sortOrder };
  }
}
