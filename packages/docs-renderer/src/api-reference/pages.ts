/**
 * How the API reference is split into pages: each OpenAPI tag belongs to
 * exactly one page. A tag that is not listed here fails the reference test, so
 * a new controller tag is always given a deliberate home.
 */

export interface ReferencePage {
	/** File name under `docs/technical/api-reference/` (without `.md`). */
	readonly slug: string;
	readonly title: string;
	readonly description: string;
	/** Hand-written guide that explains the flow behind these endpoints. */
	readonly guide: { readonly label: string; readonly href: string };
	readonly tags: readonly string[];
}

export const REFERENCE_PAGES: readonly ReferencePage[] = [
	{
		slug: "auth-and-sessions",
		title: "Auth, sessions and account security",
		description: "Login, signup, email verification, password reset, two-factor authentication, MFA recovery, sessions, impersonation and support access.",
		guide: { label: "Account security guide", href: "../../user-guide/10-account-and-security.md" },
		tags: ["Auth", "Sessions", "Impersonation", "Support Access"],
	},
	{
		slug: "access-control",
		title: "Roles, permissions and audit",
		description: "Platform RBAC administration, authorization decisions, the capability catalog and the HTTP audit log.",
		guide: { label: "Authorization overview", href: "../authorization/overview.md" },
		tags: ["Roles", "Permissions", "Authorization", "Capabilities", "Audit Log"],
	},
	{
		slug: "platform-admin",
		title: "Platform administration (merchants, rewards review, analytics)",
		description: "What platform admins do in the admin panel: invite merchants, review KYB and store requests, approve rewards, read platform sales.",
		guide: { label: "Merchant onboarding guide", href: "../../user-guide/02-merchant-onboarding.md" },
		tags: ["Rewards Admin"],
	},
	{
		slug: "merchant-tenants",
		title: "Merchant tenants (portal API)",
		description:
			"Everything the merchant portal calls under /tenants/{tenantSlug}: onboarding, KYB, stores, team, rewards, POS terminals, API keys, redemptions and analytics.",
		guide: { label: "Stores and team guide", href: "../../user-guide/03-stores-and-team.md" },
		tags: [
			"Tenants",
			"Tenant memberships",
			"Tenant Onboarding",
			"Tenant KYB",
			"Tenant Rewards",
			"Tenant POS Terminals",
			"Tenant API Keys",
			"Tenant Redemptions",
			"Tenant Customer Bans",
			"Tenant Access",
			"Tenant Analytics",
		],
	},
	{
		slug: "customer-rewards",
		title: "Customer rewards and claims",
		description:
			"The consumer app's API: browse rewards, share them with friends, accept the legal terms, claim with a one-time code, show the QR code and spending analytics.",
		guide: { label: "Customer claims guide", href: "../../user-guide/05-customer-claims.md" },
		tags: ["Rewards", "Referrals", "Claims", "Legal"],
	},
	{
		slug: "pos",
		title: "Point of sale and integrations (machine-to-machine)",
		description:
			"Terminal pairing, validating a customer's QR / backup code and recording the paid bill, plus the integration API (`/integration/*`: rewards, analytics, redemption history). Authenticated with a merchant API key, which names its own tenant.",
		guide: { label: "POS integration guide", href: "../pos-integration.md" },
		tags: ["POS", "Redemptions", "Integration"],
	},
	{
		slug: "payments",
		title: "Payments (Billplz, CHIP)",
		description:
			"A tenant asks for a payment through a configured gateway (an `Idempotency-Key` header makes a retry return the same payment), follows it and refunds it; the gateways' signed callbacks mark it paid. Amounts are in sen.",
		guide: { label: "ADR 020: payments", href: "../../adr/020-payments-provider-port.md" },
		tags: ["Payments"],
	},
	{
		slug: "webhooks",
		title: "Webhooks (outgoing and received)",
		description:
			"A business's endpoints for signed event deliveries (create, update, switch on or off, rotate the secret, send a test), the delivery log and redelivery (owner-only, `merchant:manage_webhooks`), and the admin's log of every webhook the platform received.",
		guide: { label: "Outgoing webhooks guide", href: "../api/outgoing-webhooks.md" },
		tags: ["Tenant Webhooks", "Received webhooks"],
	},
	{
		slug: "privacy",
		title: "Privacy: your own data",
		description:
			'"Download my data": one ZIP of everything the platform holds about the signed-in person (a manifest and one JSON file per section), audited, once a day, never while impersonating.',
		guide: { label: "ADR 077: personal-data export and erasure", href: "../../adr/077-personal-data-export-and-erasure.md" },
		tags: ["Privacy"],
	},
	{
		slug: "files",
		title: "Files and object storage",
		description: "Direct-to-storage uploads (upload ticket → upload → complete), signed downloads, deletion and the scanner callback.",
		guide: { label: "Object storage guide", href: "../storage/overview.md" },
		tags: ["Files"],
	},
	{
		slug: "email",
		title: "Email log, templates and delivery webhooks",
		description: "The outbound email log, template previews and test sends, and the Resend delivery webhook.",
		guide: { label: "Email (Resend) guide", href: "../email/resend-setup.md" },
		tags: ["Email Log", "Email Templates", "Email Webhook"],
	},
	{
		slug: "notifications",
		title: "Notifications: inbox, preferences, push devices and broadcasts",
		description:
			"One inbox per app (live over SSE), the preference matrix with quiet hours and digest, marketing consent, push device registration, one-click unsubscribe, Twilio callbacks, the delivery log and catalog for staff, and a tenant's own delivery log and broadcasts.",
		guide: { label: "ADR 070: multi-channel notifications", href: "../../adr/070-multi-channel-notifications.md" },
		tags: ["Notifications", "Notifications (admin)", "Notifications (tenant)", "Notification webhooks", "Broadcasts"],
	},
	{
		slug: "geography",
		title: "Geography reference data",
		description: "Regions, subregions, countries, states and cities: CRUD, autocomplete, import and export.",
		guide: { label: "List query grammar", href: "../api/list-queries.md" },
		tags: ["Geo"],
	},
	{
		slug: "github",
		title: "GitHub contributions",
		description: "Read-only summary, commit history with line counts and contributor totals of the GitHub repositories the API is configured with.",
		guide: { label: "GitHub contributions guide", href: "../github-contributions.md" },
		tags: ["GitHub"],
	},
	{
		slug: "github-pull-requests",
		title: "GitHub pull requests",
		description:
			"Admins link their own fine-grained GitHub token, then list and read pull requests — conversation, commits, files with diffs, line-comment threads and edit histories — as themselves.",
		guide: { label: "GitHub pull requests guide", href: "../github-pull-requests.md" },
		tags: ["GitHub pull requests"],
	},
	{
		slug: "catalog-samples",
		title: "Sample catalog (products and categories)",
		description: "The reference CRUD modules every new feature copies: list/detail/create/update/soft delete/restore/bulk.",
		guide: { label: "Golden reference implementations", href: "../../../rules/24-golden-reference-implementations.md" },
		tags: ["Product", "SampleCategory", "Sample Category"],
	},
	{
		slug: "feature-flags",
		title: "Feature flags",
		description:
			"Runtime feature flags: every declared flag with its setting (default, on, off, a share of people) and who changed it, the bare settings the apps evaluate, and a store flag's per-merchant and per-branch settings (a branch's own decides over its merchant's).",
		guide: { label: "Feature flags guide", href: "../feature-flags.md" },
		tags: ["Feature flags"],
	},
	{
		slug: "saved-views",
		title: "Saved views on admin lists",
		description: "Named filters staff keep on an admin list, stored as the list's URL query: your own, and the ones other staff shared.",
		guide: { label: "Saved views guide", href: "../saved-views.md" },
		tags: ["Saved views"],
	},
	{
		slug: "kanban",
		title: "Kanban boards",
		description:
			"The platform staff's two linked boards: the epic → feature → story → task → subtask hierarchy with item keys, moves under the board lock (optimistic locking), Move to… (a new parent), ranked item search, WIP limits, checklists, links, watchers, history, comments with files, CSV import and attachments.",
		guide: { label: "Kanban boards guide", href: "../kanban.md" },
		tags: ["Kanban"],
	},
	{
		slug: "platform-operations",
		title: "Platform operations (servers, backups, load tests)",
		description:
			"The admin panel's operations console (ADR 068): servers and their history, instances, dependencies, alerts, database backups and load tests — and the endpoint a server agent reports to.",
		guide: { label: "Platform operations console", href: "../operations/platform-operations-console.md" },
		tags: ["Operations"],
	},
	{
		slug: "system",
		title: "System: health and version",
		description: "Liveness, readiness and deep health probes, the apps' connection-quality ping and the API version manifest.",
		guide: { label: "Observability", href: "../operations/observability.md" },
		tags: ["App", "System"],
	},
];

/** The page an operation lives on: the page of its first tag. */
export function pageForTags(tags: readonly string[]): ReferencePage | undefined {
	const [first] = tags;
	return first === undefined ? undefined : REFERENCE_PAGES.find((page) => page.tags.includes(first));
}
