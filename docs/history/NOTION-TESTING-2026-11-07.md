# Testing the Notion integration from the front end

Written 2026-11-07. Parts 1 to 4 need no Notion account. Part 5 connects a real workspace.

## 1. Get it running

```bash
pnpm install
pnpm --filter @workspace/shared build
pnpm --filter @workspace/api-client build
pnpm db:migrate
pnpm db:seed
```

Add these to `apps/api/.env`. Leave `NOTION_WEBHOOK_SECRET` out for now: part 3 needs it unset.

```bash
DOCS_SYNC_REPORT_TOKEN=local-test-token-at-least-32-characters-long
```

Then start everything:

```bash
pnpm dev:stack
pnpm --filter @workspace/docs dev
```

| App | Address | Sign in |
|---|---|---|
| Admin | http://localhost:3001 | `superadmin@example.com` / `SuperAdmin@123` |
| Docs site | http://localhost:3002 | None |

## 2. The Docs sync page

Open **Admin → Operations → Docs sync** (http://localhost:3001/operations/docs-sync).

| Check | Expected |
|---|---|
| The sidebar | "Docs sync" under Operations. Switch language: it is translated |
| Setup card | Notion webhook **Not set**, Start a sync **Not set**, Run reports **Ready** |
| Sync now, Rebuild all pages | Both disabled, because this server has no GitHub credential |
| Latest card | A last sync and a last clean sync |
| Runs table | 6 seeded runs: 3 Succeeded, 1 Pages held back, 1 Blocked, 1 Failed |
| Status and Started by filters | The table narrows, and the choice stays in the address |
| Open the **Pages held back** run | "Rewards walkthrough" with two problems, what to change, and an Open the page button |
| Open the **Blocked** run | "Why nothing was published" names the duplicate slug |
| Open the **Failed** run | The Notion error, with no held-back section |
| Dark mode, and a phone width | Readable; the table becomes cards |
| Sign in as a merchant or customer and open the address | Refused |

## 3. Notion's verification token

This plays Notion's first request. No secret is set, so the API keeps the token:

```bash
curl -s -X POST http://localhost:8080/api/v1/integrations/notion/webhook \
  -H 'Content-Type: application/json' \
  -d '{"verification_token":"secret_test_token_123"}'
```

It answers `"outcome":"handshake"`. Refresh the page: a panel says Notion sent a token. **Show token** shows
`secret_test_token_123`, and **Copy** copies it. The token is never written to a log.

Now set `NOTION_WEBHOOK_SECRET=secret_test_token_123`, restart the API, and refresh: Notion webhook is **Ready**.

Send a signed event:

```bash
BODY='{"id":"11111111-2222-4333-8444-555555555555","type":"comment.created"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac 'secret_test_token_123' | sed 's/^.* //')
curl -s -X POST http://localhost:8080/api/v1/integrations/notion/webhook \
  -H 'Content-Type: application/json' -H "X-Notion-Signature: sha256=$SIG" -d "$BODY"
```

It answers `"outcome":"ignored"` (a comment changes no page). Send it again: `"outcome":"duplicate"`. Change one character
of the signature: 403. All three appear on **Admin → Received webhooks**, under the Notion provider.

## 4. A run arriving live

```bash
NOW=$(($(date +%s)*1000))
curl -s -X POST http://localhost:8080/api/v1/docs-publishing/sync-runs \
  -H 'Authorization: Bearer local-test-token-at-least-32-characters-long' \
  -H 'Content-Type: application/json' \
  -d "{\"runId\":\"manual-test-1\",\"source\":\"NOTION\",\"trigger\":\"MANUAL\",\"status\":\"PARTIAL\",\"converterVersion\":1,\"pagesProcessed\":3,\"pagesUnchanged\":180,\"pagesRemoved\":0,\"pagesHeldBack\":1,\"warnings\":0,\"heldBack\":[{\"sourceId\":\"page-1\",\"title\":\"My test page\",\"slug\":\"guides/test\",\"sourceUrl\":\"https://www.notion.so/page-1\",\"issues\":[{\"blockId\":\"block-1\",\"blockType\":\"embed\",\"reason\":\"A embed block cannot be published yet.\",\"fix\":\"Replace the embed with a link.\"}]}],\"errorSummary\":null,\"pullRequestUrl\":null,\"commitSha\":null,\"startedAt\":$NOW,\"finishedAt\":$((NOW+30000))}"
```

Refresh: the run is at the top, and its page shows "My test page". Send the same command again: still one row. Use a
wrong token: 401.

### The docs site

| Check | Expected |
|---|---|
| Open any guide at http://localhost:3002 | "Edit on GitHub" as before: nothing has moved to Notion yet |

To see a synced page, add this to the front matter of any guide, for example `docs/technical/getting-started.md`, then
undo it:

```yaml
source:
  kind: NOTION
  id: test
  url: https://www.notion.so/test
```

The link now says **Edit in Notion** and opens that address.

To see a redirect, put this in `docs/sync/redirects.json`, then set it back to `[]`:

```json
[{ "from": "/docs/old-address", "to": "/docs/README" }]
```

http://localhost:3002/docs/old-address lands on the README.

## 5. With a real Notion workspace

Follow `docs/technical/operations/docs-publishing.md`. The short version:

```bash
cp packages/docs-sync/.env.example packages/docs-sync/.env   # add NOTION_WRITE_TOKEN
pnpm docs:notion:setup --parent <page id>                    # copy the two ids into .env
pnpm docs:import --only user-guide/README                    # one page first
pnpm docs:sync --full --adopt                                # needs NOTION_READ_TOKEN too
git diff --stat
```

This is the first time the code meets the real Notion API, so expect to find differences here. Check what `git diff`
shows for that page, and read `.artifacts/docs-sync/import-review.md`. To undo the local change: `git restore docs`.
