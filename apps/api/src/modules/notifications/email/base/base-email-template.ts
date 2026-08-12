import { z, type ZodType } from "zod";

import type { EmailRenderContext } from "./email-render-context";

/**
 * Base props every email template accepts. Subclasses extend this with their
 * own fields (tokens, names, durations, …) via `.extend()`.
 */
export const BaseEmailPropsSchema = z
	.object({
		to: z.email(),
		cc: z.array(z.email()).optional(),
		bcc: z.array(z.email()).optional(),
		replyTo: z.email().optional(),
	})
	.strict();

export type BaseEmailProps = z.output<typeof BaseEmailPropsSchema>;

/**
 * Accent tokens — one per brand color family. Keeps the palette centralized
 * (rule 22: design-token driven) so templates never hardcode colors.
 */
export const EmailAccentSchema = z.enum(["green", "indigo", "red", "amber", "sky"]);

export type EmailAccent = z.output<typeof EmailAccentSchema>;

/** Colors used by the shared shell for one accent. */
export interface AccentPalette {
	/** Header band background — standardized to slate-800 across all accents. */
	readonly headerGradient: string;
	/** Eyebrow text color on top of the slate-800 header. */
	readonly eyebrowColor: string;
	/** CTA button background — standardized to slate across all accents. */
	readonly ctaGradient: string;
	/** Soft chip background (light, per the design brief). */
	readonly chipBg: string;
	/** Chip text color. */
	readonly chipText: string;
	/** Chip border color. */
	readonly chipBorder: string;
}

/**
 * Slate hero band — the standardized header treatment (tailwind `bg-slate-800`
 * family, #1e293b). Every accent shares it so the header + CTA read as one
 * consistent brand block; only the content-area chips keep per-accent color.
 */
const SHELL_HEADER_BG = "linear-gradient(135deg, #1e293b, #0f172a)";

/** Slate CTA button — standardized (tailwind slate-600→700). */
const SHELL_CTA_BG = "linear-gradient(135deg, #475569, #334155)";

/** Eyebrow label color on top of the slate header. */
const SHELL_EYEBROW_COLOR = "#cbd5e1";

export const ACCENT_PALETTES: Readonly<Record<EmailAccent, AccentPalette>> = {
	green: {
		headerGradient: SHELL_HEADER_BG,
		eyebrowColor: SHELL_EYEBROW_COLOR,
		ctaGradient: SHELL_CTA_BG,
		chipBg: "#f0fdf4",
		chipText: "#166534",
		chipBorder: "#bbf7d0",
	},
	indigo: {
		headerGradient: SHELL_HEADER_BG,
		eyebrowColor: SHELL_EYEBROW_COLOR,
		ctaGradient: SHELL_CTA_BG,
		chipBg: "#eef2ff",
		chipText: "#3730a3",
		chipBorder: "#c7d2fe",
	},
	red: {
		headerGradient: SHELL_HEADER_BG,
		eyebrowColor: SHELL_EYEBROW_COLOR,
		ctaGradient: SHELL_CTA_BG,
		chipBg: "#fef2f2",
		chipText: "#991b1b",
		chipBorder: "#fecaca",
	},
	amber: {
		headerGradient: SHELL_HEADER_BG,
		eyebrowColor: SHELL_EYEBROW_COLOR,
		ctaGradient: SHELL_CTA_BG,
		chipBg: "#fffbeb",
		chipText: "#92400e",
		chipBorder: "#fde68a",
	},
	sky: {
		headerGradient: SHELL_HEADER_BG,
		eyebrowColor: SHELL_EYEBROW_COLOR,
		ctaGradient: SHELL_CTA_BG,
		chipBg: "#f0f9ff",
		chipText: "#075985",
		chipBorder: "#bae6fd",
	},
};

/**
 * CTA button config — label + absolute URL.
 */
export const CtaConfigSchema = z
	.object({
		label: z.string().min(1),
		href: z.url(),
	})
	.strict();

export type CtaConfig = z.output<typeof CtaConfigSchema>;

