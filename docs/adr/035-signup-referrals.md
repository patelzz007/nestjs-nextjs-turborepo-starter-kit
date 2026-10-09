---
title: "ADR 035: Signup Referrals"
tags: ["adr", "rewards", "referrals"]
description: "A signup referral is a registration-time relationship through a rotating referral code. It becomes successful when the referee redeems a reward, and it does not pay the referrer."
author: "Platform Team"
lastUpdated: 1791504000000
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=630&fit=crop"
order: 35
---

# ADR 035: Signup Referrals

## Status

Accepted (2026-10-09). Implemented 2026-10-09; the first implementation was reviewed and corrected the same day — see [Implementation review](#implementation-review-2026-10-09).

Terms used below are defined in `GLOSSARY.md`. **Reward referral**, **attribution token**, **referrer reward**, **referral pool**, **pending**, **credited**, and **blocked** belong to the reward-scoped feature that already ships. This ADR does not change that feature. **Referral code**, **signup referral**, **successful**, and **not redeemed** belong here.

## Context

A person who already has an account can pass one code to many people. Each of those people types the code while registering on the consumer web app (`apps/web`, `http://localhost:3000`). The product then remembers that the new account was referred by the code's owner. The owner can call that referral successful only after the new person redeems at least one reward at POS checkout.

That is a different fact from a reward referral. A reward referral names at most one referee for one published reward, carries an attribution token, and can pay the referrer from that reward's referral pool when the referee redeems that same reward. Reusing those tables for a shared registration code would either pay a reward nobody was promised, or overwrite a code the audit history has to keep.

Signup today accepts email, password, and full name (`SignupSchema`). A taken email receives the generic response "If this email is available, check your inbox for verification instructions." and creates no second account. That disguise stays. The admin user list is `GET /auth/admin/users`, rendered at `/users`, with `filter[status]` (`active`, `inactive`, `locked`), `filter[role]`, and `search`. The user profile is `/users/[id]`. Both already show the account. This ADR adds the referrer and the signup-referral status to those same surfaces.

## Decision

### Two records

1. A **referral code** row is owned by one user. It stores the code itself. It is never updated. A later period is a new row.
2. A **signup referral** row links one referee to one referrer and to the code row used at registration. The referee has at most one. The referrer has as many as people who register with that referrer's codes.

Both are business entities. They carry `isDeleted`, `deletedAt`, and `deletedBy`. This slice has no withdraw, no admin delete, and no user-facing delete. Those columns stay unset. History is the append of new code rows, not an edit of an old one.

A signup referral stores:

| Field | Meaning |
| --- | --- |
| `id` | Row id. |
| `referrerUserId` | Owner of the code that was accepted. |
| `refereeUserId` | The new account. Unique. |
| `referralCodeId` | The code row presented at signup. Kept after that code expires. |
| `successfulAt` | Epoch milliseconds of the first qualifying redemption, or null while not redeemed. |
| `successNotifiedAt` | Epoch milliseconds when the in-app notification was recorded, or null while still owed. |
| `createdAt` | When the referee account was created with this code. |

A referral code stores:

| Field | Meaning |
| --- | --- |
| `id` | Row id. |
| `userId` | Owner. |
| `code` | The canonical uppercase value. Unique across every row ever inserted. |
| `createdAt` | Insert time. The validity window starts here. |
| `expiresAt` | `createdAt` plus 30 days. Written once. Later edits of the duration do not rewrite old rows. |

`expiresAt` is `createdAt + 30 * 86_400_000` milliseconds. The window is 30 periods of 24 hours, measured from the insert, in the same epoch-millisecond clock as the rest of the API (ADR 028). It is not a calendar month and it is not backdated to the previous code's expiry.

### Code shape

The alphabet is the 31 characters `23456789ABCDEFGHJKMNPQRSTUVWXYZ`. It omits `0`, `O`, `1`, `I`, and `L`. A code is 8 characters from that alphabet. The row stores the uppercase form. Comparison trims surrounding whitespace and folds case, so `ab2c` and `AB2C` are the same code when the rest of the characters match an issued value. The screen shows uppercase. The value is the audit record, so it is not hashed and not encrypted.

Eight characters from 31 symbols is the shared secret. It is meant to be read aloud or typed. It is not a session token and not an attribution token.

Every issued value stays unique forever, including codes whose owners are deleted, deactivated, or past `expiresAt`. The generator retries on collision. A retired value is never selected again.

### Who receives a code

Every account that is not soft-deleted receives a referral code.

| Path | First code | May submit someone else's code |
| --- | --- | --- |
| Consumer web signup | Same database transaction as the new user. | Yes. Optional field on that form only. |
| Mobile signup | Same transaction as the new user. | No. The mobile form does not ask. The account has no referrer. |
| Merchant-created staff or cashier | Same transaction as the new user. | No. That form does not ask. The account has no referrer. |
| Account that already exists and has zero code rows | Next hourly job run. | Only if the account is being created through consumer web signup. An existing account cannot attach a code later. |

The hourly job also inserts a successor. It never updates a code, never changes `expiresAt`, and never deletes a row.

The job skips soft-deleted users. It still inserts for a deactivated user, so a later reactivation has a code. Registration rejects that code until `isActive` is true again. A temporary lock (`lockedUntil`) does not stop issuance and does not reject the code.

New accounts do not wait for the job. The create-user transaction writes the first code before commit. If that transaction rolls back, neither the user nor the code remains.

### Validity

A presented code is valid only when all of the following hold at the instant of signup:

1. A row exists whose canonical `code` equals the folded input.
2. That row is the owner's latest code (`createdAt` greatest; tie broken by `id`).
3. `now < expiresAt` on that row.
4. The owner is not soft-deleted.
5. The owner has `isActive = true`.

An older row for the same owner is never valid, even if its `expiresAt` is still in the future. Issuance does not create that overlap on purpose. The check makes a raced double insert safe: the later row wins, and the earlier row stops being acceptable.

A temporary lock on the owner does not fail this check.

Unknown, expired, and unavailable codes are three validation errors. Unavailable covers a soft-deleted owner and a deactivated owner, without saying which. The errors are safe to show when the email is already taken, because they describe the code, not whether the email exists.

| Input after trim and case fold | Result |
| --- | --- |
| Empty | Field omitted. Account is created with no signup referral. |
| No row | Validation error: unrecognized code. No account. |
| Row exists, not the latest, or `now >= expiresAt` | Validation error: expired code. No account. |
| Latest row, owner soft-deleted or `isActive = false` | Validation error: unavailable code. No account. |
| Latest row, owner only temporarily locked, otherwise valid | Accepted. |
| Valid code, email already registered | Generic signup response. No account. No signup referral. The code stays usable for other people. |
| Invalid code, email already registered | The code validation error. No generic disguise. No account. |
| Valid code, new email, owner is the account being created | Impossible on this path. Reject if it ever occurs. No account. |

The code check runs before the taken-email disguise. A bad code never looks like a successful registration.

A valid code is not consumed. B and C may both register with A's current code. Each registration inserts its own signup referral. The code row's `code` does not change.

### Signup referral rules

The optional field exists only on consumer web signup. Leaving it blank, or sending only whitespace, stores no referrer.

A successful signup with a valid code inserts the user, the user's own first referral code, and the signup referral in one transaction. The signup referral's `referrerUserId` is the code owner. `referralCodeId` is that code row. `successfulAt` and `successNotifiedAt` are null. `createdAt` is the new account's creation time.

The referee user id is unique on signup referrals. A second code cannot be added, swapped, or cleared later. Merchant provisioning, mobile signup, and the generic taken-email response do not insert a signup referral.

The referrer and the referee may be any non-deleted users. A referee can later refer other people with their own code. Those people are not referees of the original referrer. The relationship is one hop.

This slice does not try to detect two accounts controlled by the same person. Device and IP checks stay on the reward-referral side of the product, and this slice does not write `blocked`.

### Success

A signup referral becomes successful inside the POS checkout transaction that creates the referee's first redemption.

Qualifying redemption: a `RewardRedemption` committed by checkout for that referee. Any reward counts, including a reward the referee received by some other path. Several claims on one bill still produce one success. A claim that is not redeemed does not count. A checkout that rolls back does not count. A user with no signup referral does not change this transaction, apart from the absence of this extra write.

The write is a conditional update: `successfulAt` is set to the checkout's paid time only where it is still null. The losing concurrent checkout sees a row already stamped and does not stamp it again. Later redemptions do not create a second signup referral and do not move `successfulAt`.

Nothing is paid. Checkout does not insert a referrer-reward claim, does not decrement a referral pool, and does not credit a reward referral because of this stamp.

### Notification

The referrer is told only when `successfulAt` moves from null to a timestamp. Registration sends nothing. An email is not sent for this feature.

The in-app notification names the referee's `fullName` as it is at send time. It links to `/rewardhub/referrals`. It is recorded once. `successNotifiedAt` is set when that notification row is stored. A checkout idempotency replay, a second redemption, and a retry that finds `successNotifiedAt` already set do not create another notification. If the checkout committed and the notification write failed, a later pass sends it and then sets `successNotifiedAt`. The success stamp is not rolled back to force that retry.

The stored notification is not rewritten if the referee later changes their name.

### Consumer screen

`/rewardhub/referrals` is the only consumer screen for this feature. The sidebar item Referrals points there. Invite Friends, My Referrals, and Earnings stay disabled. The reward detail page does not grow a refer action. There is no typed-code field anywhere except signup.

The signed-in user sees:

| Block | Content |
| --- | --- |
| Current code | Uppercase latest code, with a copy control, while `now < expiresAt`. |
| Expiry | That row's `expiresAt`. |
| Expired state | The same code, labeled expired, copy control unavailable, until a successor exists. |
| Referee list | One row per signup referral whose `referrerUserId` is the signed-in user. |

Each referee row shows the referee's current `fullName`, the signup referral's `createdAt`, and either Not redeemed or Redeemed. It does not show email, phone, user id, or the code value that was used. A rename updates the name on this list. The notification already sent keeps the old name.

The list includes referees who used an older code of this same owner. It is ordered by `createdAt` descending. An empty list is an empty state, not an error. The screen does not list historical code values.

The referee has no consumer surface that shows their referrer.

### Admin

Anyone who can already call `GET /auth/admin/users` and `GET /auth/admin/users/:userId` can see the new facts. There is no new permission. There is no admin referrals page. The admin panel does not show code values.

The users table gains two columns:

| Column | When the user has a signup referral | Otherwise |
| --- | --- | --- |
| Referrer | Owner's current `fullName`, linking to `/users/{referrerUserId}`. | Blank. |
| Referral status | `Not redeemed` or `Redeemed`. | Blank. |

The mobile card for that table shows the same two facts. The user profile always has a Signup referral section: referrer name and link, or None; status Not redeemed, Redeemed, or None.

Filters use the existing list-query grammar (`docs/technical/api/list-queries.md`):

| URL key | Values | Effect |
| --- | --- | --- |
| `filter[referrerId]` | One user id. | Rows whose signup referral has that `referrerUserId`. The referrer themselves is not a row. |
| `filter[referralStatus]` | `not_redeemed` or `redeemed`. | Rows with a signup referral in that state. Users with no signup referral drop out. |

`not_redeemed` means `successfulAt` is null. `redeemed` means `successfulAt` is set. These values are not the account-status filter (`active`, `inactive`, `locked`). The filters combine with each other and with `filter[status]`, `filter[role]`, and `search` as a conjunction. The picker for `referrerId` searches users by name or email and writes the chosen id into the URL. The table's existing matching total is the count. Filtering to A, when B, C, and D registered with A's codes, shows those three rows and a total of 3. People referred by B are absent from that total.

Clearing filters clears these two keys along with the filters the table already clears. Sort stays on `fullName`, `email`, and `createdAt`. Referral status is not a new sort key.

Soft-deleted users stay subject to whatever the admin user query already returns. This ADR does not add a deleted-user policy. If such a row is in the list, its referrer and status still render.

### Job

The job runs once an hour, on the same schedule as the other hourly account jobs. For each non-deleted user it locks that user, then reads that user's code rows inside the lock.

| Latest code inside the lock | Action |
| --- | --- |
| No row | Insert the first code. `expiresAt` is insert time plus 30 days. |
| `now < expiresAt` | Do nothing. |
| `now >= expiresAt` | Insert a successor. Do not modify the expired row. The successor's window starts at the insert. |

A second worker that acquires the lock after the first commit re-reads, sees a fresh code, and does nothing. The unique constraint on `code` is the backstop if two inserts still race.

Between `expiresAt` and the next successful insert, the owner has no valid code. The consumer screen shows the latest code as expired. Signup rejects it with the expired-code error. The gap is at most about an hour while the job is healthy, plus whatever time the job is down.

The job does not mark signup referrals successful. Checkout does that. The job does not send the success notification. The notification retry may share the hourly run, but it only selects rows with `successfulAt` set and `successNotifiedAt` null.

### Authorization and audit

Consumer reads return only the caller's own current code and the caller's own referees. A referee cannot read their signup referral through the consumer API. Admin reads go through the existing admin user endpoints and the existing admin authorization. Referral code values are not added to those payloads.

The code row is the audit record of issuance: the old value remains, and the new value is a new row. Signup that creates a signup referral is the signup HTTP request, which already passes through the global HTTP audit log (ADR 025). Checkout that stamps `successfulAt` is the checkout HTTP request, already audited. The hourly job is not an HTTP request. It writes an audit entry whose actor is the system, naming the owner and the new code row id, without putting the code value into a second store. Operators who need the value read the code row.

### Boundary with reward referrals

The following stay as they are today:

- Reward referral rows, attribution tokens, and `pendingAttributionToken` on the user.
- Referrer rewards, referral pools, and the checkout credit of a reward referral.
- The referrer-credit email and its retry job.
- Merchant reward forms. This slice does not add referral settings there.
- `BLOCKED` on reward referrals. This slice does not write it and does not compare devices or IP addresses.
- The disabled menu entries Invite Friends, My Referrals, Earnings, and Points.

A person can hold a signup referral and a reward referral at the same time. They are different rows. Success of one does not credit or block the other.

## Registration outcomes

Assume A's latest code is `AB23CD45`, unexpired, and A is active and not deleted. The generic taken-email response is abbreviated "generic" below.

| # | Email | Code field | Outcome |
| --- | --- | --- | --- |
| 1 | New | Omitted | User created. Own code created. No signup referral. |
| 2 | New | Whitespace | Same as omitted. |
| 3 | New | `AB23CD45` | User created. Own code created. Signup referral to A. Not redeemed. |
| 4 | New | `ab23cd45` | Same as row 3. Folded to the canonical code. |
| 5 | New | `AB23CD45 ` | Same as row 3. Trimmed. |
| 6 | New | `ZZZZZZZZ` | Unrecognized. No user. |
| 7 | New | A's previous code, still inside its old `expiresAt`, but no longer latest | Expired error. No user. |
| 8 | New | A's latest code, `now >= expiresAt`, successor not inserted yet | Expired error. No user. |
| 9 | New | Latest code of a soft-deleted owner | Unavailable error. No user. |
| 10 | New | Latest code of a deactivated owner | Unavailable error. No user. |
| 11 | New | Latest code of a temporarily locked owner | Same as row 3. |
| 12 | Already registered | Omitted | Generic. No new row. |
| 13 | Already registered | `AB23CD45` | Generic. No signup referral. A's code still valid. |
| 14 | Already registered | `ZZZZZZZZ` | Unrecognized. Generic response is not used. |
| 15 | New | A's code, submitted twice in two signups (B then C) | Two users. Two signup referrals. One code row. |
| 16 | New, via mobile | No field on the form | User created. Own code created. No signup referral. |
| 17 | New, via merchant staff create | No field on the form | User created. Own code created. No signup referral. |

After row 3, B cannot open a settings page and attach C's code. After row 1, that user cannot attach A's code tomorrow.

## Worked example

A registers at `t0` with no code. The signup transaction inserts A and code `K7M2PQ8R` with `expiresAt = t0 + 30 days`.

At `t0 + 1 day`, B registers with `k7m2pq8r`. B's transaction inserts B, B's own first code, and a signup referral (`referrer = A`, `code = K7M2PQ8R`, `successfulAt = null`). C does the same at `t0 + 2 days` with the same code. A second signup referral points at the same code row.

A's Referrals screen shows `K7M2PQ8R`, its expiry, and two rows: C, then B, both Not redeemed. No emails. B's screen shows B's own code and an empty referee list. B's screen does not mention A.

At `t0 + 3 days`, B redeems one reward at checkout. The checkout transaction sets `successfulAt`. After commit, A receives one in-app notification naming B. A's list shows B as Redeemed and C as Not redeemed. B's wallet contains only the reward B redeemed. A receives no claim and no pool debit.

At `t0 + 4 days`, B redeems again. `successfulAt` stays. No second notification.

At `t0 + 10 days`, D registers with A's code. A's list has D, C, and B. An admin opens `/users` and sees a referrer on B, C, and D, and a blank referrer on A. The admin filters `filter[referrerId]` to A. The table lists B, C, and D, and the total is 3. Adding `filter[referralStatus]=not_redeemed` leaves C and D. Adding `redeemed` instead leaves B. Filtering to B lists only people who registered with B's code, not C or D.

At `t0 + 30 days`, `K7M2PQ8R` expires. Until the hourly job runs, A's screen shows that code as expired, and a signup that types it receives the expired error. The job then inserts `H4N8TW2C` with a new 30-day window and leaves `K7M2PQ8R` in place. B, C, and D remain on A's list. A new registrant must use `H4N8TW2C`.

If A is deactivated at `t0 + 5 days`, `K7M2PQ8R` becomes unavailable while it is otherwise unexpired. Reactivating A before `expiresAt` makes that same row valid again. A temporary lock at `t0 + 5 days` leaves the code valid the whole time.

If A is soft-deleted, the job stops issuing successors. Existing code rows remain. Signup rejects them as unavailable. The signup referrals of B, C, and D remain. Admin rows for those referees still name A, subject to the user list's existing treatment of deleted accounts.

## Invariants

1. A user has at most one signup referral as referee.
2. A signup referral's referrer, referee, and code id do not change after insert.
3. `successfulAt`, once set, does not change.
4. `successNotifiedAt` is set only after `successfulAt` is set, and at most once.
5. A code value is globally unique and immutable.
6. At most one code per owner is valid at a time: the latest row, and only while unexpired and the owner is active and not deleted.
7. A successor's `createdAt` is the insert time of the job, not the previous `expiresAt`.
8. Creating a referral code does not create a signup referral.
9. Creating a signup referral does not mark it successful.
10. Marking a signup referral successful does not write a reward referral, a claim, or a pool decrement.
11. The consumer API does not return another user's referees or another user's code.
12. The admin user API does not return code values.
13. Direct referees only: a filter on A does not return referees of A's referees.
14. Taken-email signup does not insert a user, a code, or a signup referral.
15. An invalid code does not insert a user.

## Alternatives

**Update one code in place.** One row per user would make the job a simple overwrite. The previous value would disappear, which removes the audit trail this feature is required to keep.

**One token per friend, carried on a reward link.** That is the reward-referral model already in the schema. It cannot record that B and C both typed A's code at registration, and it ties the relationship to one reward before anyone has signed up.

**Pay the referrer from a referral pool.** Checkout already knows how to do that for reward referrals. The outcome required here is the successful status and the notification, not a second reward in the referrer's wallet.

**Attach a code after registration.** The relationship would no longer be a fact about signup. It could be added after the referee had already redeemed, which makes "successful" depend on when someone typed the code rather than on the account's origin.

**Consume the code on first use.** B would register and C would be rejected, so A could not refer both with the code A was given to pass around. A new code per friend was the reward-link design, and it was set aside.

**Reject codes owned by a temporarily locked user.** A lock is a short security hold. The code is still A's, and people A already told can still be registering. Deactivation and deletion are the states that make the code unavailable.

**Show the referee their referrer.** The consumer product only needs the referrer to see their own list. The admin list is the place an operator looks up the relationship.

**A separate admin page of referrals.** The users table already has filters, a total, and a profile. A second list would be another count to keep in sync.

**A new permission for referral facts.** The facts are attributes of the user record the admin can already open.

## Consequences

- After a code expires, that user has no valid code until the hourly job inserts the next row. The screen shows the latest code as expired during that gap.
- Registration with an unrecognized, expired, or unavailable code is a validation error, including when the email is already registered. A valid or empty code with a taken email still receives the generic signup response and creates nothing.
- Reward referrals, attribution tokens, referrer rewards, and referral pools stay as they are.
- Old code values remain readable on the code row and cannot be issued again.
- Admins who can list users can see who referred whom and whether that person has redeemed. They cannot see the code.
- Referees are not shown their referrer in the consumer app.
- A deactivated user's latest code is rejected until reactivation, provided it has not expired. A locked user's code keeps working.
- Accounts created on mobile or by a merchant can refer others once they have a code, and they themselves have no referrer unless they used the consumer web form.
- Existing accounts receive a first code on the next hourly run after this ships. Until that run, they have nothing to copy on the Referrals screen.
- The success notification can lag the checkout by the retry interval if the first write fails. The status on the screen follows `successfulAt` and does not wait for `successNotifiedAt`.

## Boundaries

`expiresAt` is exclusive. A signup at `now === expiresAt` receives the expired error. A signup at `expiresAt - 1` millisecond is inside the window if the other validity checks pass.

The latest row is the one with the greatest `createdAt`. If two rows share `createdAt`, the greater `id` is later. Validity uses that winner only.

Trim is the Unicode trim of leading and trailing whitespace on the submitted string. Internal spaces are not removed. `AB23 CD45` does not match `AB23CD45`. Case fold applies after trim, and only to letters in the alphabet. Characters outside the alphabet never match an issued code; they are unrecognized, not expired.

An omitted JSON field and a JSON `null` are the same as empty: no signup referral. A client that always sends the key with an empty string is the empty case, not the unrecognized case.

The owner's `isActive` and `isDeleted` are read in the signup transaction, not from a cached profile. A deactivation that commits before the signup transaction starts makes the code unavailable. A deactivation that commits after the signup transaction commits leaves the signup referral in place. The code's later unavailability does not delete B's row and does not clear `successfulAt`.

Reactivation does not extend `expiresAt`. If the code expired while the owner was deactivated, it stays expired. The next hourly run inserts a successor under the usual rule.

A temporary lock that begins or ends during the window does not move `expiresAt` and does not change which row is latest.

## Consumer read

The signed-in user loads one payload for `/rewardhub/referrals`:

| Field | Rule |
| --- | --- |
| `code` | Canonical value of the latest row, or null when the user has no row yet (existing account, job has not run). |
| `expiresAt` | That row's `expiresAt`, or null when `code` is null. |
| `shareable` | True only when a row exists, `now < expiresAt`, and the caller is active and not deleted. The caller is reading their own screen, so this is the same check signup will apply to other people. |
| `referees` | Page of the caller's signup referrals as referrer. |

Each referee item is `fullName`, `createdAt`, and `status` (`not_redeemed` or `redeemed`). The item does not include email, user id, or `referralCodeId`. The UI labels are Not redeemed and Redeemed.

The referee list uses the standard list query: `page`, `limit`, `cursor`, default order `createdAt` descending, tie broken by signup-referral id. There is no search and no status filter on this screen. The referrer sees both statuses in one list.

`code` is null and `shareable` is false for an existing account the job has not yet backfilled. The screen explains that a code is not ready. It does not invent a placeholder code.

A user who is deactivated can still open the screen if they can still authenticate. `shareable` is false while they are deactivated, including when the latest code is inside its window. The expired label is reserved for `now >= expiresAt`. Deactivated and expired are different labels so the owner can tell a ban from a rotation gap.

## Signup field

The consumer signup body gains an optional `referralCode` string. The maximum length accepted by the schema is 8 after trim. A longer value is a validation error (unrecognized is the wrong error: the client did not send a code of the issued shape). A value that is 8 or fewer characters and does not match a row is unrecognized.

Mobile and merchant create-user bodies do not gain `referralCode`. Sending the field on those bodies is ignored only if the schema strips unknown keys. Those schemas are strict today, so the field is not added to them. A mobile client that starts sending it will fail validation until a later ADR adds it. That failure is acceptable: this slice does not accept codes from mobile.

## Error codes

Signup validation errors use the standard error envelope (ADR 016). The code distinguishes the three failures. Copy can change; the codes cannot without a contract change.

| Code | When |
| --- | --- |
| `REFERRAL_CODE_UNRECOGNIZED` | No row matches the folded, trimmed value, or the value is not 8 alphabet characters. |
| `REFERRAL_CODE_EXPIRED` | A row matches and it is not a currently valid code, because it is not the latest or because `now >= expiresAt`. |
| `REFERRAL_CODE_UNAVAILABLE` | The latest row is inside its window and the owner is soft-deleted or deactivated. |

No fourth code for "already referred". That state is unreachable on create. Attempts to patch a user with a code are not a supported route; there is no endpoint for it.

Checkout does not gain a new error when the success stamp loses a race. The redemption succeeds either way. The loser observes `successfulAt` already set and continues the sale.

## Races

| Race | Winner |
| --- | --- |
| Two signups with the same valid code | Both commit. Two signup referrals. One code row. |
| Two signups with the same new email and a valid code | One user. The other receives the generic taken-email response. At most one signup referral. |
| Signup and hourly successor for the same owner | Signup either sees the old latest row and accepts it, or sees the new row and rejects the old value as expired. It never attaches a signup referral to a code that failed the validity check inside its own transaction. |
| Two hourly workers, user has no code | The user lock serializes them. The second sees the first row and inserts nothing. |
| Two hourly workers, latest code expired | Same lock. One successor. |
| Two checkouts redeem the referee at once | One conditional update sets `successfulAt`. The other redemption still commits. One notification is owed. |
| Checkout commit and notification crash | `successfulAt` is set, `successNotifiedAt` is null. The retry pass sends one notification. |
| Referee renamed between stamp and notification | The notification uses the name read at send time. |
| Owner deactivated between code check and user insert | Both happen in one transaction after the validity read, so the signup referral is not inserted if the owner row no longer passes the check at insert time. Re-read the owner inside that transaction. |
| Referee soft-deleted after a signup referral exists | The signup referral remains. The consumer list still has a row. `fullName` is the name still stored on the user. The admin list follows the admin user query, as above. |

The validity re-read and the user insert share the signup transaction. The success stamp and the redemption share the checkout transaction. The notification does not share the checkout transaction, so a notification failure cannot roll the sale back.

## Persistence

Indexes, and nothing beyond them for this slice:

| Index | Purpose |
| --- | --- |
| Unique on referral code `code` | Global single use of each value. |
| `(userId, createdAt)` on referral codes | Latest-code read and the job's scan. |
| Unique on signup referral `refereeUserId` | One referrer per account. |
| `(referrerUserId, createdAt)` on signup referrals | Consumer list and the admin referrer filter. |
| `(successfulAt)` on signup referrals is the wrong index | The retry query is `successfulAt IS NOT NULL AND successNotifiedAt IS NULL`. Index `(successNotifiedAt, successfulAt)` with the null-owed rows in mind, or an equivalent partial index the migration can express. The retry must not scan every historical success. |

Referral code lookup by canonical value uses the unique index. It does not scan by owner.

Soft-deleted code rows remain addressable by `code`. Uniqueness still applies to them. This slice does not soft-delete code rows. The unique index therefore covers all rows.

Row level security follows the owning user. The referrer can read signup referrals where they are `referrerUserId`. The referee has no policy that returns the row to the consumer. Admin user listing continues to use the admin path it already uses. A new table does not get a policy that lets a referee select their referrer.

## Labels

User-facing strings for this slice:

| Surface | String | When |
| --- | --- | --- |
| Signup field | Referral code | Optional input label. |
| Signup | That referral code is not recognized. | `REFERRAL_CODE_UNRECOGNIZED`. |
| Signup | That referral code has expired. | `REFERRAL_CODE_EXPIRED`. |
| Signup | That referral code is unavailable. | `REFERRAL_CODE_UNAVAILABLE`. |
| Referrals screen | Code expired | Latest row exists and `now >= expiresAt`. |
| Referrals screen | Code unavailable | Caller is deactivated or deleted and the code is otherwise inside its window. |
| Referrals screen | Your code is not ready yet. | No code row. |
| Referrals screen | Not redeemed | `successfulAt` is null. |
| Referrals screen | Redeemed | `successfulAt` is set. |
| Referrals screen | No one has registered with your code yet. | Empty referee list. |
| Notification | `{fullName} redeemed a reward. Your referral is successful.` | The one in-app body. `fullName` is the referee at send time. |
| Admin column | Referrer | Header. |
| Admin column | Referral status | Header. |
| Admin profile | None | No signup referral. |
| Admin filter | Referred by | `filter[referrerId]` control. |
| Admin filter | Not redeemed | `filter[referralStatus]=not_redeemed`. |
| Admin filter | Redeemed | `filter[referralStatus]=redeemed`. |

The notification has no email subject because there is no email. The admin account-status labels Active, Inactive, and Locked stay on their own control and are not reused for referral status.

## Non-goals

This slice does not:

- Add a referral code field to mobile signup or to merchant staff creation.
- Let an existing account attach, replace, or remove a referrer.
- Let a referrer withdraw a signup referral or retire a code early.
- Show historical code values on the consumer screen or anywhere in the admin panel.
- Show the referee's email on the consumer referee list.
- Show the referrer to the referee in the consumer app.
- Send an email, a push payload beyond the existing in-app notification store, or a message at registration.
- Pay the referrer, insert a wallet claim, or change a referral pool.
- Create, credit, block, or delete a reward referral.
- Add Invite Friends, My Referrals, Earnings, or a second admin page.
- Add a permission, a role, or a feature flag.
- Cap how many signup referrals one code can accumulate, beyond the existing signup rate limit.
- Detect multi-accounting.
- Treat a temporary lock as deactivation.
- Backdate a successor to the previous `expiresAt`.
- Rewrite `expiresAt` on old rows if the 30-day duration changes later.
- Hash or encrypt `code`.

## Acceptance

The implementation is complete when the following hold.

**Issuance**

- Consumer signup, mobile signup, and merchant staff creation each insert one code row in the same transaction as the user.
- A rolled-back signup leaves no user and no code.
- A user with a code does not receive a second code from the create-user path.
- The hourly job inserts exactly one first code for an existing user who has none.
- The hourly job inserts exactly one successor after `expiresAt`, and the previous row's `code` and `expiresAt` are unchanged.
- Two overlapping job runs for the same user leave one new row, not two.
- The job does not insert a row for a soft-deleted user.
- Generated codes match the 31-character alphabet, length 8, uppercase storage, and the global unique constraint.
- A folded and trimmed input matches the stored code.

**Signup**

- Rows 1 through 17 of the registration table behave as written.
- B and C can both use A's current code.
- The referee cannot add or change a referrer after the account exists.
- A signup referral stores the code row that was actually accepted.

**Success**

- The first committed checkout redemption sets `successfulAt` once.
- A second redemption and a replayed checkout leave `successfulAt` and the notification count unchanged.
- A checkout for a user with no signup referral does not insert one.
- No referrer-reward claim and no pool decrement are produced by this stamp.
- One in-app notification is stored for the referrer, naming the referee, with no email.
- A failed notification write is retried without moving `successfulAt`.

**Consumer screen**

- `/rewardhub/referrals` shows the current code, its expiry, and the referee list described above.
- An expired latest code is visible and not copyable as a live code.
- The list omits email and omits the referee's view of their own referrer.
- The three child menu entries stay disabled.

**Admin**

- The users table and the user profile show the referrer and the referral status, or the empty values specified above.
- `filter[referrerId]` returns direct referees only, and the matching total equals that set.
- `filter[referralStatus]` returns only users in that signup-referral state and combines with the referrer filter.
- Admin payloads do not include `code`.
- No new permission is required beyond the existing user-list and user-detail checks.

**Regression**

- Reward-referral checkout credit, pool decrement, and the referrer-credit email behave as they did before this change.
- The taken-email generic response is unchanged for a valid or omitted code.

## Implementation review (2026-10-09)

The first implementation of this ADR was reviewed for bugs, race conditions and N+1 queries before it shipped. Every finding below was fixed in the same change. Each entry records what was wrong, the code that caused it, and what replaced it, so the same mistakes are recognisable in later features built on this starter kit.

### Critical

#### R1. Checkout never stamped `successfulAt` (RLS)

**Problem.** `POST /redemptions/checkout` runs as the merchant API-key principal (`rls.interceptor.ts` → `apiKeyRlsContext`). `signup_referrals` had only the owner policy, so inside the checkout transaction the referral was invisible: `findFirst` returned null and the stamp silently did nothing. No referral could ever become Redeemed, and no notification could ever be owed. The unit test mocked the service, so it could not catch this. The post-commit `deliverPendingSuccessNotifications(20)` ran under the same principal and read nothing either.

```sql
-- prisma/rls.sql: the only policy on the table
CREATE POLICY signup_referrals_referrer ON public.signup_referrals
  USING (app_owns(referrer_user_id) OR app_rls_bypass())
  WITH CHECK (app_rls_bypass());
```

**Fix.** `prisma/rls/40-api-key-principal.sql` gains `app_api_key_signup_referee_access(referee_user_id)` and two policies. A key may read and update only the signup referral of a customer it has a redemption for at its own store (the redemption row is written earlier in the same checkout transaction). It can never insert or delete one, and never see other referees. The stamp also stopped reading `refereeUser.fullName`: the key may not read `users`, and the name belongs to the notification, read at send time.

```sql
CREATE POLICY signup_referrals_api_key_read ON public.signup_referrals
  FOR SELECT TO app_runtime USING (app_api_key_signup_referee_access(referee_user_id));
CREATE POLICY signup_referrals_api_key_update ON public.signup_referrals
  FOR UPDATE TO app_runtime
  USING (app_api_key_signup_referee_access(referee_user_id))
  WITH CHECK (app_api_key_signup_referee_access(referee_user_id));
```

Covered by `test/api-key-rls-principal.e2e-spec.ts` (the key reads and stamps the redeemed customer's referral, and sees nothing of a user who never redeemed there).

#### R2. Existing accounts never received a code

**Problem.** The hourly job returned early exactly where the ADR says it must insert the first code, and `listUserIdsWithoutCodes` was written but never called. The only other path was a lazy insert inside `GET /auth/signup-referrals/dashboard`. That path runs under the caller's RLS context, where `signup_referral_codes` is `WITH CHECK (app_rls_bypass())`, so the insert was refused and the Referrals screen answered 500 for every account without a code. It was also a write on a GET, and it skipped deactivated users, which the ADR says still receive a code. The superadmin bootstrap created users without a code too.

```ts
// signup-referral.service.ts (maintainReferralCodes)
if (latest === null) {
	return; // ADR: "No row → Insert the first code."
}
```

**Fix.** The job (`maintainReferralCodes`) issues both first codes and successors (see R3). `getDashboard` is a pure read that answers `codeState: "pending"`. `SuperAdminBootstrapRepository.createSuperAdmin` issues the first code on the bootstrap transaction.

### Race conditions

#### R3. Two job runs could insert two successors

**Problem.** `@Cron` fires on every API replica. The job re-read the latest code inside a READ COMMITTED transaction but took no lock, so two replicas could both see the code expired and both insert. The "is there a newer row" check could not see the other transaction's uncommitted insert. The ADR requires "locks that user, then reads that user's code rows inside the lock".

**Fix.** Each user is handled in its own transaction that first takes `SELECT id FROM users WHERE id = $1 FOR UPDATE` (`lockUserForCodeMaintenanceInTx`), then re-reads the state (`findCodeMaintenanceStateInTx`) and inserts only if the latest code is still missing or expired. A second run blocks on the lock, then sees the fresh code and does nothing.

#### R4. Concurrent dashboard loads could insert two first codes

**Problem.** The lazy insert in `ensureFirstCodeForActiveUser` was the same unlocked check-then-insert.

**Fix.** Removed with R2: the dashboard no longer writes.

#### R5. Signup validated the code outside its transaction

**Problem.** `assertReferralCodeForSignup` ran before `prisma.$transaction` and was not repeated inside it. A deactivation, deletion or successor insert that committed in between still produced a signup referral against a code that was no longer valid (ADR, "Races": "Re-read the owner inside that transaction").

**Fix.** The first check stays before the taken-email disguise (so a bad code is never disguised). `attachSignupReferralInTx` then locks the owner with `FOR SHARE` and re-runs the same validity rule on the signup transaction before inserting. Deactivation (an `UPDATE users`) and the job's `FOR UPDATE` both conflict with that lock, so each change is either visible to the signup or waits for it.

```ts
if (accepted.referrerUserId === referee.id || !(await this.repository.lockCodeOwnerForSignupInTx(tx, accepted.referrerUserId))) {
	throw new SignupReferralCodeError("unavailable");
}
const validity = evaluateSignupReferralCode(await this.repository.findCodeForValidation(accepted.canonical, tx), Date.now());
```

The rule itself moved to a pure function, `evaluateSignupReferralCode` (`signup-referral-code.validity.ts`), so the pre-check and the in-transaction check cannot drift.

#### R6. The success notification could be written twice

**Problem.** Delivery read the owed rows, inserted the notification, then set `successNotifiedAt` in a separate statement. Two deliverers (two cron replicas, or cron plus a checkout) both inserted, and only the mark was conditional. That breaks "recorded once".

```ts
await this.prisma.rewardNotification.create({ data: { /* … */ } });
await this.repository.markSuccessNotified(row.id, now); // conditional, but too late
```

**Fix.** `SignupReferralCheckoutService.deliver` claims first, then writes, in one transaction under the new system operation `auth.signup_referrals.notify_success`. The claim is a conditional `updateMany` of `successNotifiedAt` (only where successful and still owed). Only the winner inserts, and a failed insert rolls the claim back so the row stays owed.

#### R7. Concurrent same-email signups answered 500

**Problem.** `existsByEmail` followed by `user.create`: the loser hit the `users_email_key` unique violation and got a 500 instead of the generic response the ADR's race table requires.

**Fix.** `IdentityService.signup` maps exactly a `users_email_key` violation (`isUniqueViolationOf`, moved from `modules/rewards/utils` to `platform/persistence/unique-violation.ts` so auth does not depend on rewards) to the generic response. Any other unique violation still propagates.

#### R8. A code collision aborted the whole signup transaction

Found while fixing R2. **Problem.** `insertCodeInTx` retried on a `P2002` inside the caller's interactive transaction. In Postgres a failed statement aborts the transaction, so the "retry" could only fail ("current transaction is aborted"). A collision would have rolled back the signup.

**Fix.** `issueSignupReferralCode` (`signup-referral-code.issuer.ts`) writes each candidate with `createMany({ skipDuplicates: true })` (`ON CONFLICT DO NOTHING`), so a collision is a zero count and the next candidate is tried on the same, still healthy transaction. It also sets `createdAt` explicitly, so `expiresAt` is exactly `createdAt + 30 days`. Previously `createdAt` came from the database clock and `expiresAt` from the app clock captured before a long loop. After the attempt bound it throws the typed `SignupReferralCodeAllocationError`. The seed uses the same issuer.

### Other bugs

| # | Problem | Fix |
| --- | --- | --- |
| R9 | `createConsumerAccount` (merchant onboarding) created the user, then the role, then the code in a separate transaction: a failed code left a user without one. | User and code are inserted in one transaction; the role is assigned after it, as before. |
| R10 | `referralCode` was added to the shared `SignupSchema`, which mobile also uses, and the API accepted a code from any `X-Client-Type`. | `SignupSchema` is back to email/password/name. `ConsumerWebSignupSchema` adds `referralCode` and is the `POST /auth/signup` contract. The API rejects a non-empty code unless the client type is `web` (or absent, which means web) with `SignupReferralCodeNotAcceptedError`. |
| R11 | A JSON `null` code failed validation, but the ADR says it equals "omitted". | `SignupReferralCodeInputSchema` is `.nullish()` and the normalizer treats `null` as empty. |
| R12 | The job processed at most 10 × 200 users per run from the first id every time, so accounts past the first 2 000 never got a successor. The values 10, 200, 100 and 20 were unexplained, it ran under `maintenance.password_reset_token_cleanup`, and it wrote no audit entry. | It pages to the end with an id keyset over only the users that need a code (R14), runs under its own `maintenance.signup_referral_codes` operation on its own `@Cron`, and writes a system-actor `reward_audit_logs` row (`signup_referral.code_issued`, owner and code row id, never the value) per issued code. |
| R13 | The notification retry read 100 rows per hour, oldest first, so rows that kept failing were retried at the head of every batch and blocked the backlog behind them. | It drains every owed row with a (`successfulAt`, `id`) keyset, so a failing row is logged and stepped past. |
| R14 | Errors used `BadRequestException` with a string `error`, and a non-UUID `filter[referrerId]` was accepted and silently matched nothing. | `SignupReferralCodeError` extends `ValidationError` with the shared `SignupReferralErrorCodeSchema` code and a `referralCode` issue. `filter[referrerId]` is `listFilter.uuid`. |
| R15 | The Referrals screen's badges passed `tone="green"`/`"amber"` and a `label` prop, neither of which `StatusBadge` supports, so they rendered empty, and the screen's types did not check (`toSignupReferralRefereesQuery`, `dashboard` possibly undefined). | Badges use real tones with children. The referee query is parsed through `SignupReferralRefereeListQuerySchema`. The copy control reads a narrowed `shareableCode`. |
| R16 | The seed created codes but no `signup_referrals` rows, skipped deactivated users, and duplicated the retry loop. | `seedSignupReferralCodes` issues through the shared issuer for every non-deleted user. `seedSignupReferralDemo` gives the demo referrer a retired and a current code and three referees: notified, owed (for the retry), and not redeemed. The soft-delete columns of both tables are listed in `coverage-exemptions.ts` with the structural reason above (this slice never soft-deletes either row). |

### N+1 and query cost

| Path | Before | After |
| --- | --- | --- |
| Hourly code job | One transaction and 2–3 queries for every non-deleted user, every hour, even when the code was valid. | `listUserIdsNeedingCode` selects only users with no unexpired code (`signupReferralCodes: { none: { expiresAt: { gt: now } } }`). Every code's `expiresAt` is insert time plus the same TTL, so the latest code has the greatest `expiresAt`, and "none unexpired" is exactly "latest missing or expired". The per-user transaction remains because the lock is per user. |
| POS checkout | `deliverPendingSuccessNotifications(20)` after every sale: up to 40 queries of other users' backlog on the till's response time. | The transaction returns the id it stamped, and only that one notification is delivered after commit (`deliverAfterCheckout`). The backlog belongs to the hourly retry. |
| Code validation | Three sequential reads (code row, owner's latest code, owner). | One `findUnique` on the unique `code` index, selecting the owner's state and latest code id (`findCodeForValidation`). |
| Dashboard | Up to two reads of the latest code plus the lazy insert. | Two reads in parallel, no write. |
| Admin user list and profile | Already one batched read per page. | Unchanged in cost; moved into `SignupReferralRepository.findAdminSummariesForReferees`. |
| Referee list | Already one batched name read per page. | Unchanged. |

### Spec gaps closed

- The admin "Referred by" control for `filter[referrerId]` (`apps/admin/app/(panel)/users/referrer-picker.tsx`): a server-searched picker on the existing `SearchableEntityPicker`, labelled from `GET /auth/admin/users/:id` when the id comes from a shared URL.
- The users table's mobile card shows Referrer and Referral status. The profile links the referrer to `/users/{id}`. Labels come from one `SIGNUP_REFERRAL_STATUS_LABELS` table.
- The Referrals screen uses this ADR's labels: "Your code is not ready yet.", a "Code expired" badge with "Expired …" in place of "Valid until …", "Code unavailable", and "No one has registered with your code yet.".
- The success notification's metadata carries `href: SIGNUP_REFERRALS_SCREEN_PATH` (`/rewardhub/referrals`), the link the ADR asks for.

### Note on lint memory

One of the new unit specs passed a six-delegate `Object.assign(new PrismaService(…), fakes)` intersection straight into `Prisma.TransactionClient` parameters. The type checker re-compared every overridden delegate at each call, which pushed the API's typed lint past the default Node heap. Typing the fake once as `PrismaService` (`const prisma: PrismaService = Object.assign(…)`) restores the fast subtype path. Prefer that form for Prisma fakes in specs.
