# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Discord bot**: discord.js v14 (runs alongside Express)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Discord Bot

The bot runs inside `artifacts/api-server/src/bot/`. Guild configs are persisted to `artifacts/api-server/data/guild-configs.json`.

### Slash Commands
- `/criarscrim` — Opens multi-step flow to create a competitive scrim

### Prefix Commands (`.`)
- `.configscrim` — Configure bot settings (org name, category, roles, rules, admins)
- `.finalizar` — Finalize scrim (deletes all calls, channels, roles)
- `.cargoadd @user` — Give the configured scrim role to a user

### Features
- Dynamic slot panel with team enrollment
- Auto voice channel creation per team
- Confirmation system (X minutes before scrim)
- ID e Senha channel created 10 min before scrim
- Call config: remove/permit players, open/close call, limit members
- Auto-delete command messages + bot responses (4 min)
- Scrim role automatically created per scrim time

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
