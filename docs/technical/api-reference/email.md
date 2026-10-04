---
title: "API reference — Email log, templates and delivery webhooks"
description: "The outbound email log, template previews and test sends, and the Resend delivery webhook."
order: 9
author: "Generated from the OpenAPI export"
lastUpdated: 1791072000000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm docs:api -->

# API reference — Email log, templates and delivery webhooks

The outbound email log, template previews and test sends, and the Resend delivery webhook.

How these endpoints fit together: [Email (Resend) guide](../email/resend-setup.md). Conventions shared by every endpoint (envelope, auth, errors, pagination): [API reference overview](./README.md).

## Email Log

### GET /api/v1/notifications/email-log

List sent emails

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:EMAIL`.
- Operation id `EmailLogController_list` · [source](../../../apps/api/src/modules/notifications/email/email-log.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt, subject, to, status. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: status, templateKey, createdAt |
| `search` | query | string | no | Case-insensitive free-text search over the resource's search columns |

**Response 200 OK** — Paginated EmailLog rows; pagination is in `meta`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].createdAt` | integer | yes |  |
| `data[].error` | string \| null | no |  |
| `data[].id` | string | yes | at least 1 characters |
| `data[].resendId` | string \| null | no |  |
| `data[].status` | "pending" \| "sent" \| "delivered" \| "bounced" \| "complained" \| "failed" | yes |  |
| `data[].subject` | string | yes | at least 1 characters |
| `data[].templateKey` | "verification" \| "password-reset" \| "password-changed" \| "account-locked" \| "welcome" \| "security-alert" \| "two-factor-enabled" \| "two-factor-disabled" \| "admin-alert" \| "api-key-created" \| … (+5 more) | yes |  |
| `data[].to` | string | yes | at least 1 characters |
| `data[].updatedAt` | integer | yes |  |
| `meta.hasNext` | boolean | yes | Whether a next page exists |
| `meta.hasPrevious` | boolean | yes | Whether a previous page exists |
| `meta.limit` | integer | yes | Items per page; range 1–100 |
| `meta.nextCursor` | string \| null | yes | Opaque cursor for the next page, or null when there are no more rows |
| `meta.page` | integer | yes | Current page (1-indexed); min 1 |
| `meta.total` | integer | yes | Total rows matching the current filters |
| `meta.totalPages` | integer | yes | Total pages for the current filters and page size; min 1 |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/notifications/email-log?limit=2
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "id": "65e16aed-4d6d-4295-97bc-54b81a475779",
      "templateKey": "admin-alert",
      "to": "patelzz007@gmail.com",
      "subject": "[Admin] MFA Recovery Denied",
      "status": "sent",
      "createdAt": 1791099722455,
      "updatedAt": 1791099722455
    },
    {
      "id": "82eec831-f4f0-4c92-94e2-1a9caff9e72f",
      "templateKey": "admin-alert",
      "to": "patelzz007@gmail.com",
      "subject": "[Admin] MFA Recovery Review Required",
      "status": "sent",
      "createdAt": 1791099722371,
      "updatedAt": 1791099722371
    }
  ],
  "meta": {
    "limit": 2,
    "total": 16,
    "page": 1,
    "totalPages": 8,
    "nextCursor": "eyJhdCI6MTc5MTA5OTcyMjM3MSwiaWQiOiI4MmVlYzgzMS1mNGYwLTRjOTItOTRlMi0xYTljYWZmOWU3MmYifQ",
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "IO6aUDL1Mvtm1VCPPv8a7",
    "timestamp": 1791099725971
  }
}
```

### GET /api/v1/notifications/email-log/events

Live EmailLog update stream (SSE)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:EMAIL`.
- Operation id `EmailLogController_stream` · [source](../../../apps/api/src/modules/notifications/email/email-log.controller.ts)

