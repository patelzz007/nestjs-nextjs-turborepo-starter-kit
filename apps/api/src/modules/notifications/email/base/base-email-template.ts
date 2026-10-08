import { type BaseEmailProps, type CtaConfig, type EmailAccent, type ZodType } from "@workspace/shared";

import type { EmailRenderContext } from "./email-render-context";

export type { BaseEmailProps, CtaConfig, EmailAccent };

// ── Email design tokens ──────────────────────────────────────────────────
// Mail clients do not support `oklch()` or CSS variables, so the brand theme
// (apps/web/app/web-theme.css) is mirrored here as hex. Change both together.

/** Dark-mode colour overrides (applied via `prefers-color-scheme`). */
export interface EmailDarkTheme {
	readonly canvas: string;
	readonly card: string;
	/** Hairline between rows (details ledger). */
	readonly divider: string;
	readonly heading: string;
	readonly text: string;
	readonly muted: string;
	readonly panel: string;
}

/** The shared email design tokens. */
export interface EmailTheme {
	readonly brand: string;
	readonly brandOnDark: string;
	readonly canvas: string;
	readonly card: string;
	/** Hairline between rows (details ledger) — the only line inside the card. */
	readonly divider: string;
	readonly heading: string;
	readonly text: string;
	readonly muted: string;
	readonly subtle: string;
	readonly panel: string;
	readonly dark: EmailDarkTheme;
	readonly fontStack: string;
	readonly monoStack: string;
	readonly maxWidthPx: number;
}

/** The shared email theme — every template renders through these values. */
export const EMAIL_THEME: EmailTheme = {
	/** Brand primary (web `--primary`, oklch 0.52 0.19 264). */
	brand: "#2d5ed4",
	/** Brand primary on dark backgrounds (web dark `--primary`). */
	brandOnDark: "#6594fa",
	/** Page background behind the card — the apps' light canvas (`--palette-neutral-50`). */
	canvas: "#f1f4f9",
	card: "#ffffff",
	divider: "#e6eaf0",
	heading: "#0f172a",
	text: "#334155",
	muted: "#64748b",
	subtle: "#94a3b8",
	/** Soft panel background (details ledger, link fallback, code tiles) — the apps' sidebar step (`--palette-neutral-40`). */
	panel: "#f5f7fb",
	/** Dark-mode equivalents (applied via `prefers-color-scheme`). */
	dark: {
		canvas: "#091018",
		card: "#0f1923",
		divider: "#1f2c3b",
		heading: "#edf2f8",
		text: "#c7d2de",
		muted: "#97a7b7",
		panel: "#16212d",
	},
	fontStack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
	monoStack: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
	/** Card width — the de-facto standard for email (fits every client's reading pane). */
	maxWidthPx: 600,
};

/**
 * Colors used by the shell and building blocks for one accent (tone). Tone is carried by
 * colour and fill only — never by bars, stripes or borders.
 */
export interface AccentPalette {
	/** The tone dot beside the eyebrow. */
	readonly solid: string;
	/** Soft tint background (highlight, callout, step numbers). */
	readonly tint: string;
	/** Text on the tint, and the eyebrow. */
	readonly onTint: string;
}

export const ACCENT_PALETTES: Readonly<Record<EmailAccent, AccentPalette>> = {
	/** Brand — neutral account / product messages. */
	indigo: { solid: EMAIL_THEME.brand, tint: "#eef3fd", onTint: "#1e40af" },
	/** Success — completed, welcome, rewards earned. */
	green: { solid: "#16a34a", tint: "#effaf3", onTint: "#166534" },
	/** Warning — a security-relevant change worth a look. */
	amber: { solid: "#d97706", tint: "#fffbeb", onTint: "#92400e" },
	/** Danger — locked accounts, suspicious activity. */
	red: { solid: "#dc2626", tint: "#fef2f2", onTint: "#991b1b" },
	/** Info — codes, invitations, integrations. */
	sky: { solid: "#0284c7", tint: "#f0f9ff", onTint: "#075985" },
};

/** One row of a {@link BaseEmailTemplate.detailsCard}. */
export interface EmailDetailRow {
	readonly label: string;
	readonly value: string;
}

