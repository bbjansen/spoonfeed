import { renderTemplate } from '@spoonfeed/generator/template-engine';

describe('renderTemplate', () => {
  it('should render EJS template with data', () => {
    const template = '{ "name": "<%= name %>" }';
    const result = renderTemplate(template, { name: 'my-app' });
    expect(result).toBe('{ "name": "my-app" }');
  });

  it('should handle conditional blocks', () => {
    const template = [
      '{',
      '<% if (includeSwagger) { %>',
      '  "swagger": true,',
      '<% } %>',
      '  "name": "<%= name %>"',
      '}',
    ].join('\n');

    const withSwagger = renderTemplate(template, {
      name: 'my-app',
      includeSwagger: true,
    });
    expect(withSwagger).toContain('"swagger": true');

    const withoutSwagger = renderTemplate(template, {
      name: 'my-app',
      includeSwagger: false,
    });
    expect(withoutSwagger).not.toContain('"swagger"');
  });

  it('should handle array iteration', () => {
    const template = ['<% for (const dep of deps) { %>', '<%= dep %>', '<% } %>'].join('\n');
    const result = renderTemplate(template, { deps: ['a', 'b'] });
    expect(result).toContain('a');
    expect(result).toContain('b');
  });

  it('should throw on missing variables', () => {
    expect(() => renderTemplate('<%= missing %>', {})).toThrow();
  });

  it('should throw on invalid EJS syntax', () => {
    expect(() => renderTemplate('<% if ( %>', {})).toThrow();
  });
});
