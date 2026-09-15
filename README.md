# Flousey — your money coach

Flousey answers one question: **"Given the money I have right now, my bills, my savings and the days until my
next income, how much can I safely spend today?"**

- Product spec: [`SPEC/Project_Spec.md`](SPEC/Project_Spec.md)
- Audit, decisions & roadmap: [`SPEC/Audit_and_Recommendations.md`](SPEC/Audit_and_Recommendations.md)

## Stack

- Expo SDK 57 · React Native 0.86 · TypeScript · Expo Router (native tabs)
- `expo-sqlite` as the local source of truth (offline-first, data never leaves the device)
- Zustand for app state
- A pure TypeScript financial engine with Jest tests

## Getting started

```bash
npm install
npm run android     # builds the native app (needed after adding native modules such as expo-sqlite)
npm start           # starts Metro for an already-installed development build
```

## Scripts

| Command | What it does |
|---|---|
| `npm test` | Runs the engine unit tests (spec scenarios included) |
| `npm run typecheck` | Type-checks the project |
| `npm run android` / `npm run ios` | Builds and runs the native app |

## Project structure

```
src/
  domain/        Pure TypeScript: dates, money (integer minor units), bills, engine, advice, what-if, insights
    __tests__/   Jest tests, including the spec's worked example and validation scenarios
  data/          SQLite schema, migrations and repository
  store/         Zustand store (all writes) and the useFinancial() hook (derived status)
  ui/            Theme, UI kit, date picker, toast, transaction row
  app/
    (tabs)/      Today · Activity · Insights · Plan
    onboarding   5-step mid-month onboarding
    expense, income, what-if, balance, breakdown, pay-bill, bill, routine, protections, payday, cycle-end
```

The financial engine (`src/domain/engine.ts`) has no React imports and is deterministic. Every number the UI shows
comes from it, and future AI features must go through it rather than calculating money themselves.

`app-example/` holds the original Expo starter files. It is excluded from type-checking and tests and can be deleted.
