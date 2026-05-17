# Changelog

Automated changelog generation from Conventional Commits.

## Links

- [conventional-changelog-cli on npm](https://www.npmjs.com/package/conventional-changelog-cli)
- [conventional-changelog on GitHub](https://github.com/conventional-changelog/conventional-changelog)
- [Conventional Commits](https://www.conventionalcommits.org/)

## Dependencies

| Package                      | Version | Purpose                         |
| ---------------------------- | ------- | ------------------------------- |
| `conventional-changelog-cli` | `5.0.0` | CLI for generating CHANGELOG.md |

## Usage

Add scripts to `package.json`:

```json
{
  "scripts": {
    "changelog": "conventional-changelog -p angular -i CHANGELOG.md -s",
    "changelog:first": "conventional-changelog -p angular -i CHANGELOG.md -s -r 0"
  }
}
```

Generate the changelog:

```bash
# Append new changes
pnpm changelog

# Generate from scratch (first time)
pnpm changelog:first
```

## Generated Files

| File                | Description                        |
| ------------------- | ---------------------------------- |
| `.changelogrc.json` | Changelog generation configuration |
