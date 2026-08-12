import { z } from "zod";

/**
 * Static branding/config injected at render time.
 *
 * Templates are **pure renderers** (rule 19: stateless, fully controlled by
 * the parent) — they never read `process.env`. The `EmailSenderService` builds
 * this context once from `TypedConfigService` and passes it to
 * `renderHtml` / `renderText`.
 */
export const EmailRenderContextSchema = z
	.object({
		/** Brand name shown in the header band and footer (e.g. "LinkHub"). */
		appName: z.string().min(1),
		/** Public base URL used to build absolute action links. */
		appUrl: z.url(),
		/** Support inbox rendered in the footer (optional). */
		supportEmail: z.email().optional(),
	})
	.strict();

export type EmailRenderContext = z.output<typeof EmailRenderContextSchema>;
