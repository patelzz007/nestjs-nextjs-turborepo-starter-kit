---
title: "Merchant Onboarding"
tags: ["merchant", "onboarding", "kyb", "files"]
description: "How invite-based merchant onboarding collects one complete application for admin review."
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

1. `POST /merchant/onboarding/complete` creates or resumes the owner and organization while saving all text fields.
2. `POST /merchant/onboarding/documents/upload-url` creates an invite-authorized upload ticket.
3. The browser sends the file directly to the configured object-storage provider.
4. `POST /merchant/onboarding/documents/upload-complete` verifies the stored object and checksum.
5. `POST /merchant/onboarding/documents/submit` attaches all completed files to the merchant application.

This is still one user-facing submission. The invite token authorizes only the merchant organization created from that invite, and file IDs are checked for the correct category and tenant before attachment.

## Retry behavior

The completion operation is resumable. If a network or storage failure occurs after the account is created, pressing submit again authenticates the same owner credentials, updates the same merchant application, and retries document upload instead of creating a duplicate organization.

## Admin review

Admins continue reviewing merchants through the existing rewards-admin merchant detail and KYB controls. Uploaded documents may initially show `SCANNING`; infected or failed files move the application to `ACTION_REQUIRED`.
