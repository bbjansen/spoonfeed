# Dependabot and Renovate

Automated dependency update configurations for GitHub Dependabot and Renovate Bot.

## Links

- [GitHub Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
- [Renovate Documentation](https://docs.renovatebot.com)
- [Dependabot Configuration Options](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file)
- [Renovate on GitHub](https://github.com/renovatebot/renovate)

## Dependencies

No npm dependencies required. Both tools run as GitHub Apps or bots.

| Package | Version | Purpose                  |
| ------- | ------- | ------------------------ |
| (none)  | -       | Configuration files only |

## Usage

### Dependabot

Place `.github/dependabot.yml` in your repository root. Dependabot is built into GitHub and activates automatically.

### Renovate

Place `renovate.json` in your repository root and install the [Renovate GitHub App](https://github.com/apps/renovate).

Choose one tool per project to avoid conflicting PRs.

## Generated Files

| File                     | Description                             |
| ------------------------ | --------------------------------------- |
| `.github/dependabot.yml` | Dependabot version update configuration |
| `renovate.json`          | Renovate Bot configuration              |
