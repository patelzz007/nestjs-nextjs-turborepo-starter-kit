/**
 * Which real screenshot of the apps (`docs/images/readme/<name>.webp`, taken for the README) stands behind a
 * guide's cover. The words of the guide's path and its tags pick the screen the guide is about; the first rule
 * with a matching word wins, so the specific rules come before the broad ones. A guide no rule matches gets
 * its folder's screen. Mobile guides pick among the phone screens, which the cover draws in a phone frame.
 */

/** A rule: any of `words` in the guide's path or tags picks `screenshot`. */
export interface ScreenshotRule {
	readonly words: readonly string[];
	readonly screenshot: string;
}

/** Words that make a guide a mobile guide. */
const MOBILE_WORDS: readonly string[] = ["mobile", "expo", "react-native", "eas", "ota", "android", "ios", "apk"];
const MOBILE_PREFIX = "mobile-";
const MOBILE_DEFAULT = "mobile-home-dark";

const MOBILE_RULES: readonly ScreenshotRule[] = [
	{ words: ["till", "pos", "offline", "checkout", "pairing"], screenshot: "mobile-till-dark" },
	{ words: ["pull", "requests"], screenshot: "mobile-pull-requests" },
	{ words: ["github", "contributions"], screenshot: "mobile-github-contributions" },
	{ words: ["push", "notifications", "inbox", "fcm", "apns"], screenshot: "mobile-notifications-dark" },
	{ words: ["passkeys", "webauthn", "lock", "security", "biometrics"], screenshot: "mobile-security-dark" },
	{ words: ["servers", "server", "monitoring", "ping"], screenshot: "mobile-servers-dark" },
	{ words: ["analytics", "charts"], screenshot: "mobile-analytics-dark" },
	{ words: ["pdf"], screenshot: "mobile-pdf-open" },
	{ words: ["theming", "themes", "tokens", "uniwind", "styling", "design"], screenshot: "mobile-theme-harbour-home" },
	{ words: ["navigation", "drawer"], screenshot: "mobile-drawer-dark" },
	{ words: ["i18n", "language"], screenshot: "mobile-language" },
	{ words: ["updates", "build", "installable", "release", "apk", "eas"], screenshot: "mobile-about" },
	{ words: ["settings"], screenshot: "mobile-settings-dark" },
];

