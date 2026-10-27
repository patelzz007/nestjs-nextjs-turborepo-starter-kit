# Product — Documentation site

<!-- impeccable:product-schema 1 -->

Inherits the root `PRODUCT.md`; only what differs is recorded here.

## Platform

web

## Users

- **Engineers** building on the kit, junior to principal, and AI agents reading the same files.
- **People who operate RewardHub**, who read the user guide.

## Product Purpose

A static, searchable "learning center" (Astro) rendering the repository's own Markdown: the
user guide, technical docs, ADRs, the generated API reference and the engineering blog.

## Operating Context

- **Source of truth:** the Markdown files, written to read well both on GitHub and here.
  Content is never copied into `apps/docs`.
- **Static output:** no server and no database. Any static host can serve the result.
- **Long reading sessions:** wide tables, code blocks and diagrams (Pele, with coloured
  nodes) are everyday content.

## Brand Commitments

- **Code blocks:** they have their own theme toggle, independent of the site's theme, with
  One Dark Pro among the dark options.
- **Sidebar:** the active item is `slate-900` with white text.
