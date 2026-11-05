---
title: "Saved views on admin lists"
description: "Named filters staff keep on an admin list (users, audit log): stored as the list's URL query, your own or shared with the other staff, and how a list offers them."
order: 8
author: "Platform Team"
lastUpdated: 1793750400000
coverImage: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&h=630&fit=crop"
tags: ["guide", "admin", "development"]
---

# Saved views on admin lists

Enhancement 5.10. A **saved view** is a named filter a staff member keeps for a list, such as "Locked accounts"
on the users list. The admin lists already keep their filters, sort and page in the URL, so a view is simply that
**URL query**: opening a view opens that URL.

| | |
|---|---|
| Where | The **Views** menu on **Users → All users** (`admin.users`) and the **Audit log** (`admin.audit-logs`) |
| Yours or shared | A view is yours. Mark it **shared** and the other admin staff see it too, with your name on it; only you can remove it |
| Limits | 30 views per person per list; a name up to 80 characters, unique among your views on that list (a repeat answers 409); a query up to 2,000 characters, starting with `?` |
| Who | Admin staff only. Saving and removing are audited like every state-changing request |
| Storage | `SavedListView`, soft-deleted when removed; its owner is part of account erasure (ADR 077) |

## Endpoints

| | |
|---|---|
| `GET /admin/saved-views?listKey=admin.users` | Your views on that list, then the ones other staff shared |
| `POST /admin/saved-views` | `{ listKey, name, query, shared }`: save the list's current query under a name |
| `DELETE /admin/saved-views/:viewId` | Remove one of yours (404 for anyone else's) |

The full request and response shapes are in the [API reference](./api-reference/saved-views.md).

## Offering saved views on another list

1. Add the list's key to `SavedListKeySchema` (`packages/shared/src/contexts/saved-views/schemas/saved-views.ts`).
2. Put `<SavedViewsMenu listKey="…" />` in the list's toolbar (`apps/admin/contexts/saved-views`), as
   `users-all-table.tsx` does. The list must keep its state in the URL; that's what a view saves.
3. Add a test that the menu appears on the list and opens a view's URL.
