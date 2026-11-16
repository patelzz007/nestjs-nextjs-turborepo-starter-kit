# @workspace/ui-kit-logic

The rules the web kit (`@workspace/ui`) and the native kit (`@workspace/ui-native`) share for their data
components, so both lay out, validate and serialise the same way:

| Folder | What it holds |
| --- | --- |
| `gantt/` | Ranges, the time axis, rows and lanes, bars, baselines, dependencies, recurrence, the Gantt's copy |
| `event-calendar/` | View ranges, occurrences and recurrence, packing overlapping events, the calendar's copy |
| `filters/` | The query model (rules, groups, operators by value type), drafts, dates, serialisation, copy |
| `data-table/` | Column ids, selection and bulk actions, pagination modes, saved preferences, export text |
| `data-grid/` | The grid's copy and its clipboard text |
| `kanban/` | Moving cards and columns |
| `file-type/` | The file-type table and how a name or MIME type resolves to one |

Everything is plain TypeScript: no React, no DOM, no React Native. It depends on `@workspace/shared` (its
runtime narrowing, message formatting and units of time) and on `date-fns`.

## Why it is not in `@workspace/shared`

`@workspace/shared` is imported by every app (the API, the web apps, the mobile app) through its one barrel,
and a bundler keeps every module a barrel reaches. With these rules in it, every app carried them and
`date-fns` (about 290 KiB of the mobile bundle) whether it drew a Gantt chart or not. Here, only an app that
imports a kit component built on them carries them; the mobile app's release bundle does not (its showcase,
the only screen that uses them, is left out of release builds).

## Use

Import from the package's one entry point:

```ts
import { createFilterQuery, type GanttEvent } from "@workspace/ui-kit-logic";
```

A Next.js app that draws a kit component built on these rules lists the package in `transpilePackages` (it
ships TypeScript source, like `@workspace/ui`).

## Checks

`pnpm --filter @workspace/ui-kit-logic test` runs the rules' unit tests with coverage floors
(`vitest.config.ts`); `lint` and `typecheck` as every package.
