---
title: "Runbook: Docs publishing"
tags: ["operations", "docs", "notion", "runbook"]
description: "Connecting a Notion workspace to the docs site: the databases, the import, the webhook, the GitHub App, the deploy, and what to do when a sync goes wrong."
author: "Platform Team"
category: "Operations"
date: 1794009600000
lastUpdated: 1794009600000
editedAt: 1794489806547
coverImage: "/images/covers/technical/operations/docs-publishing.webp"
---

# Runbook: Docs publishing

Writers publish in Notion. A sync turns published pages into Markdown and opens a pull request, and the merged commit is
deployed to the docs site. The design is [ADR 084](../../adr/084-docs-sync-sources.md). How it all works, and how to
make every token, is in [Notion integration](../notion-integration.md).

Until these steps are done nothing changes: the site keeps serving the repository's hand-written pages.

## 1. Create the Notion integrations

| Integration | Capabilities | Used for |
|---|---|---|
| Read | Read content only | Every sync. Share it with the two Published databases and nothing else |
| Write (temporary) | Read, insert and update content | Setup and import only. **Revoke it straight after** |

## 2. Create the databases

Create an empty page in Notion, share it with the write integration, and copy its id from the address.

```bash
cp packages/docs-sync/.env.example packages/docs-sync/.env   # then set NOTION_WRITE_TOKEN
pnpm docs:notion:setup --parent <page id>
```

It prints the two data source ids. Put them in `packages/docs-sync/.env`, and restrict the Published databases to
publishers in Notion: this is what makes "only publishers can publish" true.

Setup also lays out the page: how publishing works, links to the four databases, the docs as a folder tree, recent
edits, the blog, and the rules for writers. To lay out a page made before this, or to rebuild the layout:

```bash
pnpm docs:notion:layout              # refuses if the page holds anything besides its databases
pnpm docs:notion:layout --replace    # moves what is there (not the databases) to Notion's trash first
```

### Category and dates

Every page, guide or post, needs a **Category**, a **Date** (first published) and a **Last updated** date (when it last
changed in a way a reader should know about). A page missing one is held back with that reason. Notion's own edit time is
the third date: the sync writes it to the page as `editedAt`, and the site shows all three.

### How the folders work

Docs Published is a tree, like the repository's `docs/` folder:

| Property | What it holds |
|---|---|
| Kind | **Folder** or **Page** (empty counts as Page) |
| Parent | The folder the row is in; empty at the top. Notion shows a folder's rows under it (▸) |
| Slug | Only the row's own part of the address, with no `/` |

A page's address is its folders' slugs and its own: `technical` › `api` › `rest` is `/docs/technical/api/rest`.
Moving a page or renaming a folder moves it on the site, and the old address redirects. A page whose folder is missing,
unpublished or not a folder is held back with that reason. Status has no effect on a folder. The blog has no folders.

Publishing moves a page from Docs Drafts to Docs Published, and a relation does not move with it, so the publisher sets
the page's Parent after moving it.

## 3. Import, starting with a pilot

```bash
pnpm docs:import --only user-guide/README --only technical/getting-started
```

Check those pages in Notion. Then import the rest; it resumes, so it is safe to stop and run again.

```bash
pnpm docs:import
```

To start over, for example after a failed import or a converter fix, add `--fresh`. It first moves every page in both
Published databases to Notion's trash (restorable for 30 days), including any a writer made there, then imports from
scratch. Use it only before writers start working in Notion.

```bash
pnpm docs:import --fresh
pnpm docs:notion:drop      # only empty both Published databases, without importing again
```

Work through `.artifacts/docs-sync/import-review.md`: it lists what Notion could not hold, such as custom fences and raw
HTML. Then revoke the write integration.

## 4. Take over the pages

```bash
pnpm docs:sync --full --adopt
git diff --stat
```

Review the differences as a pull request. From then on those pages are generated, and CI refuses a hand edit to them.

## 5. Connect the webhook (optional, for immediate publishing)

Without it, the 15-minute schedule still publishes.