/** One item of a {@link BaseEmailTemplate.steps} list. */
export interface EmailStep {
	readonly title: string;
	readonly description: string;
}

/**
 * Abstract base for every transactional email.
 *
 * Subclasses implement the *content* contract (key, subject, accent, eyebrow,
 * heading, body HTML/text, optional CTA); the base implements the *delivery*
 * contract — the bulletproof responsive HTML shell, the plain-text twin, the
 * preheader, HTML escaping, absolute URL building — and a small kit of
 * building blocks (`paragraph`, `detailsCard`, `highlight`, `callout`,
 * `steps`, `otpCodeBlock`, `link`, `linkBlock`) so every email shares one
 * look by construction instead of copy-pasted inline styles.
 *
 * Every building block escapes the values it is given. `paragraph` and
 * `note` take HTML: interpolate user data only through `escape`, `strong`
 * or `link`.
 *
 * Templates are stateless and fully controlled by the caller: construct with
 * props, pass to `EmailSenderService.send()` — nothing is read from the
 * environment and nothing is fetched.
 */
export abstract class BaseEmailTemplate<TProps extends BaseEmailProps> {
	/** Validated-at-construction props; re-validated by the sender before send. */
	public readonly props: TProps;

	/**
	 * Public so the registry and the auth facade can construct concrete
	 * templates (which only declare content, not their own constructors).
	 */
	public constructor(props: TProps) {
		this.props = props;
	}

	// ── Contract (implemented by each template) ─────────────────────────

	/** Registry key — must match `EmailTemplateKeySchema`. */
	public abstract readonly key: string;

	/** Zod schema for the template's props (extends `BaseEmailPropsSchema`). */
	public abstract readonly propsSchema: ZodType<TProps>;

	/** Email subject line (≤ ~78 chars, no ALL-CAPS — spam-score discipline). */
	public abstract readonly subject: string;

	/** Tone of the message — colors the eyebrow's dot and text, and the tinted blocks. */
	protected abstract readonly accent: EmailAccent;

	/** Short, sentence-case label above the heading (e.g. "Email verification") — what kind of message this is. */
	protected abstract readonly eyebrow: string;

	/** Large heading inside the email body. */
	protected abstract readonly heading: string;

	/** Hidden inbox-list preview line (preheader). */
	public abstract getPreviewText(context: EmailRenderContext): string;

	/** Body content — the part between heading and CTA/footer. */
	public abstract renderBodyHtml(context: EmailRenderContext): string;

	/** Plain-text twin of `renderBodyHtml`. */
	public abstract renderBodyText(context: EmailRenderContext): string;

	/** Optional CTA button; default none. */
	public getCta(_context: EmailRenderContext): CtaConfig | null {
		return null;
	}

	/**
	 * Where the HTML shows the CTA: `"after-body"` (the shell renders it below
	 * the body) or `"in-body"` (the template places `ctaButton` itself — e.g.
	 * above a copy-link fallback). The plain-text twin always lists it.
	 */
	protected readonly ctaPlacement: "after-body" | "in-body" = "after-body";

	// ── Helpers ──────────────────────────────────────────────────────────

	/** Accent palette for this template's tone. */
	protected get palette(): AccentPalette {
		return ACCENT_PALETTES[this.accent];
	}

	/**
	 * HTML-escape every interpolated value. Any user-controlled string that
	 * reaches an email template MUST go through this (rule 11) — a raw
	 * `<script>` in a token would otherwise execute in the mail client.
	 */
	protected escape(value: string | number): string {
		const str = String(value);
		return str.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
	}

	/** An escaped value in bold — for interpolating data into `paragraph` / `note`. */
	protected strong(value: string | number): string {
		return `<strong style="color: ${EMAIL_THEME.heading};" class="email-heading">${this.escape(value)}</strong>`;
	}

	/**
	 * Build an absolute, properly-encoded action URL from a relative path.
	 * Query values are percent-encoded via `URLSearchParams` — safe for tokens.
	 */
	protected buildUrl(context: EmailRenderContext, path: string, query?: Readonly<Record<string, string>>): string {
		const base: string = context.appUrl.replace(/\/+$/, "");
		const safePath: string = path.startsWith("/") ? path : `/${path}`;
		const url: URL = new URL(`${base}${safePath}`);
		if (query) {
			for (const [key, value] of Object.entries(query)) {
				url.searchParams.set(key, value);
			}
		}
		return url.toString();
	}