/**
 * Abstract base for every transactional email.
 *
 * Subclasses implement the *content* contract (key, subject, accent, eyebrow,
 * heading, body HTML/text, optional CTA); the base implements the *delivery*
 * contract: the bulletproof responsive HTML shell, the plain-text twin, the
 * preheader, HTML escaping, absolute URL building, and the CTA button.
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

	/** Brand color family for the header band + CTA. */
	protected abstract readonly accent: EmailAccent;

	/** Small label above the heading (e.g. "Email Verification"). */
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

	// ── Shared rendering (implemented once, here) ────────────────────────

	/** Accent palette getter for subclasses (chips, badges, …). */
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

	/** Bulletproof table-based CTA button. */
	protected ctaButton(cta: CtaConfig): string {
		return `
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px auto;">
          <tr>
            <td style="background: ${this.palette.ctaGradient}; border-radius: 10px; box-shadow: 0 4px 14px rgba(0,0,0,0.12);">
              <a href="${this.escape(cta.href)}" style="display: inline-block; padding: 14px 34px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 10px;">${this.escape(cta.label)}</a>
            </td>
          </tr>
        </table>`;
	}

	/** "Or copy and paste this link" fallback block. */
	protected linkBlock(href: string): string {
		return `
        <p class="email-muted" style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0 0 8px 0;">Or copy and paste this link into your browser:</p>
        <p style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; font-size: 13px; color: #334155; word-break: break-all; margin: 0 0 24px 0;">${this.escape(href)}</p>`;
	}

	/** Full standalone HTML document (usable in iframe srcdoc + mail clients). */
	public renderHtml(context: EmailRenderContext): string {
		const palette: AccentPalette = this.palette;
		const cta: CtaConfig | null = this.getCta(context);
		const year: number = new Date().getFullYear();
		const supportLine: string = context.supportEmail
			? `Questions? <a href="mailto:${this.escape(context.supportEmail)}" style="color: #64748b; text-decoration: underline;">${this.escape(context.supportEmail)}</a>`
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
    @media (prefers-color-scheme: dark) {
      .email-body { background-color: #0b1120 !important; }
      .email-card { background-color: #111a2e !important; }
      .email-heading { color: #f1f5f9 !important; }
      .email-text { color: #cbd5e1 !important; }
      .email-muted { color: #94a3b8 !important; }
      .email-rule { border-top: 1px solid #243048 !important; }
      .email-link-block { background-color: #0f172a !important; border-color: #243048 !important; color: #cbd5e1 !important; }
      .email-footer { color: #64748b !important; }
      .email-chip { background-color: #17233d !important; }
    }
  </style>
</head>
<body class="email-body" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 0;">
  <span style="display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; mso-hide: all;">${this.escape(this.getPreviewText(context))}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 950px; margin: 40px auto; padding: 0 16px;">
    <tr>									<td style="background: ${palette.headerGradient}; padding: 38px 36px 32px 36px; border-radius: 14px 14px 0 0; text-align: center;">
        <p style="margin: 0 0 6px 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; color: #ffffff;">${this.escape(context.appName)}</p>
        <p style="margin: 0; font-size: 13px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: ${palette.eyebrowColor};">${this.escape(this.eyebrow)}</p>
      </td>
    </tr>
    <tr>	      <td class="email-card" style="background: #ffffff; padding: 38px 36px; border-radius: 0 0 14px 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
        <h1 class="email-heading" style="color: #0f172a; margin: 0 0 18px 0; font-size: 22px; font-weight: 700; letter-spacing: -0.01em;">${this.escape(this.heading)}</h1>
        ${this.renderBodyHtml(context)}
        ${cta ? this.ctaButton(cta) : ""}
        <hr class="email-rule" style="border: none; border-top: 1px solid #e2e8f0; margin: 26px 0;">
        <p class="email-muted" style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0;">${this.escape(context.appName)} · <a href="${this.escape(context.appUrl)}" style="color: #64748b; text-decoration: underline;">${this.escape(context.appUrl)}</a></p>
        ${supportLine ? `<p class="email-muted" style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 6px 0 0 0;">${supportLine}</p>` : ""}
      </td>
    </tr>
    <tr>
      <td class="email-footer" style="padding: 20px 16px; text-align: center; color: #94a3b8; font-size: 12px; line-height: 1.6;">
        <p style="margin: 0 0 4px 0;">You're receiving this because you have an account with ${this.escape(context.appName)}.</p>
        <p style="margin: 0;">&copy; ${String(year)} ${this.escape(context.appName)}. All rights reserved.</p>
      </td>
    </tr>	  </table>
</body>
</html>`;
	}

	/** Plain-text twin of `renderHtml` — every email ships with both. */
	public renderText(context: EmailRenderContext): string {
		const cta: CtaConfig | null = this.getCta(context);
		const year: number = new Date().getFullYear();
		const lines: string[] = [`${context.appName} — ${this.eyebrow}`, "".padEnd(30, "━"), "", this.renderBodyText(context), ""];
		if (cta) {
			lines.push(`Action: ${cta.label}`, "", cta.href, "");
		}
		lines.push(`© ${String(year)} ${context.appName}. All rights reserved.`);
		return lines.join("\n");
	}
}
