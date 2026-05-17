import {
  PaginatedQuery,
  PaginatedResponse,
  buildPaginationLinks,
} from '../../../../src/shared/dto/pagination.dto';

describe('PaginatedQuery', () => {
  it('should have default page 1 and limit 20', () => {
    const query = new PaginatedQuery();
    expect(query.page).toBe(1);
    expect(query.limit).toBe(20);
  });

  it('should compute skip correctly', () => {
    const query = new PaginatedQuery();
    query.page = 3;
    query.limit = 10;
    expect(query.skip).toBe(20);
  });
});

describe('PaginatedResponse', () => {
  it('should compute totalPages, hasNextPage, and hasPreviousPage', () => {
    const response = new PaginatedResponse(['a', 'b'], 10, 2, 5);
    expect(response.totalPages).toBe(2);
    expect(response.hasNextPage).toBe(false);
    expect(response.hasPreviousPage).toBe(true);
  });
});

describe('buildPaginationLinks', () => {
  const baseUrl = 'https://api.example.com/items';

  it('should include prev, next, first, and last links for a middle page', () => {
    const links = buildPaginationLinks(baseUrl, 2, 10, 5);
    expect(links).toContain('rel="prev"');
    expect(links).toContain('rel="next"');
    expect(links).toContain('rel="first"');
    expect(links).toContain('rel="last"');
    expect(links).toContain('page=1');
    expect(links).toContain('page=3');
    expect(links).toContain('page=5');
  });

  it('should omit prev link on the first page', () => {
    const links = buildPaginationLinks(baseUrl, 1, 10, 5);
    expect(links).not.toContain('rel="prev"');
    expect(links).toContain('rel="next"');
  });

  it('should omit next link on the last page', () => {
    const links = buildPaginationLinks(baseUrl, 5, 10, 5);
    expect(links).toContain('rel="prev"');
    expect(links).not.toContain('rel="next"');
  });
});
