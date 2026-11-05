/** Whether an endpoint's address may be registered. */
export type WebhookUrlCheck = { readonly ok: true } | { readonly ok: false; readonly reason: string; readonly message: string };

/**
 * The endpoint address rule (ADR 082): HTTPS, no credentials in the URL, and a host that is not this network
 * (loopback, private and link-local addresses are refused; loopback only where `WEBHOOK_ALLOW_LOOPBACK_URLS`
 * allows it, never in production). Checked when the URL is set, and again by the sender at every connection
 * (DNS can change).
 */
export interface WebhookUrlPolicyPort {
	check(url: string): WebhookUrlCheck;
}
