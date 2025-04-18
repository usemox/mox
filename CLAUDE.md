# Claude Code Helper

This document provides information to help Claude Code understand and work with this project.

## Code Quality Commands

Always run these commands to ensure code quality before committing:

```bash
# Run all checks (lint, format, typecheck)
bun run check

# Format code
bun run format

# Lint code
bun run lint

# Type check
bun run typecheck
```

## Project Structure

This is an Electron application with React and TypeScript. It uses:

- Electron for cross-platform desktop runtime
- React for UI components
- TypeScript for type-safe JavaScript
- TailwindCSS for styling
- MobX for state management
- Drizzle ORM for database interactions
- AI SDK for integration with various AI providers

## Git Workflow

- Husky is set up with a pre-commit hook that runs `bun run check`
- Always fix any lint/format/type issues before committing

## Development Workflow

1. Run `bun install` to install dependencies
2. Run `bun run dev` to start the development server
3. Run `bun run check` before committing changes
4. Run appropriate build command for your platform (`bun run build:mac`, etc.)