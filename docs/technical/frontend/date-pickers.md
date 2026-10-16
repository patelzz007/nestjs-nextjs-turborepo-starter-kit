---
title: "Date pickers"
tags: ["date-picker", "calendar", "ui", "mobile", "forms"]
description: "Single-day, several-day and range pickers on web and mobile, all with a calendar whose month and year are jumpable: what each picker is for, how month/year jumping and multi-day picking behave, and the mobile building blocks."
order: 25
author: "Platform Team"
lastUpdated: 1792108800000
coverImage: "https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1600&q=80"
---

# Date pickers (web and mobile)

Every date the apps ask for is picked on a month calendar whose **month and year are jumpable**: a
month or year is one pick away, never one arrow click per month. This matters most for a date of
birth decades back. The same three kinds of picker exist on both platforms. They are all controlled
and data-agnostic: values are calendar days (`yyyy-MM-dd`), and validation belongs to the form's
shared zod schema.

| Need | Web (`@workspace/ui`) | Mobile (`@workspace/ui-native`) |
| --- | --- | --- |
| One day (a date of birth, a start date) | `DatePicker` | `DateField` |
| Several separate days (Sep 4, Sep 14, Oct 3) | `MultiDatePicker` | `MultiDateField` |
| A start and an end | `Calendar mode="range"` (see `AnalyticsRangePicker`) | `DateRangePicker` |

**See them in the apps:** the admin profile (`/account/profile`, `ProfileDemoDates`) and the mobile
Profile tab (`features/profile/demo-dates-section.tsx`) each have a **Dates (demo)** card with a date
of birth (100 years back to today) and up to 10 available days (today to the end of next year). The
card is a demo: its values live in component state only. There is no column for them, nothing is sent
to the API, and the card says so.

## Jumping to a month or year

- **Web:** `Calendar` sets `captionLayout="dropdown"` by default, so the caption is a month
  dropdown and a year dropdown. They are the UI kit's own `Select` (base-ui, `CalendarCaptionDropdowns`
  in `calendar-caption.tsx`), never the browser's native `<select>`. They keep react-day-picker's
  accessible names ("Choose the Month" / "Choose the Year") and its formatters, so `locale` and `labels`
  still apply. The nav bar lies over the caption row, so it is `pointer-events-none` and only its arrow
  buttons take clicks. The year list runs from `startMonth` to `endMonth`; months outside them are
  disabled, and a chosen year whose month is out of range lands on the nearest month in range. When the
  caller sets neither, the list runs from 100 years back (`DEFAULT_YEARS_BACK`, for dates of birth) to
  10 years ahead (`DEFAULT_YEARS_AHEAD`). react-day-picker's own default stops at the current year,
  which would hide future end dates. `DatePicker` and `MultiDatePicker` turn `fromDate` / `toDate` into
  those bounds. Pass `captionLayout="label"` for a plain caption. Tests drive the dropdowns with
  `@workspace/ui/testing/calendar-dropdowns`.
- **Mobile:** `CalendarNavigator` wraps the day grid. Its header shows the month and the year as
  buttons. Tapping one swaps the days for a 3 × 4 grid of the year's months, or for a scrolling list of
  the years in range, opened at the shown year. Choosing goes back to the days. Months outside the range
  are disabled. If the shown month is out of range in a chosen year, the calendar lands on the nearest
  month in range.

## Picking several days

Each click or tap picks a day or unpicks it. The value is always in date order without repeats.
`maxDates` caps the count: once it is reached, the unpicked days are disabled, so the limit is
visible and only unpicking is offered.

- **Web `MultiDatePicker`:** the popover stays open while days are picked (Escape or a click
  outside closes it), and `onValueChange` fires on every change. The trigger lists the picked days.
  With `name`, the form submits one hidden `name=yyyy-MM-dd` input per day.
- **Mobile `MultiDateField`:** picks are a draft in the sheet. The picked days show as chips (tap
  one to remove it), Clear empties the draft, and **Apply** hands it back. Cancel or closing the sheet
  keeps the field unchanged.

## Form integration

The mobile fields (`DateField`, `MultiDateField`, and the `CalendarField` trigger they share) follow
the kit contract (packages/ui-native/README.md). They forward a ref to the trigger. They take
`invalid` (or an `error` message), `disabled`, `loading`, `variant`, `size` and `className`. They
report `onFocus` when the calendar sheet opens and `onBlur` when it closes, which is how a form marks
the field touched.

## Building another picker on mobile

`CalendarField` (labelled trigger, hint/error and sheet), `CalendarNavigator` (month/year header) and
`CalendarMonthGrid` (Monday-first day buttons, each named by its full date and its role) are the
building blocks. They are in `packages/ui-native/src/components/`. The calendar arithmetic is pure
and tested in `packages/ui-native/src/lib/calendar.ts`.
