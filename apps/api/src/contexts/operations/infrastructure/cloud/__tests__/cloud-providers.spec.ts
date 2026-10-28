import type { JsonValue } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import type { CloudServerFactsResult } from "../../../application/ports/cloud-server-facts.port";
import { DigitalOceanServerFacts, HetznerServerFacts, LinodeServerFacts, VultrServerFacts } from "../cloud-providers";
import { type CloudFetch, epochOfIso } from "../cloud-server-facts.adapter";
import { adapterFor, CLOUD_FACTS_CACHE_MS, CloudServerFactsRegistry } from "../cloud-server-facts.registry";

const CREATED = "2026-01-02T03:04:05Z";

interface Call {
	readonly url: string;
	readonly authorization: string | undefined;
}

/** A fetch that answers `body` with `status` and records each call. */
function fakeFetch(body: JsonValue, status = 200): { readonly fetch: CloudFetch; readonly calls: Call[] } {
	const calls: Call[] = [];
	const fetch: CloudFetch = (url, init) => {
		calls.push({ url, authorization: init.headers.Authorization });
		return Promise.resolve({ ok: status >= 200 && status < 300, status, json: (): Promise<JsonValue> => Promise.resolve(body) });
	};
	return { fetch, calls };
}

/** The reason of an unavailable answer ("" for facts). */
function reasonOf(result: CloudServerFactsResult): string {
	return result.kind === "unavailable" ? result.reason : "";
}

describe("epochOfIso", () => {
	it("reads an ISO time, and null for nonsense", () => {
		expect(epochOfIso(CREATED)).toBe(Date.parse(CREATED));
		expect(epochOfIso("yesterday")).toBeNull();
	});
});

describe("cloud adapters", () => {
	it("maps a DigitalOcean droplet, calling its API with the token", async () => {
		const { fetch, calls } = fakeFetch({
			droplet: {
				name: "web-01",
				status: "active",
				vcpus: 4,
				memory: 8_192,
				disk: 160,
				created_at: CREATED,
				size_slug: "s-4vcpu-8gb",
				region: { slug: "sgp1" },
				networks: {
					v4: [
						{ ip_address: "10.0.0.2", type: "private" },
						{ ip_address: "203.0.113.5", type: "public" },
					],
				},
			},
		});

		const result = await new DigitalOceanServerFacts("do-token", fetch).factsOf("512345678");

		expect(calls).toEqual([{ url: "https://api.digitalocean.com/v2/droplets/512345678", authorization: "Bearer do-token" }]);
		expect(result).toEqual({
			kind: "facts",
			facts: {
				provider: "DIGITALOCEAN",
				name: "web-01",
				region: "sgp1",
				plan: "s-4vcpu-8gb",
				vcpus: 4,
				memoryMb: 8_192,
				diskGb: 160,
				status: "active",
				running: true,
				publicIpv4: "203.0.113.5",
				createdAt: Date.parse(CREATED),
			},
		});
	});

	it("maps a Linode instance (disk in MB)", async () => {
		const { fetch } = fakeFetch({
			label: "web-02",
			region: "ap-south",
			type: "g6-standard-2",
			status: "running",
			created: CREATED,
			ipv4: ["198.51.100.7"],
			specs: { vcpus: 2, memory: 4_096, disk: 81_920 },
		});

		expect(await new LinodeServerFacts("t", fetch).factsOf("1")).toMatchObject({
			kind: "facts",
			facts: { provider: "LINODE", diskGb: 80, memoryMb: 4_096, running: true, publicIpv4: "198.51.100.7" },
		});
	});

	it("maps a Vultr instance, treating 0.0.0.0 as no address", async () => {
		const { fetch } = fakeFetch({
			instance: {
				label: "w3",
				region: "sgp",
				plan: "vc2-1c-2gb",
				status: "active",
				power_status: "stopped",
				vcpu_count: 1,
				ram: 2_048,
				disk: 55,
				main_ip: "0.0.0.0",
				date_created: CREATED,
			},
		});

		expect(await new VultrServerFacts("t", fetch).factsOf("abc")).toMatchObject({
			kind: "facts",
			facts: { provider: "VULTR", status: "active / stopped", running: false, publicIpv4: null },
		});
	});

	it("maps a Hetzner server (memory in GB)", async () => {
		const { fetch } = fakeFetch({
			server: {
				name: "w4",
				status: "running",
				created: CREATED,
				server_type: { name: "cx22", cores: 2, memory: 4, disk: 40 },
				datacenter: { location: { name: "fsn1" } },
				public_net: { ipv4: null },
			},
		});

		expect(await new HetznerServerFacts("t", fetch).factsOf("9")).toMatchObject({
			kind: "facts",
			facts: { provider: "HETZNER", memoryMb: 4_096, region: "fsn1", publicIpv4: null },
		});
	});

	it("never throws: an error status, an unknown answer or a network failure is a reason", async () => {
		expect(await new DigitalOceanServerFacts("t", fakeFetch({}, 404).fetch).factsOf("1")).toEqual({ kind: "unavailable", reason: "DIGITALOCEAN answered 404 for server 1" });
		expect(reasonOf(await new DigitalOceanServerFacts("t", fakeFetch({ nope: true }).fetch).factsOf("1"))).toContain("does not understand");
		const failing: CloudFetch = () => Promise.reject(new Error("ENOTFOUND"));
		expect(reasonOf(await new DigitalOceanServerFacts("t", failing).factsOf("1"))).toContain("ENOTFOUND");
	});

	it("escapes the provider id in the URL", async () => {
		const { fetch, calls } = fakeFetch({}, 404);
		await new HetznerServerFacts("t", fetch).factsOf("../servers");

		expect(calls.at(0)?.url).toBe("https://api.hetzner.cloud/v1/servers/..%2Fservers");
	});
});