	// ── Building blocks ─────────────────────────────────────────────────

	/** A body paragraph. `html` must already be safe (escape interpolations). */
	protected paragraph(html: string): string {
		return `<p class="email-text" style="margin: 0 0 16px 0; color: ${EMAIL_THEME.text}; font-size: 15px; line-height: 1.65;">${html}</p>`;
	}

	/** A small, muted note (expiry, "ignore if this wasn't you"). `html` must already be safe. */
	protected note(html: string): string {
		return `<p class="email-muted" style="margin: 0 0 8px 0; color: ${EMAIL_THEME.muted}; font-size: 13px; line-height: 1.6;">${html}</p>`;
	}

	/** An inline link (both values escaped). */
	protected link(href: string, label: string): string {
		return `<a href="${this.escape(href)}" class="email-link" style="color: ${EMAIL_THEME.brand}; font-weight: 600; text-decoration: underline;">${this.escape(label)}</a>`;
	}

	/** Label / value facts — device, location, key name, role… — as a quiet ledger: a soft panel, hairlines between rows, no box. */
	protected detailsCard(rows: readonly EmailDetailRow[]): string {
		const body: string = rows
			.map((row: EmailDetailRow, index: number): string => {
				const divider: string = index === 0 ? "" : `border-top: 1px solid ${EMAIL_THEME.divider};`;
				return `
              <tr>
                <td class="email-muted email-divider" style="${divider} padding: 11px 0; width: 38%; vertical-align: top; color: ${EMAIL_THEME.muted}; font-size: 13px; line-height: 1.5;">${this.escape(row.label)}</td>
                <td class="email-heading email-divider" style="${divider} padding: 11px 0 11px 12px; vertical-align: top; color: ${EMAIL_THEME.heading}; font-size: 14px; font-weight: 600; line-height: 1.5; word-break: break-word;">${this.escape(row.value)}</td>
              </tr>`;
			})
			.join("");
		return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 4px 0 24px 0;">
          <tr>
            <td class="email-panel" style="background: ${EMAIL_THEME.panel}; border-radius: 10px; padding: 5px 18px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}
              </table>
            </td>
          </tr>
        </table>`;
	}

	/** A prominent, tinted statement — the one thing the reader must notice (a reward, a lock period). */
	protected highlight(title: string, subtitle?: string): string {
		const palette: AccentPalette = this.palette;
		const subtitleHtml: string =
			subtitle === undefined ? "" : `<p style="margin: 6px 0 0 0; color: ${palette.onTint}; font-size: 13px; line-height: 1.5;">${this.escape(subtitle)}</p>`;
		return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 4px 0 20px 0;">
          <tr>
            <td class="email-tint" align="center" style="background: ${palette.tint}; border-radius: 10px; padding: 22px 24px; text-align: center;">
              <p style="margin: 0; color: ${palette.onTint}; font-size: 19px; font-weight: 700; line-height: 1.35;">${this.escape(title)}</p>${subtitleHtml}
            </td>
          </tr>
        </table>`;
	}

	/** A tinted note — guidance the reader should not miss ("Wasn't you?"). Fill only, no bar. */
	protected callout(title: string, body: string): string {
		const palette: AccentPalette = this.palette;
		return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 4px 0 20px 0;">
          <tr>
            <td class="email-tint" style="background: ${palette.tint}; border-radius: 10px; padding: 16px 18px;">
              <p style="margin: 0 0 4px 0; color: ${palette.onTint}; font-size: 14px; font-weight: 700; line-height: 1.4;">${this.escape(title)}</p>
              <p style="margin: 0; color: ${palette.onTint}; font-size: 13px; line-height: 1.55;">${this.escape(body)}</p>
            </td>
          </tr>
        </table>`;
	}

	/** A numbered list of steps (title + description). */
	protected steps(items: readonly EmailStep[]): string {
		const rows: string = items
			.map(
				(item: EmailStep, index: number): string => `
          <tr>
            <td style="width: 36px; padding: 0 0 14px 0; vertical-align: top;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="width: 26px; height: 26px; border-radius: 13px; background: ${this.palette.tint}; color: ${this.palette.onTint}; font-size: 13px; font-weight: 700; line-height: 26px; text-align: center;">${String(index + 1)}</td></tr></table>
            </td>
            <td style="padding: 2px 0 14px 4px; vertical-align: top;">
              <p class="email-heading" style="margin: 0; color: ${EMAIL_THEME.heading}; font-size: 15px; font-weight: 600; line-height: 1.4;">${this.escape(item.title)}</p>
              <p class="email-muted" style="margin: 2px 0 0 0; color: ${EMAIL_THEME.muted}; font-size: 13px; line-height: 1.55;">${this.escape(item.description)}</p>
            </td>
          </tr>`,
			)
			.join("");
		return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 4px 0 10px 0;">${rows}
        </table>`;
	}

