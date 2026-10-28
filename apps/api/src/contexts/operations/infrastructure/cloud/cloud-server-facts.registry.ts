// ============================================
// infrastructure/cloud/cloud-server-facts.registry.ts — one adapter per configured cloud
// ============================================
// Design patterns:
//   - STRATEGY + REGISTRY: the provider picks the adapter; the application sees one port.
//   - FACTORY: `fromTokens` builds an adapter for every provider that has a token, so a provider
//     without one is simply "not configured" (never a half-working client). Adding a provider adds
//     one case to `adapterFor` (Open/Closed).
//   - Short in-memory cache: the detail page polls every 10 s; provider APIs are rate limited.

import { OpsCloudProviderSchema, type OpsCloudProvider } from "@workspace/shared";

import type { CloudServerFactsPort, CloudServerFactsResult } from "../../application/ports/cloud-server-facts.port";
import type { CloudFetch } from "./cloud-server-facts.adapter";
import { DigitalOceanServerFacts, HetznerServerFacts, LinodeServerFacts, VultrServerFacts } from "./cloud-providers";

/** How long one provider answer is reused. */
export const CLOUD_FACTS_CACHE_MS = 60_000;

/** What the registry needs of an adapter (Interface Segregation: just the call). */
export interface CloudServerFactsReader {
	factsOf(providerServerId: string): Promise<CloudServerFactsResult>;
}

/** Builds one provider's adapter from its token (adding a provider adds one case). */
export function adapterFor(provider: OpsCloudProvider, token: string, fetchImpl: CloudFetch): CloudServerFactsReader {
	switch (provider) {
		case "DIGITALOCEAN":
			return new DigitalOceanServerFacts(token, fetchImpl);
		case "LINODE":
			return new LinodeServerFacts(token, fetchImpl);
		case "VULTR":
			return new VultrServerFacts(token, fetchImpl);
		case "HETZNER":
			return new HetznerServerFacts(token, fetchImpl);
	}
}

export class CloudServerFactsRegistry implements CloudServerFactsPort {
	private readonly cache = new Map<string, { readonly at: number; readonly result: CloudServerFactsResult }>();

	public constructor(
		private readonly adapters: ReadonlyMap<OpsCloudProvider, CloudServerFactsReader>,
		private readonly now: () => number = Date.now,
	) {}

	/** An adapter for every provider whose token is set. */
	public static fromTokens(tokens: Readonly<Record<OpsCloudProvider, string | null>>, fetchImpl: CloudFetch): CloudServerFactsRegistry {
		const adapters = new Map<OpsCloudProvider, CloudServerFactsReader>();
		for (const provider of OpsCloudProviderSchema.options) {
			const token: string | null = tokens[provider];
			if (token !== null) {
				adapters.set(provider, adapterFor(provider, token, fetchImpl));
			}
		}
		return new CloudServerFactsRegistry(adapters);
	}

	public configuredProviders(): readonly OpsCloudProvider[] {
		return OpsCloudProviderSchema.options.filter((provider) => this.adapters.has(provider));
	}

	public async factsOf(provider: OpsCloudProvider, providerServerId: string): Promise<CloudServerFactsResult> {
		const adapter: CloudServerFactsReader | undefined = this.adapters.get(provider);
		if (adapter === undefined) {
			return { kind: "unavailable", reason: `No ${provider} API token is configured on this deployment` };
		}
		const key = `${provider}:${providerServerId}`;
		const cached = this.cache.get(key);
		if (cached !== undefined && this.now() - cached.at < CLOUD_FACTS_CACHE_MS) {
			return cached.result;
		}
		const result: CloudServerFactsResult = await adapter.factsOf(providerServerId);
		this.cache.set(key, { at: this.now(), result });
		return result;
	}
}