describe("CloudServerFactsRegistry", () => {
	it("builds the adapter of each provider", () => {
		const { fetch } = fakeFetch({});
		expect(adapterFor("DIGITALOCEAN", "t", fetch)).toBeInstanceOf(DigitalOceanServerFacts);
		expect(adapterFor("LINODE", "t", fetch)).toBeInstanceOf(LinodeServerFacts);
		expect(adapterFor("VULTR", "t", fetch)).toBeInstanceOf(VultrServerFacts);
		expect(adapterFor("HETZNER", "t", fetch)).toBeInstanceOf(HetznerServerFacts);
	});

	it("configures only the providers that have a token, and explains the others", async () => {
		const registry = CloudServerFactsRegistry.fromTokens({ DIGITALOCEAN: "t", LINODE: null, VULTR: null, HETZNER: "h" }, fakeFetch({}, 500).fetch);

		expect(registry.configuredProviders()).toEqual(["DIGITALOCEAN", "HETZNER"]);
		expect(await registry.factsOf("LINODE", "1")).toEqual({ kind: "unavailable", reason: "No LINODE API token is configured on this deployment" });
	});

	it("reuses an answer for a minute, then asks again", async () => {
		let now = 0;
		let calls = 0;
		const reader = {
			factsOf: (): Promise<{ kind: "unavailable"; reason: string }> => {
				calls += 1;
				return Promise.resolve({ kind: "unavailable", reason: String(calls) });
			},
		};
		const registry = new CloudServerFactsRegistry(new Map([["VULTR", reader]]), () => now);

		await registry.factsOf("VULTR", "a");
		now = CLOUD_FACTS_CACHE_MS - 1;
		await registry.factsOf("VULTR", "a");
		expect(calls).toBe(1);
		now = CLOUD_FACTS_CACHE_MS;
		expect(await registry.factsOf("VULTR", "a")).toEqual({ kind: "unavailable", reason: "2" });
	});
});