	/** A one-time code as separate character tiles (table layout for every client). */
	protected otpCodeBlock(code: string | number): string {
		// Grapheme-safe split (codes are digits today; this stays correct for any character).
		const characters: readonly string[] = Array.from(new Intl.Segmenter("en", { granularity: "grapheme" }).segment(String(code)), (part): string => part.segment);
		const tiles: string = characters
			.map(
				(character: string): string =>
					`<td class="email-otp-tile" align="center" style="width: 44px; height: 54px; background: ${EMAIL_THEME.panel}; border-radius: 10px; font-family: ${EMAIL_THEME.monoStack}; font-size: 26px; font-weight: 700; color: ${EMAIL_THEME.heading}; text-align: center;">${this.escape(character)}</td><td style="width: 8px;"></td>`,
			)
			.join("");
		return `
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 8px auto 20px auto;">
          <tr>${tiles}</tr>
        </table>`;
	}

	/** Bulletproof table-based CTA button (brand colour, every client). */
	protected ctaButton(cta: CtaConfig): string {
		return `
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 8px 0 24px 0;">
          <tr>
            <td class="email-cta" style="background: ${EMAIL_THEME.brand}; border-radius: 8px;">
              <a href="${this.escape(cta.href)}" style="display: inline-block; padding: 13px 26px; font-family: ${EMAIL_THEME.fontStack}; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">${this.escape(cta.label)}</a>
            </td>
          </tr>
        </table>`;
	}

	/** This template's CTA, rendered where the body places it (`ctaPlacement: "in-body"`). */
	protected ctaInBody(context: EmailRenderContext): string {
		const cta: CtaConfig | null = this.getCta(context);
		return cta === null ? "" : this.ctaButton(cta);
	}

	/** "Button not working?" fallback with the raw link. */
	protected linkBlock(href: string): string {
		return `
        <p class="email-muted" style="margin: 0 0 6px 0; color: ${EMAIL_THEME.muted}; font-size: 12px; line-height: 1.5;">Button not working? Paste this link into your browser:</p>
        <p class="email-panel" style="margin: 0 0 20px 0; background: ${EMAIL_THEME.panel}; border-radius: 8px; padding: 10px 12px; font-family: ${EMAIL_THEME.monoStack}; font-size: 12px; line-height: 1.5; color: ${EMAIL_THEME.text}; word-break: break-all;">${this.escape(href)}</p>`;
	}

	// ── Shell ────────────────────────────────────────────────────────────

