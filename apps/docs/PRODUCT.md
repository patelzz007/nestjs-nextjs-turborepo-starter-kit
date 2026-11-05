# Product — Documentation site

<!-- impeccable:product-schema 1 -->

Inherits the root `PRODUCT.md`; only what differs is recorded here.

## Platform

web

## Users

- **Engineers** building on the kit, junior to principal, and AI agents reading the same files.
- **People who operate RewardHub**, who read the user guide.

## Product Purpose

A searchable "learning center" (TanStack Start, every page pre-rendered) rendering the repository's own Markdown: the
user guide, technical docs, ADRs, the generated API reference and the engineering blog.

## Operating Context

- **Source of truth:** the Markdown files, written to read well both on GitHub and here.
  Content is never copied into `apps/docs`.
- **Pre-rendered output:** no database. Every page is static HTML; a small Start server answers the
  404 page and search with `?q=` (the Notion docs plan, §9).
- **Long reading sessions:** wide tables, code blocks and diagrams (Pele, with coloured
  nodes) are everyday content.

## Brand Commitments

- **Code blocks:** they have their own theme toggle, independent of the site's theme, with
  One Dark Pro among the dark options.
- **Identity (B + F):** precise layout, a drafting-grid header on frosted glass, the guide's cover band
  with its page icon; graphite and verdigris on warm paper, IBM Plex Sans and Mono.
- **Sidebar:** the active item is a solid verdigris pill; hover is a soft wash, never the same look.
- **Callouts** are the shared `Alert` (Tile), the same component the apps use.
