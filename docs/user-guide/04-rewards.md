---
title: "4. Rewards: create, review, publish"
description: "How a merchant creates a reward, submits it for review, and how a platform admin approves or returns it."
order: 5
author: "Product & Platform Team"
lastUpdated: 1791072000000
coverImage: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&h=630&fit=crop"
tags: ["user-guide", "rewards", "review"]
---

# 4. Rewards: create, review, publish

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Save as draft
    [*] --> PENDING_REVIEW: Create and submit
    DRAFT --> PENDING_REVIEW: Publish (submit for review)
    PENDING_REVIEW --> PUBLISHED: Admin approves
    PENDING_REVIEW --> DRAFT: Admin returns it with a reason
    PUBLISHED --> EXPIRED: Expiry date passes
    PUBLISHED --> DISABLED
```

## Create a reward (owner or merchant admin)

**My Rewards → Create New** (needs the *manage rewards* capability: owners and admins).

| Field | Meaning |
| --- | --- |
| Title, description, terms | What customers see |
| Photos | 1–10 photos, the first is the cover. Each becomes a 16:9 image of at least 1920 × 1080 (Full HD); a larger photo keeps its extra detail, up to 4K. A photo of another shape opens a crop step: zoom all the way out to keep the whole photo, with a soft blur of it filling the space around it |
| Category | cafe, restaurant, retail, wellness, entertainment, food, beverage |
| Type and value | `DISCOUNT`, `FREE_ITEM`, `CASHBACK`, `POINTS`, `BOGO`, with a value |
| Quantity | How many customers can claim it in total (stock) |
| Start and expiry date | When it is visible and claimable |
| Stores | **All stores** or **selected stores** (redeemable only there) |
| Rules | Maximum claims per customer; minimum spend in RM (checked against the whole bill at checkout) |
| Referrals | Whether customers can earn a referrer reward through it, the size of the referral pool and the title of the referrer reward ([Referrals](./07-referrals.md)) |
| Save as draft | Keep it private; otherwise it is submitted for review straight away |

A draft (or a reward waiting for review) can still be edited. **Publish** on a draft submits it
for review; the merchant cannot make it live alone.

## Review a reward (platform admin)

1. **Rewards → Review** lists every reward in `PENDING_REVIEW`, oldest first — just its cover,
   title and merchant. **View more** opens the reward's own page (`/rewards/review/<id>`).
2. The reward's page shows everything a decision needs: its status, the photos, the description
   and terms, and a **Details** card (offer, type, category, quantity left, start and expiry,
   stores, minimum spend, uses per customer, referrals, reward ID).
   The photos show as a carousel (swipe, the arrows or the dots move between them).
   **View full size** opens them in a larger carousel, on the photo the page shows; **Download**
   (on the page or in the viewer) saves the shown photo's original upload (Full HD to 4K). With
   several photos, **Download all** saves every one of them at once as a single ZIP file
   (`<reward-title>-photos.zip`, the photos numbered in carousel order).
3. **Approve** → `PUBLISHED`: it appears on the web app immediately. The owner gets an in-app
   notification ("Reward approved"). You return to the queue.
4. **Reject** asks for an optional reason → back to `DRAFT`; the owner gets the reason as a
   notification ("Reward needs changes"), edits and submits again. You return to the queue.
   Approve and reject show only while the reward is pending review; the page itself still opens
   afterwards.

## Under the hood

| Step | API |
| --- | --- |
| List / read / create / edit | `GET|POST /api/v1/orgs/{orgSlug}/rewards`, `GET|PATCH …/rewards/{rewardId}` |
| Submit for review | `POST …/rewards/{rewardId}/publish` |
| Admin queue / reward / decision | `GET /api/v1/admin/rewards/pending`, `GET /api/v1/admin/rewards/{rewardId}`, `POST /api/v1/admin/rewards/{rewardId}/approve`, `…/reject` |
| Admin downloads a photo | `GET /api/v1/admin/rewards/{rewardId}/images/{fileId}/download` (a short-lived signed URL of the original upload) |
| Admin downloads all photos | `GET /api/v1/admin/rewards/{rewardId}/images/archive` (one ZIP of the original uploads, streamed) |
| Customers see it | `GET /api/v1/rewards`, `GET /api/v1/rewards/{rewardId}` |

Examples: [Merchant organizations API](../technical/api-reference/merchant-organizations.md#organization-rewards),
[Platform administration API](../technical/api-reference/platform-admin.md).