const RULES: readonly ScreenshotRule[] = [
	{ words: ["kanban"], screenshot: "admin-kanban-dark" },
	{ words: ["saved", "views", "url-state", "data-table", "pagination", "list"], screenshot: "admin-components-data-grid" },
	{ words: ["feature", "flags", "feature-flags"], screenshot: "admin-settings-feature-flags" },
	{ words: ["pull", "requests"], screenshot: "mobile-pull-requests" },
	{ words: ["github", "contributions"], screenshot: "mobile-github-contributions" },
	{ words: ["pos", "till", "terminals", "checkout", "sales"], screenshot: "merchant-terminals" },
	{ words: ["payments", "payment", "billing"], screenshot: "merchant-payments" },
	{ words: ["referrals", "referral"], screenshot: "web-referrals" },
	{ words: ["tiers", "claims", "claim", "redemptions", "customer", "customers"], screenshot: "web-reward" },
	{ words: ["rewards", "reward", "rewardhub"], screenshot: "merchant-rewards-dark" },
	{ words: ["kyb", "verification"], screenshot: "admin-merchant-verification" },
	{ words: ["onboarding", "invites", "merchants"], screenshot: "admin-merchants" },
	{ words: ["stores", "team", "locations", "location"], screenshot: "merchant-team" },
	{ words: ["api-keys"], screenshot: "merchant-api-keys" },
	{ words: ["webhooks", "outgoing"], screenshot: "merchant-webhooks" },
	{ words: ["broadcasts", "broadcast"], screenshot: "admin-emails-broadcasts" },
	{ words: ["email", "mailpit", "resend", "templates", "sms"], screenshot: "admin-emails-log" },
	{ words: ["notifications", "push", "in-app", "inbox"], screenshot: "admin-notifications" },
	{ words: ["analytics", "charts", "recharts", "analytics-consumer"], screenshot: "admin-analytics-dark" },
	{ words: ["audit", "transaction", "log", "logs", "telescope", "replay"], screenshot: "admin-audit-logs-dark" },
	{ words: ["rate", "limits", "rate-limiting", "cache", "caching", "redis"], screenshot: "admin-operations-rate-limits" },
	{ words: ["queues", "messaging", "kafka", "rabbitmq", "bullmq", "outbox", "events", "idempotency"], screenshot: "admin-operations-queues" },
	{ words: ["backups", "retention"], screenshot: "admin-operations-backups" },
	{ words: ["load", "load-testing", "capacity", "slos", "slo", "performance"], screenshot: "admin-operations-load-tests" },
	{ words: ["observability", "monitoring", "logging", "tracing", "health", "status", "incident", "resilience"], screenshot: "admin-operations-status" },
	{ words: ["deployment", "digitalocean", "infrastructure", "pooling", "pgbouncer", "nginx", "pm2", "docker", "server"], screenshot: "admin-operations-servers-dark" },
	{ words: ["operations", "console", "superadmin"], screenshot: "admin-operations-alerts" },
	{ words: ["impersonation", "support-access", "privacy", "consent"], screenshot: "admin-users-support-access" },
	{ words: ["mfa", "2fa", "passkeys", "webauthn"], screenshot: "admin-users-mfa-recovery" },
	{ words: ["authentication", "sessions", "session", "jwt", "token", "refresh", "auth"], screenshot: "admin-account-security" },
	{ words: ["tenancy", "rls", "tenant", "multi-tenancy", "organization"], screenshot: "docs-tenancy" },
	{ words: ["security", "threat", "threat-model", "kms", "encryption", "rotation", "classification", "secrets"], screenshot: "docs-security" },
	{ words: ["authorization", "rbac", "rebac", "abac", "acl", "cedar", "permissions", "access"], screenshot: "admin-settings-access" },
	{ words: ["geography"], screenshot: "admin-geography" },
	{ words: ["catalog"], screenshot: "admin-catalog-products" },
	{ words: ["storage", "files", "s3", "firebase", "uploads", "gcs", "image", "resizer"], screenshot: "admin-catalog-product-new" },
	{ words: ["date", "pickers", "date-picker", "calendar", "time"], screenshot: "admin-components-date-picker" },
	{ words: ["toast", "sonner", "loading", "skeletons", "skeleton", "dialog"], screenshot: "admin-components-dialog" },
	{ words: ["carousel", "qr", "qr-code", "pdf"], screenshot: "admin-components" },
	{ words: ["admin", "panel", "sidebar"], screenshot: "admin-home-dark" },
	{ words: ["users", "platform"], screenshot: "admin-users-dark" },
	{ words: ["theming", "tokens", "design-tokens", "brand", "branding", "typography", "motion"], screenshot: "admin-home-nord" },
	{ words: ["api-reference", "reference", "openapi"], screenshot: "docs-api-reference" },
	{ words: ["api", "http", "routes", "errors", "contracts", "zod", "fastify", "nestjs"], screenshot: "docs-endpoints-dark" },
	{ words: ["context", "map", "contexts", "ddd", "cqrs", "kernel"], screenshot: "docs-context-map" },
	{ words: ["architecture", "state", "machines", "folder", "structure", "system-design"], screenshot: "docs-architecture-dark" },
	{ words: ["notion", "docs-sync", "publishing", "documentation", "docs"], screenshot: "docs-home-dark" },
	{ words: ["routing", "nextjs", "ssr", "frontend", "web"], screenshot: "web-dashboard-dark" },
	{ words: ["getting", "started", "getting-started", "setup", "local-development", "forking", "tooling", "development"], screenshot: "docs-getting-started-dark" },
];

/** A folder's screen, for a guide no rule matches. */
const FOLDER_SCREENSHOTS: Readonly<Record<string, string>> = {
	adr: "docs-adr-dark",
	architecture: "docs-architecture",
	technical: "docs-docs-index",
	"user-guide": "docs-user-guide",
};
const DEFAULT_SCREENSHOT = "docs-home-dark";

/** The words a guide is about: its path's words (`technical/api/list-queries` → technical, api, list, queries, list-queries) and its tags. */
export function guideWords(slug: string, tags: readonly string[]): ReadonlySet<string> {
	const segments = slug.toLowerCase().split("/");
	return new Set([...segments, ...segments.flatMap((segment) => segment.split("-")), ...tags.map((tag) => tag.toLowerCase())]);
}

function firstMatch(rules: readonly ScreenshotRule[], words: ReadonlySet<string>): string | undefined {
	return rules.find((rule) => rule.words.some((word) => words.has(word)))?.screenshot;
}

/** Whether a screenshot is a phone screen (drawn in a phone frame, not a browser window). */
export function isPhoneScreenshot(screenshot: string): boolean {
	return screenshot.startsWith(MOBILE_PREFIX);
}

/** Every screenshot a cover can show, so a test can check each exists. */
export function coverScreenshotNames(): ReadonlySet<string> {
	return new Set([MOBILE_DEFAULT, DEFAULT_SCREENSHOT, ...Object.values(FOLDER_SCREENSHOTS), ...[...MOBILE_RULES, ...RULES].map((rule) => rule.screenshot)]);
}

/** The screenshot behind a guide's cover. */
export function coverScreenshot(slug: string, tags: readonly string[]): string {
	const words = guideWords(slug, tags);
	if (MOBILE_WORDS.some((word) => words.has(word))) {
		return firstMatch(MOBILE_RULES, words) ?? MOBILE_DEFAULT;
	}
	const [folder = ""] = slug.split("/");
	return firstMatch(RULES, words) ?? FOLDER_SCREENSHOTS[folder] ?? DEFAULT_SCREENSHOT;
}
