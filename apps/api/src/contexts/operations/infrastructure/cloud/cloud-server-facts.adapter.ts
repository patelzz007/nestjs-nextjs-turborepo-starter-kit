// ============================================
// infrastructure/cloud/cloud-server-facts.adapter.ts — the generic cloud-provider adapter
// ============================================
// Design patterns:
//   - TEMPLATE METHOD: `factsOf` is the one algorithm every provider shares — authenticate, GET the
//     server, validate the answer with zod (never trust a third-party response), map it to the one
//     `OpsCloudServerFacts` shape. A provider subclass supplies only its URL, its wire schema and
//     its mapping (Open/Closed: adding a provider adds a subclass, nothing here changes).
//   - Liskov: every subclass is usable wherever a `CloudServerFactsAdapter` is.

import { epochMs, type EpochMs, type OpsCloudProvider, type OpsCloudServerFacts } from "@workspace/shared";
import type { z } from "zod";

import type { CloudServerFactsResult } from "../../application/ports/cloud-server-facts.port";

/** How long one provider call may take before it counts as failed. */
export const CLOUD_API_TIMEOUT_MS = 5_000;

/** The fetch the adapters call — `globalThis.fetch` in production, a fake in tests. */
export type CloudFetch = (
	url: string,
	init: { readonly headers: Readonly<Record<string, string>>; readonly signal: AbortSignal },
) => Promise<Pick<Response, "ok" | "status" | "json">>;

/** Epoch ms of an ISO-8601 timestamp, or `null` when the provider sent something unparsable. */
export function epochOfIso(value: string): EpochMs | null {
	const parsed: number = Date.parse(value);
	return Number.isNaN(parsed) || parsed < 0 ? null : epochMs(parsed);
}

export abstract class CloudServerFactsAdapter<Wire extends z.ZodType> {
	public abstract readonly provider: OpsCloudProvider;
	/** The provider's server-detail URL for one id. */
	protected abstract urlOf(providerServerId: string): string;
	/** The provider's answer, as far as this adapter reads it. */
	protected abstract readonly wireSchema: Wire;
	/** The provider's answer mapped to the shared shape. */
	protected abstract toFacts(wire: z.output<Wire>): OpsCloudServerFacts;

	public constructor(
		private readonly token: string,
		private readonly fetchImpl: CloudFetch,
	) {}

	/** The template method: never throws — every failure is `unavailable`, with a reason an operator can act on. */
	public async factsOf(providerServerId: string): Promise<CloudServerFactsResult> {
		try {
			const response = await this.fetchImpl(this.urlOf(encodeURIComponent(providerServerId)), {
				headers: { Authorization: `Bearer ${this.token}`, Accept: "application/json" },
				signal: AbortSignal.timeout(CLOUD_API_TIMEOUT_MS),
			});
			if (!response.ok) {
				return { kind: "unavailable", reason: `${this.provider} answered ${String(response.status)} for server ${providerServerId}` };
			}
			const parsed = this.wireSchema.safeParse(await response.json());
			if (!parsed.success) {
				return { kind: "unavailable", reason: `${this.provider} sent an answer this console does not understand` };
			}
			return { kind: "facts", facts: this.toFacts(parsed.data) };
		} catch (error) {
			return { kind: "unavailable", reason: `${this.provider} could not be reached: ${error instanceof Error ? error.message : String(error)}` };
		}
	}
}
