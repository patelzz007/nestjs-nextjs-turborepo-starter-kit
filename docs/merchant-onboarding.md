---
title: "Merchant Onboarding"
tags: ["merchant", "onboarding", "kyb", "files"]
description: "How invite-based merchant onboarding collects one complete application for admin review."
author: "Backend Team"
lastUpdated: 1773000000000
coverImage: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&h=630&fit=crop"
---

# Merchant onboarding

Merchant owners complete account setup and business verification in one visit to `/onboarding?token=...`. They do not need to re-enter the initial application at `/settings/verification`.

## Merchant flow

1. **Business:** choose a category and enter the registered legal name, address, and contact phone.
2. **Registration:** enter the SSM/registration number, tax ID, and primary document type.
3. **Documents:** upload at least one supported registration document.
4. **Owner account:** enter the owner's name and create or confirm the account password.
5. **Submit:** the merchant organization is provisioned, documents are uploaded, and the application enters the admin review queue with `kybStatus = PENDING`.

`/settings/verification` remains available after onboarding for reviewing the submitted application and responding to an admin rejection or action-required request. It is not a second initial onboarding form.

## Why document upload uses three API calls

KYB files are private and use the normal direct-upload pipeline. A `MerchantOrg` and owner `User` must exist before a file can be bound to them.

The browser therefore performs this sequence after the merchant presses **Submit for review**:

1. `POST /orgs/onboarding/complete` — one transaction: claims the PENDING, unexpired invite (compare-and-set, so exactly one request wins), creates the owner membership, saves the merchant profile and stores, activates the organization and writes the audit row. Any failure rolls everything back and leaves the invite PENDING. The owner account itself is created (or the existing account's password verified) just before that transaction; that step is idempotent.
2. `POST /orgs/onboarding/documents/upload-url(s)` creates upload tickets for the organization's KYB evidence.
3. The browser sends the file directly to the configured object-storage provider.
4. `POST /orgs/onboarding/documents/upload-complete(-batch)` verifies size, SHA-256 and file type and starts the malware scan (the file is `SCANNING`).
5. `POST /orgs/onboarding/documents/submit` attaches the files to the merchant application and **consumes the invite token**.

After acceptance, the invite token is a narrow, short-lived credential: it only works for the document endpoints, only for `ONBOARDING_DOCUMENTS_WINDOW_MS` (24 hours) after acceptance, only until the submission consumed it, and only for this organization's KYB uploads. Outside that window the endpoints answer `410 MERCHANT_ONBOARDING_DOCUMENTS_CLOSED`; the merchant signs in and uses `/settings/verification` (`merchant:manage_verification`). A submission is also refused (`409 KYB_REVIEW_CLOSED`) once the review is `APPROVED` or `REJECTED`.

## Retry behavior

- `complete` is all-or-nothing. If it failed, pressing submit again retries it with the same credentials.
- If `complete` already succeeded, a repeated `complete` answers `409 MERCHANT_INVITE_UNAVAILABLE` — the client continues with the document steps (still within the window) instead of calling `complete` again.
- An expired invite answers `410 MERCHANT_INVITE_EXPIRED`.
- A repeated `submit` answers `410` (the token was consumed by the first one).

## Admin review

Admins continue reviewing merchants through the existing rewards-admin merchant detail and KYB controls. Each document shows its scan status: `SCANNING`, `CLEAN`, `NOT_SCANNED` (no malware scanner configured — downloadable, but not malware-checked), `INFECTED` or `SCAN_FAILED`. When a verdict lands after submission, the review status follows it automatically: `INFECTED` or `SCAN_FAILED` evidence moves a pending review to `ACTION_REQUIRED`, and once every document is usable again it returns to `PENDING`. Approved or rejected reviews are never changed by a scan.
