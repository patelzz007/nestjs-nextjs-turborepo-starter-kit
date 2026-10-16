import type { AccordionDemoItem } from "@/components/showcase/accordion-showcase";

/*
 * Sample content of `AccordionShowcase` (rule 9/10: content lives with the
 * pages that mount it, the low-level components only receive props). Shared by
 * the dashboard gallery (`/`) and the component gallery (`/components`), so the
 * two pages show the same demo.
 */

/** Questions, one with nested sub-questions (rendered as an inner accordion). */
export const ACCORDION_FAQ_ITEMS: readonly AccordionDemoItem[] = [
	{
		id: "faq-roles",
		value: "faq-roles",
		title: "When does a role or permission change take effect?",
		body: "On the user's next request. Every access token carries the account's token version, and the API rejects a token whose version is stale — so a revoked role or permission stops working immediately, without waiting for the token to expire.",
	},
	{
		id: "faq-two-factor",
		value: "faq-two-factor",
		title: "Is two-factor authentication required for admins?",
		body: "Yes. An admin must enrol an authenticator app before the panel opens; until then the session is restricted to the account pages.",
		// Nested sub-topics — the showcase renders these as an inner accordion.
		children: [
			{
				id: "faq-two-factor-backup",
				value: "faq-two-factor-backup",
				title: "What if my authenticator is not at hand?",
				body: "Sign in with one of the single-use backup codes shown at enrolment.",
			},
			{
				id: "faq-two-factor-recovery",
				value: "faq-two-factor-recovery",
				title: "What if I lost both the device and the backup codes?",
				body: "Request MFA recovery from the login screen. A super-admin reviews the request in Users → MFA recovery before two-factor is reset.",
			},
		],
	},
];

/** Rows with a status, a count and a shortcut — done, loading, error, disabled and lazy. */
export const ACCORDION_STATUS_ITEMS: readonly AccordionDemoItem[] = [
	{
		id: "status-db",
		value: "status-db",
		title: "Database migrations applied",
		body: "12 migrations ran cleanly against the production database.",
		status: "done",
		count: 12,
		shortcut: "⌘1",
	},
	{
		id: "status-cache",
		value: "status-cache",
		title: "Warming the CDN cache",
		body: "Purging and re-warming the /docs routes… this row stays open while the job runs.",
		status: "loading",
		count: 3,
		shortcut: "⌘2",
	},
	{
		id: "status-env",
		value: "status-env",
		title: "Environment parity check",
		body: "STAGING and PRODUCTION differ on NEXT_PUBLIC_SESSION_POLL_MS — update the staging .env to match.",
		status: "error",
		count: 2,
		shortcut: "⌘3",
		autofocus: true,
	},
	{
		id: "status-lock",
		value: "status-lock",
		title: "Locked: requires super-admin",
		body: "This step is only available to super-admins; the trigger is disabled and not focusable.",
		disabled: true,
	},
	{
		id: "status-lazy",
		value: "status-lazy",
		title: "Lazy panel — mounts on first open",
		body: "This content is not in the DOM until you open it the first time (feature 11). Great for heavy panels that are rarely read.",
		lazy: true,
	},
];

/** Rows of the drag-to-reorder demo. */
export const ACCORDION_REORDER_ITEMS: readonly AccordionDemoItem[] = [
	{
		id: "ord-api",
		value: "ord-api",
		title: "API gateway",
		body: "REST gateway on :8080 with cookie-based auth and swagger at /docs.",
	},
	{
		id: "ord-web",
		value: "ord-web",
		title: "Web app",
		body: "Public marketing + account site on :3000.",
	},
	{
		id: "ord-admin",
		value: "ord-admin",
		title: "Admin panel",
		body: "Internal panel on :3001 with proxy-side silent refresh.",
	},
	{
		id: "ord-worker",
		value: "ord-worker",
		title: "Background workers",
		body: "Prisma cron + email queue (Resend).",
	},
];

/** One row per variant/size combination of the variants demo. */
export const ACCORDION_VARIANT_ITEMS: readonly AccordionDemoItem[] = [
	{
		id: "v-one",
		value: "v-one",
		title: "Compact list row",
		body: "size=sm with separated=false — sits flush inside dense tables.",
	},
	{
		id: "v-two",
		value: "v-two",
		title: "Plain ghost item",
		body: "variant=ghost — no borders, hover tint only.",
	},
	{
		id: "v-three",
		value: "v-three",
		title: "Flush, animation off",
		body: "variant=flush + animate={false} — for places where motion is unwanted.",
	},
	{
		id: "v-four",
		value: "v-four",
		title: "Bordered tile",
		body: "variant=bordered + size=lg with a custom Plus indicator via the icon slot.",
	},
];
