# Documentation Site

VitePress-powered documentation site for project documentation.

## Links

- [VitePress Documentation](https://vitepress.dev)
- [VitePress on npm](https://www.npmjs.com/package/vitepress)
- [VitePress on GitHub](https://github.com/vuejs/vitepress)

## Dependencies

| Package     | Version | Purpose                                 |
| ----------- | ------- | --------------------------------------- |
| `vitepress` | `1.6.3` | Static site generator for documentation |

## Usage

Add scripts to `package.json`:

```json
{
  "scripts": {
    "docs:dev": "vitepress dev docs",
    "docs:build": "vitepress build docs",
    "docs:preview": "vitepress preview docs"
  }
}
```

Start the docs dev server:

```bash
pnpm docs:dev
```

## Generated Files

| File                            | Description                      |
| ------------------------------- | -------------------------------- |
| `docs/.vitepress/config.ts.ejs` | VitePress configuration template |
