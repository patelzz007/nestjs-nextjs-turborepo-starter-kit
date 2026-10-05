---
title: "Email templates and pipeline"
description: "How transactional email is rendered, sent, queued, logged and tracked; the template catalog; how to add a template."
order: 46
author: "Platform Team"
lastUpdated: 1791072000000
coverImage: "https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=1200&h=630&fit=crop"
tags: ["email", "templates", "notifications"]
---

# Email templates and pipeline

Code: `apps/api/src/modules/notifications/email/`. Provider setup: [Set up email with Resend](./resend-setup.md).

## Pipeline

```mermaid
flowchart TD
    A[Feature service<br/>e.g. auth, invites, claims] -->|new XxxEmailTemplate props| B[EmailSenderService.send]
    B --> C[re-validate props with zod]
    C --> D[effective recipient<br/>EMAIL_TEST_TO overrides in dev]
    D --> E{EMAIL_MODE}
    E -- noop / log-only --> F[log only, email_logs row]
    E -- send --> G{Redis configured?}
    G -- yes --> H[BullMQ email.send job<br/>jobId = email log id]
    G -- no --> I[send inline]
    H & I --> J[Resend API<br/>retries with backoff, timeout,<br/>per-recipient rate limit]
    J --> K[email_logs: sent]
    L[Resend webhook] -->|delivered / bounced / complained / failed| K
    K -.SSE.-> M[Admin: Emails → Log, live]
```

- `send()` **never throws**: it returns `{ ok: true, id }` or `{ ok: false, reason, detail }`, so a
  Resend outage can never break a signup or login. Callers decide what to tell the user.
- Every attempt is an `email_logs` row (recipient masked in logs). The admin log page receives
  changes over Server-Sent Events (`GET /api/v1/notifications/email-log/events`).
- With BullMQ the job id is the email log id, so the same attempt is never enqueued twice.

## Templates

Each template is a class extending `BaseEmailTemplate` with a `key`, a subject, a zod props schema,
and `renderBodyHtml()` / `renderBodyText()` — every email has a plain-text twin. The
`EmailTemplateRegistry` lists them with sample props for the admin preview.

| Key | Sent when |
| --- | --- |
| `welcome` | Account created |
| `verification` | Email verification (signup, resend) |
| `login-verification` | New-device sign-in code (`LOGIN_VERIFICATION_MODE`) |
| `password-reset` / `password-changed` | Reset requested / password changed |
| `account-locked` | Too many failed sign-ins |
| `two-factor-enabled` / `two-factor-disabled` | 2FA switched on / removed (e.g. after MFA recovery) |
| `security-alert` | Security-relevant account events |
| `api-key-created` | An API key was created |
| `admin-alert` | Operational alerts to administrators |
| `merchant-invite` | Platform admin invites a merchant (onboarding link) |
| `team-member-invite` | Merchant invites a team member |
| `reward-claim-otp` | One-time code for claiming a reward |
| `referrer-reward-credited` | A referral earned the referrer a reward (retried by the `rewards.referral-credit-notify` job) |

`pnpm --filter @workspace/api exec tsx scripts/render-email-previews.ts` re-renders the screenshots
below (headless Chrome, light mode):

| | | |
| --- | --- | --- |
| ![Welcome](../../images/email/welcome.png) | ![Verification](../../images/email/verification.png) | ![Login verification](../../images/email/login-verification.png) |
| ![Password reset](../../images/email/password-reset.png) | ![Account locked](../../images/email/account-locked.png) | ![Security alert](../../images/email/security-alert.png) |
| ![API key created](../../images/email/api-key-created.png) | ![Team member invite](../../images/email/team-member-invite.png) | ![Admin alert](../../images/email/admin-alert.png) |

## Design: one shell, one set of building blocks

Every email renders through `BaseEmailTemplate` (`base/base-email-template.ts`), so templates only
supply content:

- **Shell:** brand row above a 600 px card, a 4 px accent bar in the template's tone, an eyebrow
  pill, the heading, the body and a footer. Table layout with inline styles for every mail client;
  a `prefers-color-scheme: dark` block and a ≤ 620 px mobile block override them.
- **Tokens:** `EMAIL_THEME` mirrors the web brand theme (`apps/web/app/web-theme.css`) as hex —
  mail clients support neither `oklch()` nor CSS variables. **Change both together.**
- **Tone:** each template sets `accent`, which picks a palette in `ACCENT_PALETTES`: `indigo`
  (brand: account, product), `green` (success), `amber` (a security change worth a look), `red`
  (danger), `sky` (codes, invites). The call-to-action button is always the brand colour.
- **Building blocks** — compose bodies from these protected helpers instead of hand-written inline
  styles; each escapes its own values:

  | Block | Use for |
  | --- | --- |
  | `paragraph(html)`, `note(html)` | Body copy and small muted notes; interpolate data only via `strong()`, `link()` or `escape()` |
  | `detailsCard(rows)` | Label / value facts (device, location, role, expiry) |
  | `highlight(title, subtitle?)` | The one thing the reader must notice |
  | `callout(title, body)` | Guidance in the tone's colour ("Wasn't you?") |
  | `steps(items)` | A numbered how-to |
  | `otpCodeBlock(code)` | One-time codes, one tile per character |
  | `ctaInBody(context)` with `ctaPlacement = "in-body"` | The button mid-body; otherwise the shell renders `getCta()` after the body |
  | `linkBlock(href)` | The "button not working?" raw-link fallback |

Open and click tracking is deliberately **not** used: no tracking pixel, no engagement columns. The
webhook acknowledges `email.opened` / `email.clicked` events and ignores them.

## Adding a template

1. Add the key to `EmailTemplateKeySchema` in `packages/shared`.
2. Create `templates/<name>-email.template.ts` extending `BaseEmailTemplate` with a strict zod
   props schema; never put secrets other than the intended one-time link/code in the body.
3. Register it in `email-template.registry.ts` (label, description, class, props schema). The
   registry drives both the admin preview and `email-template.factory.ts`, which rebuilds queued jobs.
4. Send it from the owning service with `EmailSenderService.send(new XxxEmailTemplate(props))` and
   handle the result.
5. Test the rendering (HTML + text) and the call site; preview it in **Emails → Templates**.

## Related

[Email API reference](../api-reference/email.md) · [Messaging and jobs](../messaging.md)
