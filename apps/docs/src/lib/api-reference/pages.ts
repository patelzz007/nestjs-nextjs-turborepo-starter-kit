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
		title: "Roles, permissions, policies and audit",
		description: "Platform RBAC administration, authorization decisions, Cedar policy drafts, the capability catalog and the HTTP audit log.",
		guide: { label: "Authorization overview", href: "../authorization/overview.md" },
		tags: ["Roles", "Permissions", "Authorization", "Authorization Policies", "Capabilities", "Audit Log"],
	},
	{
		slug: "platform-admin",
		title: "Platform administration (merchants, rewards review, analytics)",
		description: "What platform admins do in the admin panel: invite merchants, review KYB and store requests, approve rewards, read platform sales.",
		guide: { label: "Merchant onboarding guide", href: "../../user-guide/02-merchant-onboarding.md" },
		tags: ["Rewards Admin"],
	},
	{
		slug: "merchant-organizations",
		title: "Merchant organizations (portal API)",
		description: "Everything the merchant portal calls under /orgs/{orgSlug}: onboarding, KYB, stores, team, rewards, POS terminals, API keys, redemptions and analytics.",
		guide: { label: "Stores and team guide", href: "../../user-guide/03-stores-and-team.md" },
		tags: [
			"Organizations",
			"Organization RewardHub",
			"Organization Onboarding",
			"Organization KYB",
			"Organization Rewards",
			"Organization POS Terminals",
			"Organization API Keys",
			"Organization Redemptions",
			"Organization Analytics",
		],
	},
	{
		slug: "customer-rewards",
		title: "Customer rewards and claims",
		description: "The consumer app's API: browse rewards, accept the legal terms, claim with a one-time code, show the QR code, read notifications and spending analytics.",
		guide: { label: "Customer claims guide", href: "../../user-guide/05-customer-claims.md" },
		tags: ["Rewards", "Claims", "Legal", "Reward Notifications"],
	},
	{
		slug: "pos",
		title: "Point of sale (machine-to-machine)",
		description: "Terminal pairing, validating a customer's QR / backup code and recording the paid bill. Authenticated with a merchant API key.",
		guide: { label: "POS integration guide", href: "../pos-integration.md" },
		tags: ["POS", "Redemptions"],
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
		slug: "geography",
		title: "Geography reference data",
		description: "Regions, subregions, countries, states and cities: CRUD, autocomplete, import and export.",
		guide: { label: "List query grammar", href: "../api/list-queries.md" },
		tags: ["Geo"],
	},
	{
		slug: "catalog-samples",
		title: "Sample catalog (products and categories)",
		description: "The reference CRUD modules every new feature copies: list/detail/create/update/soft delete/restore/bulk.",
		guide: { label: "Golden reference implementations", href: "../../../rules/24-golden-reference-implementations.md" },
		tags: ["Product", "SampleCategory", "Sample Category"],
	},
	{
		slug: "system",
		title: "System: health and version",
		description: "Liveness, readiness and deep health probes and the API version manifest.",
		guide: { label: "Observability", href: "../operations/observability.md" },
		tags: ["App", "System"],
	},
];

/** The page an operation lives on: the page of its first tag. */
export function pageForTags(tags: readonly string[]): ReferencePage | undefined {
	const [first] = tags;
	return first === undefined ? undefined : REFERENCE_PAGES.find((page) => page.tags.includes(first));
}
