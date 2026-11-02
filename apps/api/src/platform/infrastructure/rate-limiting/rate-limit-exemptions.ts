// ============================================
// platform/infrastructure/rate-limiting/rate-limit-exemptions.ts — traffic counted but never refused
// ============================================
// ADR 071: a load test's own traffic (its live `X-Load-Test-Key`, ADR 068) and the addresses in
// `RATE_LIMIT_EXEMPT_CIDRS` (monitoring) are still counted, so the admin page shows them, but a
// policy never refuses them.

import { BlockList, isIPv6 } from "node:net";

import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { RateLimitExemptionEntry, RateLimitExemptionListPort } from "../../application/ports/rate-limit-insights.port";
import { TypedConfigService } from "../../../config/typed-config.service";
import { clientIpThrottleTracker } from "../http/client-ip";
import { LOAD_TEST_KEY_HEADER, LoadTestTrafficKeys } from "../throttling/load-test-traffic-keys";

/** One non-empty header value (a repeated header arrives as a list, and is ignored). */
const SingleHeaderSchema = z.string().min(1);
const CidrPartsSchema = z.tuple([z.string().min(1), z.coerce.number().int().nonnegative()]);
const HeadersSchema = z.object({ headers: z.record(z.string(), z.union([z.string(), z.array(z.string())]).optional()) });

export type RateLimitExemptionReason = "load-test" | "exempt-cidr";

@Injectable()
export class RateLimitExemptions implements RateLimitExemptionListPort {
	private readonly exemptAddresses: BlockList = new BlockList();
	private readonly exemptCidrs: readonly string[];

	public constructor(
		config: TypedConfigService,
		private readonly loadTestKeys: LoadTestTrafficKeys,
	) {
		this.exemptCidrs = config.rateLimits.exemptCidrs;
		for (const cidr of config.rateLimits.exemptCidrs) {
			const [address, prefix] = CidrPartsSchema.parse(cidr.split("/"));
			this.exemptAddresses.addSubnet(address, prefix, isIPv6(address) ? "ipv6" : "ipv4");
		}
	}

	/** Why the request is exempt, or `null` when every policy may refuse it. */
	public async reasonFor(request: object): Promise<RateLimitExemptionReason | null> {
		const headers = HeadersSchema.safeParse(request);
		const key = SingleHeaderSchema.safeParse(headers.success ? headers.data.headers[LOAD_TEST_KEY_HEADER] : undefined);
		if (key.success && (await this.loadTestKeys.isLive(key.data))) {
			return "load-test";
		}
		return this.isExemptAddress(clientIpThrottleTracker(request)) ? "exempt-cidr" : null;
	}

	/** What is exempt, for the admin page: live load-test runs always, and each configured range. */
	public list(): readonly RateLimitExemptionEntry[] {
		return [
			{ kind: "load-test", label: "Load Test tenant (a live run's key)" },
			...this.exemptCidrs.map((cidr: string): RateLimitExemptionEntry => ({ kind: "cidr", label: cidr })),
		];
	}

	public isExemptAddress(address: string): boolean {
		return this.exemptAddresses.check(address, isIPv6(address) ? "ipv6" : "ipv4");
	}
}