	/** Full standalone HTML document (usable in iframe srcdoc + mail clients). */
	public renderHtml(context: EmailRenderContext): string {
		const palette: AccentPalette = this.palette;
		const cta: CtaConfig | null = this.getCta(context);
		const year: number = new Date().getFullYear();
		const theme: EmailTheme = EMAIL_THEME;
		const monogram: string = this.escape(context.appName.trim().charAt(0).toUpperCase());
		const supportLine: string = context.supportEmail
			? `<p style="margin: 4px 0 0 0;">Questions? Reach us at <a href="mailto:${this.escape(context.supportEmail)}" style="color: ${theme.subtle}; text-decoration: underline;">${this.escape(context.supportEmail)}</a></p>`
			: "";

		return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <meta name="x-apple-disable-message-reformatting">
  <title>${this.escape(this.subject)}</title>
  <style>
    @media (max-width: 620px) {
      .email-card-inner { padding: 30px 22px 26px 22px !important; }
      .email-h1 { font-size: 22px !important; }
    }
    @media (prefers-color-scheme: dark) {
      .email-body, .email-canvas { background-color: ${theme.dark.canvas} !important; }
      .email-card { background-color: ${theme.dark.card} !important; }
      .email-heading, .email-h1, .email-brand-name { color: ${theme.dark.heading} !important; }
      .email-text { color: ${theme.dark.text} !important; }
      .email-muted, .email-footer { color: ${theme.dark.muted} !important; }
      .email-eyebrow { color: ${theme.dark.muted} !important; }
      .email-panel, .email-otp-tile { background-color: ${theme.dark.panel} !important; color: ${theme.dark.heading} !important; }
      .email-divider { border-top-color: ${theme.dark.divider} !important; }
      .email-link { color: ${theme.brandOnDark} !important; }
    }
  </style>
</head>
<body class="email-body" style="margin: 0; padding: 0; background-color: ${theme.canvas}; font-family: ${theme.fontStack}; -webkit-font-smoothing: antialiased;">
  <span style="display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; overflow: hidden; mso-hide: all;">${this.escape(this.getPreviewText(context))}</span>
  <table role="presentation" class="email-canvas" width="100%" cellpadding="0" cellspacing="0" bgcolor="${theme.canvas}" style="width: 100%; background-color: ${theme.canvas};">
    <tr>
      <td align="center" style="padding: 32px 12px 40px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: ${String(theme.maxWidthPx)}px; margin: 0 auto;">
          <tr>
            <td style="padding: 0 4px 18px 4px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="width: 34px; height: 34px; border-radius: 8px; background: ${theme.brand}; color: #ffffff; font-size: 17px; font-weight: 700; line-height: 34px; text-align: center;">${monogram}</td>
                  <td class="email-brand-name" style="padding-left: 10px; color: ${theme.heading}; font-size: 17px; font-weight: 700; letter-spacing: -0.01em;">${this.escape(context.appName)}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="email-card" style="background: ${theme.card}; border-radius: 14px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="email-card-inner" style="padding: 40px 44px 36px 44px;">
                    <p class="email-eyebrow" style="margin: 0 0 12px 0; color: ${palette.onTint}; font-size: 13px; font-weight: 600; line-height: 20px;"><span style="display: inline-block; width: 8px; height: 8px; margin: 0 8px 1px 0; border-radius: 4px; background: ${palette.solid}; vertical-align: middle;"></span>${this.escape(this.eyebrow)}</p>
                    <h1 class="email-h1" style="margin: 0 0 20px 0; color: ${theme.heading}; font-size: 26px; font-weight: 700; line-height: 1.25; letter-spacing: -0.015em;">${this.escape(this.heading)}</h1>
                    ${this.renderBodyHtml(context)}
                    ${cta !== null && this.ctaPlacement === "after-body" ? this.ctaButton(cta) : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="email-footer" align="center" style="padding: 20px 16px 0 16px; color: ${theme.subtle}; font-size: 12px; line-height: 1.6; text-align: center;">
              <p style="margin: 0;">You're receiving this because you have an account with <a href="${this.escape(context.appUrl)}" style="color: ${theme.subtle}; text-decoration: underline;">${this.escape(context.appName)}</a>.</p>
              ${supportLine}
              <p style="margin: 4px 0 0 0;">&copy; ${String(year)} ${this.escape(context.appName)}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
	}

	/** Plain-text twin of `renderHtml` — every email ships with both. */
	public renderText(context: EmailRenderContext): string {
		const cta: CtaConfig | null = this.getCta(context);
		const year: number = new Date().getFullYear();
		const lines: string[] = [`${context.appName} — ${this.eyebrow}`, "".padEnd(30, "━"), "", this.heading, "", this.renderBodyText(context), ""];
		if (cta) {
			lines.push(`Action: ${cta.label}`, "", cta.href, "");
		}
		if (context.supportEmail) {
			lines.push(`Questions? ${context.supportEmail}`, "");
		}
		lines.push(`© ${String(year)} ${context.appName}. All rights reserved.`);
		return lines.join("\n");
	}
}
