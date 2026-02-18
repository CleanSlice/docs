# Git Commit Standards

CleanSlice follows [Conventional Commits](https://www.conventionalcommits.org/) for consistent, meaningful commit history.

## Format

```
<type>: <description>
```

Keep commits short and simple. One line is enough for most commits.

## Commit Types

| Type | Description | Version Bump |
|------|-------------|-------------|
| `feat` | New feature | MINOR (1.x.0) |
| `fix` | Bug fix | PATCH (1.0.x) |
| `docs` | Documentation only | — |
| `refactor` | Code change (no feature or fix) | — |
| `test` | Adding or updating tests | — |
| `chore` | Maintenance tasks | — |

## Rules

1. Use **lowercase** for the description
2. No period at the end
3. Use **imperative mood** ("add" not "added")
4. Keep under 72 characters

## Examples

```
feat: add user authentication
fix: resolve login timeout issue
docs: update API documentation
refactor: simplify validation logic
test: add unit tests for user gateway
chore: update dependencies
```

## Breaking Changes

Add `!` after the type to indicate a breaking change:

```
feat!: change response format
fix!: remove deprecated API endpoint
```

Breaking changes trigger a MAJOR version bump (x.0.0).

## Versioning

Follows [Semantic Versioning](https://semver.org/):

- `fix` → PATCH (1.0.0 → 1.0.1)
- `feat` → MINOR (1.0.0 → 1.1.0)
- `!` (breaking) → MAJOR (1.0.0 → 2.0.0)
