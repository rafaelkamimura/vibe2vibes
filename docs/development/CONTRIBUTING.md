# Contributing Guide

Thank you for helping shape the Agent Communication Bus! This guide captures the expectations for development workflow, code style, and review etiquette.

## Getting Started
- Install Node.js ≥ 18 and npm ≥ 9.
- Install project dependencies: `cd agent-communication-bus && npm install`.
- Copy `.env.example` to `.env` and tailor the values (see `docs/integrations/` for adapter-specific variables).
- Confirm TypeScript builds cleanly: `npm run build`.
- Run the environment validator before pushing: `npm run validate:env`.

## Branch & Commit Strategy
- Create feature branches from `main` with descriptive names (`feature/docker-ci`, `docs/api-guides`).
- Keep commits focused; squash noisy WIP commits before opening a PR.
- Follow conventional commit prefixes where possible (e.g., `feat:`, `fix:`, `docs:`) to aid changelog automation.

## Code Style
- TypeScript strict mode is enforced (`noImplicitAny`, `noUnusedLocals`, etc.).
- Prefer explicit interfaces and union types for shared structures.
- Maintain naming conventions: PascalCase for classes/interfaces, camelCase for variables/functions, UPPER_SNAKE_CASE for constants.
- Keep adapters resilient:
  - Wrap async operations in `try/catch`.
  - Use the adapter `log()` helper for context-rich messages.
  - Surface actionable errors (include agent/task IDs).
- Run linters and formatters locally:
  - `npm run lint`
  - `npm run format` (runs Prettier on `src/**/*.ts`)

## Testing Expectations
- Unit tests live under `tests/unit/` (mirrors `src/` hierarchy).
- Prefer dependency injection and mocks for process-spawning adapters.
- New features should include corresponding tests; clarify gaps in the PR description if deferring.
- Execute `npm test` locally; include focused runs (`npm test -- --testNamePattern="selector"`) when referencing specific cases in reviews.

## Pull Request Checklist
- [ ] Linked issue or clear problem statement in the description.
- [ ] Summary of changes and validation steps (commands, screenshots, logs).
- [ ] Tests updated/added (or rationale provided).
- [ ] Documentation updated (README, API docs, or integration guides).
- [ ] `npm run build` and `npm run lint` succeeded locally.

## Review Process
- Request review from at least one maintainer familiar with the affected area (core bus, adapters, docs).
- Respond to feedback promptly; mark conversations as resolved when addressed.
- Avoid force-pushing after reviews unless rebasing to resolve conflicts—notify reviewers if you do.

## Release Cadence
- Releases are tagged from `main` once CI passes and documentation is current.
- Follow semantic versioning (`major.minor.patch`).
- Ensure Docker images and npm packages are published together to avoid drift.

## Reporting Issues
- Use GitHub Issues (or internal tracker) with reproduction steps, logs, and environment details.
- For security vulnerabilities, reach out privately to the maintainers before disclosure.
