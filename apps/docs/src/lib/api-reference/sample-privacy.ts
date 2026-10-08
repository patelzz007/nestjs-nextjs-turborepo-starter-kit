// ── Personal data guard for the captured API samples ─────────────────────────
// `docs/generated/api-samples.json` is captured from a REAL running API. That API
// reads the developer's own `apps/api/.env`, so values such as EMAIL_FROM_ADDRESS
// can leak a personal address into the published docs. Every email address in
// the samples must belong to a documentation/demo domain.

/** Domains reserved for documentation (RFC 2606) and the seed's demo organizations. */
const TEMPLATE_EMAIL_DOMAIN_PATTERNS: readonly RegExp[] = [/^example\.(com|org|net)$/, /\.example$/, /\.demo$/, /^localhost$/];

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@(?<domain>[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g;

function isTemplateDomain(domain: string): boolean {
	const lowerCased: string = domain.toLowerCase();
	return TEMPLATE_EMAIL_DOMAIN_PATTERNS.some((pattern) => pattern.test(lowerCased));
}

/** Every distinct email address in `text` whose domain is not a documentation or demo domain. */
export function findNonTemplateEmailAddresses(text: string): string[] {
	const found = new Set<string>();
	for (const match of text.matchAll(EMAIL_PATTERN)) {
		const [address] = match;
		const domain: string | undefined = match.groups?.domain;
		if (domain !== undefined && !isTemplateDomain(domain)) {
			found.add(address);
		}
	}
	return [...found].sort();
}

/** Role mailbox names that carry no personal information and are kept as-is on the neutral domain. */
const GENERIC_MAILBOX_NAMES: ReadonlySet<string> = new Set(["noreply", "no-reply", "support", "hello", "admin", "notifications"]);
/** The documentation domain every non-template address is rewritten to. */
const NEUTRAL_EMAIL_DOMAIN = "example.com";
/** The mailbox a personal address (e.g. a developer's EMAIL_TEST_TO) is rewritten to. */
const NEUTRAL_RECIPIENT_MAILBOX = "recipient";

/**
 * Rewrites every non-template email address in `text` to the documentation domain, so a capture
 * run can never publish a developer's own addresses (EMAIL_FROM_ADDRESS, EMAIL_TEST_TO, …):
 * role mailboxes keep their name (`noreply@company.io` → `noreply@example.com`), anything else
 * becomes `recipient@example.com`.
 */
export function neutralizeEmailAddresses(text: string): string {
	return text.replace(EMAIL_PATTERN, (address: string, domain: string): string => {
		if (isTemplateDomain(domain)) {
			return address;
		}
		const mailbox: string = address.slice(0, address.indexOf("@")).toLowerCase();
		return `${GENERIC_MAILBOX_NAMES.has(mailbox) ? mailbox : NEUTRAL_RECIPIENT_MAILBOX}@${NEUTRAL_EMAIL_DOMAIN}`;
	});
}
