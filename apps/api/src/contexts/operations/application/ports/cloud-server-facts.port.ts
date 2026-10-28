// ============================================
// application/ports/cloud-server-facts.port.ts — a cloud provider's view of one server
// ============================================
// Dependency Inversion: the application asks for "the facts of server X at provider P"; which HTTP
// API answers (DigitalOcean, Linode, Vultr, Hetzner) is an infrastructure detail behind this port.

import type { OpsCloudProvider, OpsCloudServerFacts } from "@workspace/shared";

/** The provider's facts, or why there are none (no token configured, or the provider's API failed). */
export type CloudServerFactsResult = { readonly kind: "facts"; readonly facts: OpsCloudServerFacts } | { readonly kind: "unavailable"; readonly reason: string };

export interface CloudServerFactsPort {
	/** The clouds whose API token is configured here. */
	configuredProviders(): readonly OpsCloudProvider[];
	/** One server's facts as its provider describes them. Never throws: a failure is `unavailable`. */
	factsOf(provider: OpsCloudProvider, providerServerId: string): Promise<CloudServerFactsResult>;
}

export const CLOUD_SERVER_FACTS = Symbol("CLOUD_SERVER_FACTS");
