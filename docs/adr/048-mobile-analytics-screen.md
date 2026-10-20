---
title: "ADR 048: Mobile Analytics Screen (UI Only, Sample Data in the API's Shape)"
tags: ["adr", "mobile", "analytics", "charts", "design"]
description: "The mobile app gets an Analytics tab — the customer's own activity, the web's My Activity page on a phone, plus mobile extras — drawn with generic, token-coloured chart components and fed, for now, by deterministic sample data typed by the API's own dashboard contract."
author: "Platform Team"
lastUpdated: 1791763200000
coverImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=630&fit=crop"
order: 48
---

# ADR 048: Mobile Analytics Screen (UI Only, Sample Data in the API's Shape)

## Status

Accepted (2026-10-12). Implemented (2026-10-12). Extended (2026-10-12): more sections, more sample
data and a reusable chart set — see "Extension" below.

## Context

The web has a customer analytics page ("My Activity", `GET /claims/analytics/dashboard`): spend,
visits, rewards claimed and redeemed, top shops and referrals over a date range. The mobile app had
nothing comparable. The first version is wanted as **UI only, with no API call**, so the screen,
its charts and its interactions can be judged on a phone before it is wired to an account.

Three questions had to be answered: what data the screen shows when it reads nothing, how charts
are drawn without a charting library, and where the screen lives in the navigation.

## Decision

- **A fifth tab, "Analytics", second in the bar** (Home, Analytics, Search, Profile, Settings).
  Five is the most a bottom bar holds, and the floating pill (ADR 036) fits five on a 320 pt phone.
  The drawer (ADR 038) lists it with the other tabs. Header titles come from the tab registry, as
  for every tab.
- **The data is the API's contract, generated on the device.** `features/analytics/sample-dashboard.ts`
  returns a `CustomerAnalyticsDashboard` (`@workspace/shared`) — the exact type of the real endpoint
  — for the last 7, 30 or 90 days. Each day's activity comes from a generator seeded by the day
  itself, so a day reads the same in every range, weeks add up to their days, and tests are
  deterministic. A test parses every preset's sample through `CustomerAnalyticsDashboardSchema`.
  The screen is marked "Sample data" and says the numbers are not the person's own.
- **One seam for the real data.** `useActivityDashboard(preset)` is the screen's only data source.
  Wiring the API replaces its body with `api.claims.analyticsDashboard.useQuery(...)` (the
  api-client already has the endpoint) and adds the usual loading and error states; the sections
  do not change.
- **Same ranges and words as the web.** Presets `last7Days`, `last30Days` (default), `last90Days`;
  whole days ending today in UTC (the zone the API buckets a customer in); the bucket width the API
  derives (day up to 31 days, then week). KPI names, claim-status names and their chart colours
  are the web's (`apps/web/contexts/reporting/lib/customer-analytics.ts`).
- **Charts are react-native-svg, coloured by tokens.** No chart library: `TrendChart`,
  `Sparkline`, `ShareBar`, `RankedBarList`, `KpiTile` and `SegmentedControl` in
  `src/components`, with pure geometry in `src/lib/chart-geometry.ts` (round ticks, a monotone
  curve that never overshoots the data). SVG marks take colour the way `Icon` and `BrandMark` do:
  `currentColor` on a layer coloured through `colorClassName` (`accent-chart-1`, `accent-border`),
  so both themes come from `chart-1…3` and nothing in code is a colour value.
- **Interaction a phone can use.** Touch and drag the plot to scrub; a readout above the plot (never
  under the finger) names the bucket and each series' value, with a selection haptic per bucket.
  Screen readers get the same through the `adjustable` role (swipe up / down steps through the
  buckets), and every trend chart can list its values ("Show values").
- **Data-viz rules applied.** One y-axis per chart; a lone series gets a faint wash, two get a
  legend; hairline solid gridlines; 2 pt lines; ringed 8 pt dots; a 2 pt surface gap between share
  parts; colour follows the entity, never its rank; text never wears a series colour; a change is
  an arrow, a sign and a tone, never colour alone.

## Extension: more sections, more sample data, reusable charts

- **More sections.** After the web's sections the screen adds: highlights (busiest day, favourite
  shop, biggest bill, saved with rewards), this period against the previous one for five measures,
  visits by weekday (columns) and by weekday × time of day (heatmap), spend by time of day (donut) and
  by category (ranked bars), this month's budget (ring), stamp cards (step meters), and recent visits
  (timeline).
