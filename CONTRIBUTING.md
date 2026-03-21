# Contributing to slock-cli

## Development Setup

```bash
git clone https://github.com/TennyZhuang/slock-cli.git
cd slock-cli
pnpm install
```

## Common Commands

```bash
pnpm build          # Build the project
pnpm dev            # Build in watch mode
pnpm test           # Run tests
pnpm lint           # Lint source code
pnpm typecheck      # Type check without emitting
```

## Project Structure

```
src/
├── commands/       # CLI command implementations (auth, messages, channels, etc.)
├── lib/            # Core utilities (auth, client, target resolver)
└── index.ts        # Entry point

tests/
├── unit/           # Unit tests for lib utilities
└── integration/    # Integration tests for commands

.claude/skills/     # Agent-facing skill files
```

## Pull Request Guidelines

1. Create a feature branch from `main`
2. Keep changes focused — one feature or fix per PR
3. Ensure `pnpm lint`, `pnpm typecheck`, and `pnpm test` all pass
4. Write tests for new commands or utilities
5. Update README or skill docs if behavior changes

## Commit Messages

Use conventional commits:

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation only
- `refactor:` — code change that neither fixes a bug nor adds a feature
- `test:` — adding or updating tests
- `chore:` — tooling, CI, or config changes