| Step | Where |
|---|---|
| Create a webhook subscription to `https://api.<domain>/api/v1/integrations/notion/webhook` | The read integration's Webhooks tab |
| Read the token Notion sends | Admin → Operations → Docs sync → **Show token** (kept for an hour) |
| Paste it into Notion to verify | The Webhooks tab |
| Set `NOTION_WEBHOOK_SECRET` to the same value, and restart the API | `apps/api/.env` |

## 6. Let the API start syncs and receive reports

```bash
DOCS_SYNC_GITHUB_TOKEN=     # fine-grained token: Actions read and write on this repository, nothing else
DOCS_SYNC_GITHUB_REPOSITORY=owner/name
DOCS_SYNC_GITHUB_REF=main
DOCS_SYNC_REPORT_TOKEN=     # openssl rand -hex 32
```

## 7. Set up GitHub

Create a GitHub App with **Contents** and **Pull requests** read and write, and install it on this repository.

| Kind | Name | Value |
|---|---|---|
| Variable | `DOCS_SYNC_ENABLED` | `true` |
| Variable | `DOCS_BOT_APP_ID` | The App's id |
| Variable | `NOTION_DOCS_DATA_SOURCE_ID`, `NOTION_BLOG_DATA_SOURCE_ID` | From step 2 |
| Variable | `DOCS_SYNC_API_URL` | `https://api.<domain>` |
| Secret | `DOCS_BOT_PRIVATE_KEY` | The App's private key |
| Secret | `NOTION_READ_TOKEN` | The read integration's token |
| Secret | `DOCS_SYNC_REPORT_TOKEN` | The value from step 6 |

For routine edits to merge by themselves, `main` needs two rulesets: one requiring every status check, which nobody may
bypass, and one requiring a review, which only the App may bypass. Without the bypass every docs pull request waits for
a reviewer.

## 8. Deploy the site

On the Droplet, as the deploy user:

```bash
git archive main packages/tooling/src/deploy tooling.config.ts | tar -x -C /srv/<slug>/bin/docs-deploy
```

Add a dedicated key to `authorized_keys`, allowed to run one command and nothing else:

```text
command="DEPLOY_ROOT=/srv/<slug> node /srv/<slug>/bin/docs-deploy/packages/tooling/src/deploy/docs-gate-cli.ts",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty ssh-ed25519 AAAA… docs-deploy
```

Render nginx again (it now has a `docs.<domain>` block) and add the host to the certificate. Then set, on the
`docs-production` environment, `DOCS_DEPLOY_HOST`, `DOCS_DEPLOY_USER`, `DOCS_DEPLOY_SSH_KEY` and
`DOCS_DEPLOY_KNOWN_HOSTS`; and the variables `DOCS_DEPLOY_ENABLED=true`, `DOCS_PUBLIC_SITE_URL`, `DOCS_PUBLIC_ADMIN_URL`
and `DOCS_PUBLIC_API_DOCS_URL`.

A release is about 680 MB unpacked, and five are kept: allow 4 GB.

## When something goes wrong

Everything shows on Admin → Operations → Docs sync.

| You see | It means | Do |
|---|---|---|
| **Pages held back** | Those pages kept their last good version; the rest published | Open the run: each page lists what to change. Fix it in Notion; the next sync retries |
| **Blocked** | Two pages disagree, such as a duplicate slug. Nothing was written | Fix the pages named in the run |
| **Failed** | The sync could not read Notion | Check the token and Notion's status. The schedule retries |
| Nothing new | The sync cannot report | Check `DOCS_SYNC_REPORT_TOKEN` matches on both sides |
| A pull request waits | It adds, removes or moves a page, or touches a sensitive section | Review and merge it |

### If an automatic rollback fails

```bash
ls -t /srv/<slug>/docs-releases                                  # find a release
ln -sfn /srv/<slug>/docs-releases/<commit> /srv/<slug>/docs-current
pm2 startOrReload /srv/<slug>/docs-current/ecosystem.config.cjs
rmdir /srv/<slug>/docs-deploy.lock                               # only if no deploy is running
```