- **The extras have their own shape, not the contract's.** Category spend and the period comparison
  come from `CustomerAnalyticsDashboard`, which already carries them. The rest is data no endpoint
  returns, so it is `ActivityInsights` (`features/analytics/activity-insights.ts`), its closed sets
  (weekday, part of the day, a visit's reward) zod enums. It is not in `@workspace/shared` because
  nothing serves it: it is the shape a future endpoint would fill, and moves to the shared contracts
  when one does. `useActivityInsights(preset)` is its one seam, like `useActivityDashboard`.
- **One sample history behind both.** The day generator moved to `sample-activity.ts`; the
  dashboard and the insights are both built from it, so they agree (the weekday heatmap adds up to
  the visit total, the spend by time of day to the total spent). Each visit now has a time of day
  (from a second generator per day, so the first one's draws are unchanged) and keeps whether its
  reward was claimed and redeemed. The customer is out more at weekends and lunches out on weekdays,
  so the time charts have a shape to show.
- **Charts are generic and presentational.** `ColumnChart`, `HeatmapGrid`, `DonutChart`,
  `ProgressRing`, `ProgressList`, `ComparisonBars`, `HighlightGrid`, `Timeline` (and `ShareLegend`,
  shared by `ShareBar` and `DonutChart`) take values, labels and formatters, never analytics types,
  so any screen can use them. The analytics wording lives in `insight-presentation.ts`.
- **Colour.** The palette is the five `chart-*` tokens. Parts of the day have a fixed slot each
  (`chart-1…4`), never by rank. The previous period is `chart-5`, the neutral slot. The heatmap is one hue's
  four-step sequential ramp over the muted surface. Categories stay one hue in a ranked list, as on the web.
  There are seven categories and only four categorical slots, so a donut would need colour by rank.
- **Interaction.** Columns and heatmap cells are buttons: tap one to read it in the readout above the
  chart (with a selection haptic); screen readers hear each one's full name and value. Progress reads
  as a progress bar with its numbers.

## Revision: custom dates, values as a table, axis labels beside the plot

- **Custom dates.** The range control gains "Custom": a bottom sheet with a month calendar
  (`DateRangePicker`, generic; calendar maths in `src/lib/calendar.ts`) where the customer taps a
  start and an end day. Its header (`CalendarNavigator`, generic, shared with `DateField` / `MultiDateField` — see
  [Date pickers](../technical/frontend/date-pickers.md)) shows the month and the year as
  buttons: tapping either swaps the days for the months of that year or the years in range, so a far
  month is two taps away rather than one arrow tap per month (the web `Calendar` gets the same through
  its month / year dropdowns). The rules are the web's custom-range rules (`packages/client`
  `checkCustomRange`, which the app may not import, so `customRangeIssueOf` mirrors it): in order and
  at most `MAX_ANALYTICS_RANGE_DAYS` (366, the API's limit, in the API's words). Two rules belong to
  the picker: the range ends by today, and it starts at most two years back. The selection is a
  union (`preset` | `custom`); both resolve to the same `AnalyticsReportRange`, so the samples, the
  hooks and the sections take a range and do not care how it was chosen. Long ranges get the API's
  bucket widths (week up to 183 days, then month). A custom range's two periods are named by their days, not
  "Last N days". Closing the sheet without applying keeps the range on screen.
- **A chart's values are a table.** "Show values" lists them in `DataTable`: no borders, banded
  rows, right-aligned tabular figures, a column per series and a total row. Each row reads as one
  sentence ("Sat, 4 Oct: Claimed 3, Redeemed 2").
- **Y-axis values beside the plot.** The tick labels were drawn inside the plot box, the full width
  of which the data also used. A value near a gridline drew straight through its label. The labels now have
  their own column left of the plot: its rows are the label height, spread top to bottom. The
  plot's top and bottom insets are half that height, so each label is centred on its gridline by
  layout, not by offsets. The data cannot reach the labels.

## Alternatives

- **A charting library (Victory Native, react-native-gifted-charts, Skia-based kits):** another
  dependency, often a native module Expo Go lacks (Skia) or one that colours by value rather than
  by token, for four chart shapes that are a few dozen lines each on react-native-svg, which the
  app already ships.
- **A bespoke sample shape:** simpler to write, but the screen would then need rewriting against
  the real contract. Typing the sample by the contract makes the switch a change to one hook.
- **Analytics as a pushed screen from Home or the drawer:** a primary destination two taps deep.
  The tab bar has room for it.
- **A native date picker (`@react-native-community/datetimepicker`):** two separate pickers for a
  start and an end, no view of the range between, and a new native dependency. One calendar sheet
  shows the whole range and runs in Expo Go.
- **Calling the endpoint now:** explicitly out of scope for this version (UI only).
- **Adding the extras to `CustomerAnalyticsDashboard`:** a contract change with no server behind it;
  the API would then advertise fields it never fills. The local `ActivityInsights` shape waits for a
  real endpoint instead.
- **Spend by category as a donut:** seven categories, four categorical slots — colour would follow
  rank and change with the range. A ranked list keeps one hue and reads exact values.

## Consequences

- The tab bar has five tabs; a sixth destination goes in the drawer, not the bar.
- The chart components are generic and data-agnostic; other screens can reuse them.
- The dashboard's presentation helpers (formatters, KPI change, bucket labels) mirror the web's in
  `packages/client`, which the mobile app may not import. If they drift, lift the shared,
  framework-free parts into `packages/shared`.
- The design tokens `chart-1…3` pass the colour-blind separation and contrast checks of the
  data-viz validator but sit outside its lightness band and chroma floor (they are the muted brand
  navy and amber). Retuning them is a design-system change for web and mobile together.
- Until the hooks read the API, the numbers are not the person's: the "Sample data" badge and the
  footnote must stay until then.
- Wiring the API covers only the contract's sections. Highlights, time of day, budget, stamp cards
  and recent visits need an endpoint (or fields) of their own first. The monthly budget is a sample
  constant: a real one needs somewhere for the customer to set it.
