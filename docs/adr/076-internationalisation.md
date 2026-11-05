---
title: "ADR 076: Internationalisation — typed label packs in English, Malay, Mandarin and Tamil"
tags: ["adr", "i18n", "frontend", "mobile"]
description: "The apps speak English, Malay, Simplified Chinese (Mandarin) and Tamil through typed label packs (one object per language, checked complete by the compiler), chosen per user and per device, rolled out surface by surface starting with the UI kit."
author: "Platform Team"
lastUpdated: 1793664000000
coverImage: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1200&h=630"
order: 76
---

# ADR 076: Internationalisation — typed label packs in English, Malay, Mandarin and Tamil

## Status

**Accepted (2026-11-03).** Languages chosen by the owner: English, Malay, Mandarin, Tamil (enhancement 5.2).

## Context

Content is already multilingual (the seed has campaign titles in Chinese, Tamil, Hindi and Malay), but every
interface string is English. The UI kit was built for this from the start: its copy lives in a typed
**label pack** (`packages/ui/src/lib/labels/en.ts`, type `UiKitLabels`), read through
`UiKitLanguageProvider`, with one switch (`PLATFORM_UI_KIT_LANGUAGE`). Feature copy follows the same
pattern in places (`NotificationSettingsLabels`: "one object, so a locale is one more value of this type").

## Decision

1. **Languages:** `en` (English, the source), `ms` (Bahasa Melayu), `zh-Hans` (Simplified Chinese, for
   Mandarin readers in Malaysia), `ta` (Tamil). One BCP 47 tag each; `UiKitLanguageSchema` lists them.
2. **One JSON catalogue per language, typed against English.** *Amended 2026-11-05 (enhancement 5.2, your
   call):* each surface's words live in `messages/<language>.json` (`en.json`, `ms.json`, `zh-Hans.json`,
   `ta.json`), not in TypeScript packs. A string that takes a value is an **ICU message**:
   `{count, plural, one {# item} other {# items}}` (plurals by the language's own rules, `Intl.PluralRules`),
   `{mode, select, tree {…} other {…}}` for a choice, `{name}` for a value, so a translator reorders, pluralises
   and chooses without code. Formatting is `formatMessage` in `@workspace/shared` (FormatJS `intl-messageformat`).
   A surface keeps its typed label contract (`UiKitLabels`, …): one **binding**, the same for every language,
   turns a catalogue into it (`bindUiKitLabels`), so components still call `labels.selectedCount(3)`. Nothing can
   ship incomplete: each catalogue is typed against English's file (a missing key fails the build), and
   `catalogIssues` (in each surface's catalogue test) refuses an extra key, a list of another length, an empty
   message, or a message that does not parse or takes other values than English's. A label with variants keeps
   them in a group under its own key (`"search": { "all": "Search…", "within": "Search {parentLabel}…" }`).
   The original TypeScript packs were converted with an equivalence check (every function called with the same
   arguments in old and new, every string compared: 2,508 calls and 2,336 strings, identical), and removed.
   Where they live: the UI kit's in `packages/ui/src/lib/labels/messages/`, each app's sidebar words in
   `lib/navigation/sidebar-messages/`, each app's own words in `lib/i18n/messages/` (grouped by area).
3. **Choosing the language:** the device's own choice (the `lang` cookie the language picker sets), then the
   signed-in person's saved language, then the browser's `Accept-Language`, then English. The phone app uses
   the same order with the device locale in place of `Accept-Language`.
   *Amended 2026-11-04 (enhancement 5.2, phase 2):* the saved language lives on the account (`User.locale`,
   `PUT /auth/profile/language`), not in `UserPreference`, because notifications already read it there: one
   value for the apps and the messages. And the device's choice comes first, not the saved one: every account
   starts at the default `en`, which can't be told apart from a choice, so a guest who picked Malay on the
   sign-in page would be switched back to English by signing in. A choice made while signed in is saved on the
   profile and set on the device together, so the two only differ until the person picks again; on a device
   that hasn't chosen, the saved language applies after sign-in (`ProfileLanguageSync`).
4. **Formatting** of dates, numbers and money uses `Intl` with the chosen tag (`ms-MY`, `zh-Hans-MY`,
   `ta-MY`, `en-MY`), never hand-written formats.
5. **Rollout, surface by surface:** (a) the UI kit pack (every shared component); (b) feature label objects
   that already exist (notification settings, broadcasts, the inbox); (c) each app's pages, one bounded
   context at a time, extracting copy into a label object as the page is next touched. English stays the
   fallback only in the sense that it is the first pack written; every pack is complete when it merges.
6. **Translations** are written by people who read the language; a machine draft is allowed but marked
   for review in the pull request. Server-sent copy (emails, push) follows the recipient's preference.

## Consequences

- No string can be missing in one language: the compiler refuses the build, and the catalogue test refuses a
  message whose placeholders differ from English's.
- Numbers in messages are formatted by `Intl` in Malaysian conventions (`en-MY`, `ms-MY`, `zh-Hans-MY`, `ta-MY`),
  so a count of 1,234 reads `1,234` in every language (the old packs printed `1234`).
- Adding a language is one more pack per surface, found by the compiler.
- App pages stay English until their context is converted; the rollout is tracked in the changelog.
- Tamil and Chinese need fonts with their glyphs: the system font stacks cover them on every supported
  platform; the brand font (Geist) falls back per glyph.