**Response 200 OK** — text/event-stream; one `{ updatedAt }` frame per EmailLog write (pass-through: no envelope, no response contract)

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!NOTE]
> No captured sample: Server-Sent Events stream (text/event-stream) that stays open; each event carries one changed email-log row in the shape of GET /notifications/email-log items.

## Email Templates

### GET /api/v1/notifications/email-preview

List email template metadata

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:EMAIL`.
- Operation id `EmailPreviewController_list` · [source](../../../apps/api/src/modules/notifications/email/email-preview.controller.ts)

**Response 200 OK** — Metadata for every registered email template

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.templates` | object[] | yes |  |
| `data.templates[].description` | string | yes | at least 1 characters |
| `data.templates[].key` | "verification" \| "password-reset" \| "password-changed" \| "account-locked" \| "welcome" \| "security-alert" \| "two-factor-enabled" \| "two-factor-disabled" \| "admin-alert" \| "api-key-created" \| … (+5 more) | yes |  |
| `data.templates[].label` | string | yes | at least 1 characters |
| `data.templates[].sampleTo` | string (email) | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/notifications/email-preview
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "key": "verification",
        "label": "Email Verification",
        "description": "Sent after signup to prove the user owns the inbox.",
        "sampleTo": "jamie@example.com"
      },
      {
        "key": "password-reset",
        "label": "Password Reset",
        "description": "Sent when a user requests a password reset.",
        "sampleTo": "jamie@example.com"
      }
    ]
  },
  "meta": {
    "correlationId": "4yFRuy4GDAYKNdWL-T9nv",
    "timestamp": 1791099725979
  }
}
```

### GET /api/v1/notifications/email-preview/{key}

Render one email template preview

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:EMAIL`.
- Operation id `EmailPreviewController_detail` · [source](../../../apps/api/src/modules/notifications/email/email-preview.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `key` | path | "verification" \| "password-reset" \| "password-changed" \| "account-locked" \| "welcome" \| "security-alert" \| "two-factor-enabled" \| "two-factor-disabled" \| "admin-alert" \| "api-key-created" \| … (+5 more) | yes |  |

**Response 200 OK** — Rendered preview for one template

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.description` | string | yes | at least 1 characters |
| `data.html` | string | yes | at least 1 characters |
| `data.key` | "verification" \| "password-reset" \| "password-changed" \| "account-locked" \| "welcome" \| "security-alert" \| "two-factor-enabled" \| "two-factor-disabled" \| "admin-alert" \| "api-key-created" \| … (+5 more) | yes |  |
| `data.label` | string | yes | at least 1 characters |
| `data.previewText` | string | yes | at least 1 characters |
| `data.props` | object | yes |  |
| `data.subject` | string | yes | at least 1 characters |
| `data.text` | string | yes | at least 1 characters |
| `data.to` | string (email) | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 404 | — | Unknown template key |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/notifications/email-preview/verification
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "key": "verification",
    "label": "Email Verification",
    "description": "Sent after signup to prove the user owns the inbox.",
    "subject": "Verify your email address",
    "to": "jamie@example.com",
    "previewText": "Confirm your NestJS + NextJS Turborepo Starter Template email and you're all set.",
    "html": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <meta name=\"color-scheme\" content=\"light dark\">\n  <meta name=\"supported-color-schemes\" content=\"light dark\">\n  <meta name=\"x-apple-disable-message-reformatting\">\n  <title>Verify your email address</title>\n  <style>\n    @media (max-width: 620px) {\n      .email-card-inner { padding: 28px 22px 24px 22px !important; }\n      .email-h1 { font-size: 22px !important; }\n    }\n    @media (prefers-color-scheme: dark) {\n      .email-body, .email-canvas { background-color: #091018 !important; }\n      .email-card { background-color: #0f1923 !important; border-color: #1f2c3b !important; }\n      .email-heading, .email-h1, .email-brand-name { color: #edf2f8 !important; }\n      .email-text { color: #c7d2de !important; }\n      .email-muted, .email-footer { color: #97a7b7 !important; }\n      .email-panel, .email-otp-tile { background-color: #16212d !important; border-color: #1f2c3b !important; color: #edf2f8 !important; }\n      .email-rule { border-top-color: #1f2c3b !important; }\n      .email-link { color: #6594fa !important; }\n    }\n  </style>\n</head>\n<body class=\"email-body\" style=\"margin: 0; padding: 0; background-color: #f3f6fb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;\">\n  <span style=\"display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; overflow: hidden; mso-hide: all;\">Confirm your NestJS + NextJS Turborepo Starter Template email and you&#39;re all set.</span>\n  <table role=\"presentation\" class=\"email-canvas\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" bgcolor=\"#f3f6fb\" style=\"width: 100%; background-color: #f3f6fb;\">\n    <tr>\n      <td align=\"center\" style=\"padding: 32px 12px 40px 12px;\">\n        <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width: 600px; margin: 0 auto;\">\n          <tr>\n            <td style=\"padding: 0 4px 18px 4px;\">\n              <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\">\n                <tr>\n                  <td align=\"center\" style=\"width: 34px; height: 34px; border-radius: 9px; background: #2d5ed4; color: #ffffff; font-size: 17px; font-weight: 700; line-height: 34px; text-align: center;\">N</td>\n                  <td class=\"email-brand-name\" style=\"padding-left: 10px; color: #0f172a; font-size: 17px; font-weight: 700; letter-spacing: -0.01em;\">NestJS + NextJS Turborepo Starter Template</td>\n                </tr>\n              </table>\n            </td>\n          </tr>\n          <tr>\n            <td class=\"email-card\" style=\"background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;\">\n              <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">\n                <tr><td style=\"height: 4px; line-height: 4px; font-size: 0; background: #16a34a;\">&nbsp;</td></tr>\n                <tr>\n                  <td class=\"email-card-inner\" style=\"padding: 36px 40px 32px 40px;\">\n                    <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin: 0 0 14px 0;\">\n                      <tr><td style=\"background: #effaf3; border-radius: 999px; padding: 5px 12px; color: #166534; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;\">Email Verification</td></tr>\n                    </table>\n                    <h1 class=\"email-h1\" style=\"margin: 0 0 18px 0; color: #0f172a; font-size: 26px; font-weight: 700; line-height: 1.25; letter-spacing: -0.015em;\">Thanks for joining!</h1>\n                    <p class=\"email-text\" style=\"margin: 0 0 16px 0; color: #334155; font-size: 15px; line-height: 1.65;\">Welcome to <strong style=\"color: #0f172a;\" class=\"email-heading\">NestJS + NextJS Turborepo Starter Template</strong>! Confirm your email address so we know it's really you — one click and your account is ready.</p>\n        <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin: 8px 0 24px 0;\">\n          <tr>\n            <td class=\"email-cta\" style=\"background: #2d5ed4; border-radius: 10px;\">\n              <a href=\"http://localhost:3000/auth/verify-email?token=<redacted>\" style=\"display: inline-block; padding: 14px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 10px;\">Verify email &rarr;</a>\n            </td>\n          </tr>\n        </table>\n        <p class=\"email-muted\" style=\"margin: 0 0 6px 0; color: #64748b; font-size: 12px; line-height: 1.5;\">Button not working? Paste this link into your browser:</p>\n        <p class=\"email-panel\" style=\"margin: 0 0 20px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; line-height: 1.5; color: #334155; word-break: break-all;\">http://localhost:3000/auth/verify-email?token=<redacted> class=\"email-muted\" style=\"margin: 0 0 8px 0; color: #64748b; font-size: 13px; line-height: 1.6;\">This link expires in <strong style=\"color: #0f172a;\" class=\"email-heading\">24 hours</strong>. Didn't create an account? You can safely ignore this email.</p>\n                    \n                    <hr class=\"email-rule\" style=\"border: none; border-top: 1px solid #e2e8f0; margin: 8px 0 18px 0;\">\n                    <p class=\"email-muted\" style=\"margin: 0; color: #64748b; font-size: 12px; line-height: 1.6;\">Sent by NestJS + NextJS Turborepo Starter Template · <a href=\"http://localhost:3000\" style=\"color: #64748b; text-decoration: underline;\">localhost:3000</a></p>\n                  </td>\n                </tr>\n              </table>\n            </td>\n          </tr>\n          <tr>\n            <td class=\"email-footer\" align=\"center\" style=\"padding: 20px 16px 0 16px; color: #94a3b8; font-size: 12px; line-height: 1.6; text-align: center;\">\n              <p style=\"margin: 0;\">You're receiving this because you have an account with NestJS + NextJS Turborepo Starter Template.</p>\n              <p class=\"email-muted\" style=\"margin: 4px 0 0 0;\">Questions? Reach us at <a href=\"mailto:noreply@bishenpatel.com\" style=\"color: #64748b; text-decoration: underline;\">noreply@bishenpatel.com</a></p>\n              <p style=\"margin: 4px 0 0 0;\">&copy; 2026 NestJS + NextJS Turborepo Starter Template. All rights reserved.</p>\n            </td>\n          </tr>\n        </table>\n      </td>\n    </tr>\n  </table>\n</body>\n</html>",
    "text": "NestJS + NextJS Turborepo Starter Template — Email Verification\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nThanks for joining!\n\nWelcome to NestJS + NextJS Turborepo Starter Template!\n\nPlease confirm your email address by opening the link below:\nhttp://localhost:3000/auth/verify-email?token=<redacted>\n\nThis link expires in 24 hours.\nIf you didn't create an account, you can safely ignore this email.\n\nAction: Verify email\n\nhttp://localhost:3000/auth/verify-email?token=<redacted>\n\nQuestions? noreply@bishenpatel.com\n\n© 2026 NestJS + NextJS Turborepo Starter Template. All rights reserved.",
    "props": {
      "to": "jamie@example.com",
      "verificationToken": "demo-verify-token-2026",
      "expiresInHours": 24
    }
  },
  "meta": {
    "correlationId": "_b5IGsyYHoOlKVVjLKoA4",
    "timestamp": 1791099725994
  }
}
```

### POST /api/v1/notifications/email-preview/{key}/send

Send one email template (sample props)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `CREATE:EMAIL`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `EmailPreviewController_sendTest` · [source](../../../apps/api/src/modules/notifications/email/email-preview.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `key` | path | "verification" \| "password-reset" \| "password-changed" \| "account-locked" \| "welcome" \| "security-alert" \| "two-factor-enabled" \| "two-factor-disabled" \| "admin-alert" \| "api-key-created" \| … (+5 more) | yes |  |

**Response 201 Created** — Outcome of the send attempt

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.⟨shape 1⟩ id` | string | yes |  |
| `data.⟨shape 1⟩ mode` | "send" \| "log-only" \| "noop" \| "queued" | yes |  |
| `data.⟨shape 1⟩ ok` | true | yes |  |
| `data.⟨shape 2⟩ detail` | string | no |  |
| `data.⟨shape 2⟩ ok` | false | yes |  |
| `data.⟨shape 2⟩ reason` | "invalid-props" \| "config" \| "timeout" \| "rate-limited" \| "api-error" \| "persistence" \| "queue" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 404 | — | Unknown template key |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/notifications/email-preview/verification/send
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "ok": true,
    "id": "43dab28a-194d-4b82-86d9-5d1a0f8c9652",
    "mode": "log-only"
  },
  "meta": {
    "correlationId": "y1grSBOZ4rR0bhLYhCzmN",
    "timestamp": 1791099726011
  }
}
```

## Email Webhook

### GET /notifications/email-webhook

Webhook endpoint info (GET is not the delivery path)

- **Public** — no session required.
- Operation id `EmailWebhookController_info` · [source](../../../apps/api/src/modules/notifications/email/email-webhook.controller.ts)

**Response 200 OK** — Explains the endpoint

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes |  |
| `data.method` | "POST" | yes |  |
| `data.ok` | true | yes |  |
| `data.path` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as no session.

```http
GET /notifications/email-webhook
X-Client-Type: web
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "ok": true,
    "message": "This is Resend's delivery webhook. Resend POSTs signed events here; a browser GET is not the delivery path.",
    "method": "POST",
    "path": "/notifications/email-webhook"
  },
  "meta": {
    "correlationId": "NwxhLtd-y6JsswZsmubM2",
    "timestamp": 1791099726020
  }
}
```

### POST /notifications/email-webhook

Resend delivery webhook (signature-verified)

Receives delivery events from Resend and updates EmailLog. Only accepts requests signed by Resend (standard-webhooks scheme). Swagger's "Try it out" sends no signature, so it will always get 403 Missing webhook signature headers — that is the security boundary working. To test manually: run `pnpm --filter @workspace/api exec tsx scripts/test-webhook-signature.ts` and copy the printed header values + body into this form. Two gotchas: (1) the body must match EXACTLY — the signature covers the raw bytes, and Swagger's pretty-printed example will NOT match; (2) the values expire after 5 minutes, so paste fast or re-run the script.

- **Public** — no session required.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `EmailWebhookController_receive` · [source](../../../apps/api/src/modules/notifications/email/email-webhook.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `webhook-signature` | header | string | yes | v1,<base64 HMAC-SHA256> over `<id>.<timestamp>.<rawBody>` using the webhook signing secret — or `svix-signature` |
| `webhook-timestamp` | header | string | yes | Unix seconds when Resend signed the payload — or `svix-timestamp` |
| `webhook-id` | header | string | yes | Unique webhook message id — or `svix-id` (Resend delivers via Svix and may use the `svix-*` names); both schemes are accepted |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `created_at` | string (date-time) | yes |  |
| `data` | object | yes |  |
| `data.bounce` | object | no |  |
| `data.bounce.bounce_type` | string | no |  |
| `data.bounce.complaint_type` | string | no |  |
| `data.bounce.message` | string | no |  |
| `data.bounce.reason` | string | no |  |
| `data.bounce.subType` | string | no |  |
| `data.bounce.type` | string | no |  |
| `data.complaint` | object | no |  |
| `data.complaint.bounce_type` | string | no |  |
| `data.complaint.complaint_type` | string | no |  |
| `data.complaint.message` | string | no |  |
| `data.complaint.reason` | string | no |  |
| `data.complaint.subType` | string | no |  |
| `data.complaint.type` | string | no |  |
| `data.email_id` | string | yes | at least 1 characters |
| `data.tags` | object | no |  |
| `type` | "email.sent" \| "email.delivered" \| "email.bounced" \| "email.complained" \| "email.failed" \| "email.delivery_delayed" \| "email.opened" \| "email.clicked" \| "email.forwarded" | yes |  |

**Response 200 OK** — Webhook accepted

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.received` | true | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as Resend (signed delivery webhook).

```http
POST /notifications/email-webhook
svix-id: msg_5925f4b7ef894279a73431b4da0082c1
svix-timestamp: 1791099726
svix-signature: v1,<redacted: HMAC of the body with RESEND_WEBHOOK_SECRET>
Content-Type: application/json

{
  "type": "email.delivered",
  "created_at": "2026-10-04T07:42:06.034Z",
  "data": {
    "email_id": "seed",
    "to": [
      "patelzz007@gmail.com"
    ]
  }
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "received": true
  },
  "meta": {
    "correlationId": "BgU_xgMlr9I4SfEcP6yg-",
    "timestamp": 1791099726049
  }
}
```
