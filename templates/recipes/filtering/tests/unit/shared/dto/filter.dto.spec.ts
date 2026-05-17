import { SortOrder, SortDto, BaseFilterDto } from '../../../../src/shared/dto/filter.dto';

describe('SortDto', () => {
  it('should default sortOrder to ASC', () => {
    const dto = new SortDto();
    expect(dto.sortOrder).toBe(SortOrder.ASC);
  });

  it('should leave sortBy undefined by default', () => {
    const dto = new SortDto();
    expect(dto.sortBy).toBeUndefined();
  });
});

describe('BaseFilterDto', () => {
  it('should produce an empty where clause when no search is set', () => {
    const dto = new BaseFilterDto();
    expect(dto.toWhere()).toEqual({});
  });

  it('should include _search in where clause when search is set', () => {
    const dto = new BaseFilterDto();
    dto.search = 'hello';
    expect(dto.toWhere()).toEqual({ _search: 'hello' });
  });

  it('should return undefined order when sortBy is not set', () => {
    const dto = new BaseFilterDto();
    expect(dto.toOrder()).toBeUndefined();
  });

  it('should produce correct order object when sortBy is set', () => {
    const dto = new BaseFilterDto();
    dto.sortBy = 'name';
    dto.sortOrder = SortOrder.DESC;
    expect(dto.toOrder()).toEqual({ name: 'desc' });
  });
});
