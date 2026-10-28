// ============================================
// infrastructure/cloud/cloud-providers.ts — DigitalOcean, Linode, Vultr and Hetzner
// ============================================
// Each class is one provider's specifics for the generic `CloudServerFactsAdapter` (Template Method):
// its URL, the part of its answer we read, and the mapping. Units are normalised here: memory in MB,
// disk in GB, whatever the provider sends.

import type { OpsCloudServerFacts } from "@workspace/shared";
import { z } from "zod";

import { CloudServerFactsAdapter, epochOfIso } from "./cloud-server-facts.adapter";

const MB_PER_GB = 1_024;
const RUNNING_STATUSES: ReadonlySet<string> = new Set(["active", "running"]);

/** `GET https://api.digitalocean.com/v2/droplets/{id}` — memory in MB, disk in GB. */
const DigitalOceanDropletSchema = z.object({
	droplet: z.object({
		name: z.string(),
		status: z.string(),
		vcpus: z.number().int().nonnegative(),
		memory: z.number().nonnegative(),
		disk: z.number().nonnegative(),
		created_at: z.string(),
		size_slug: z.string(),
		region: z.object({ slug: z.string() }),
		networks: z.object({ v4: z.array(z.object({ ip_address: z.string(), type: z.string() })) }),
	}),
});

export class DigitalOceanServerFacts extends CloudServerFactsAdapter<typeof DigitalOceanDropletSchema> {
	public readonly provider = "DIGITALOCEAN";
	protected readonly wireSchema = DigitalOceanDropletSchema;

	protected urlOf(id: string): string {
		return `https://api.digitalocean.com/v2/droplets/${id}`;
	}

	protected toFacts({ droplet }: z.output<typeof DigitalOceanDropletSchema>): OpsCloudServerFacts {
		return {
			provider: this.provider,
			name: droplet.name,
			region: droplet.region.slug,
			plan: droplet.size_slug,
			vcpus: droplet.vcpus,
			memoryMb: Math.round(droplet.memory),
			diskGb: Math.round(droplet.disk),
			status: droplet.status,
			running: RUNNING_STATUSES.has(droplet.status),
			publicIpv4: droplet.networks.v4.find((network) => network.type === "public")?.ip_address ?? null,
			createdAt: epochOfIso(droplet.created_at),
		};
	}
}

/** `GET https://api.linode.com/v4/linode/instances/{id}` — memory and disk both in MB. */
const LinodeInstanceSchema = z.object({
	label: z.string(),
	region: z.string(),
	type: z.string(),
	status: z.string(),
	created: z.string(),
	ipv4: z.array(z.string()),
	specs: z.object({ vcpus: z.number().int().nonnegative(), memory: z.number().nonnegative(), disk: z.number().nonnegative() }),
});

export class LinodeServerFacts extends CloudServerFactsAdapter<typeof LinodeInstanceSchema> {
	public readonly provider = "LINODE";
	protected readonly wireSchema = LinodeInstanceSchema;

	protected urlOf(id: string): string {
		return `https://api.linode.com/v4/linode/instances/${id}`;
	}

	protected toFacts(linode: z.output<typeof LinodeInstanceSchema>): OpsCloudServerFacts {
		const [publicIpv4 = null] = linode.ipv4;
		return {
			provider: this.provider,
			name: linode.label,
			region: linode.region,
			plan: linode.type,
			vcpus: linode.specs.vcpus,
			memoryMb: Math.round(linode.specs.memory),
			diskGb: Math.round(linode.specs.disk / MB_PER_GB),
			status: linode.status,
			running: RUNNING_STATUSES.has(linode.status),
			publicIpv4,
			createdAt: epochOfIso(linode.created),
		};
	}
}

/** `GET https://api.vultr.com/v2/instances/{id}` — RAM in MB, disk in GB. */
const VultrInstanceSchema = z.object({
	instance: z.object({
		label: z.string(),
		region: z.string(),
		plan: z.string(),
		status: z.string(),
		power_status: z.string(),
		vcpu_count: z.number().int().nonnegative(),
		ram: z.number().nonnegative(),
		disk: z.number().nonnegative(),
		main_ip: z.string(),
		date_created: z.string(),
	}),
});

export class VultrServerFacts extends CloudServerFactsAdapter<typeof VultrInstanceSchema> {
	public readonly provider = "VULTR";
	protected readonly wireSchema = VultrInstanceSchema;

	protected urlOf(id: string): string {
		return `https://api.vultr.com/v2/instances/${id}`;
	}

	protected toFacts({ instance }: z.output<typeof VultrInstanceSchema>): OpsCloudServerFacts {
		return {
			provider: this.provider,
			name: instance.label,
			region: instance.region,
			plan: instance.plan,
			vcpus: instance.vcpu_count,
			memoryMb: Math.round(instance.ram),
			diskGb: Math.round(instance.disk),
			status: `${instance.status} / ${instance.power_status}`,
			running: instance.status === "active" && instance.power_status === "running",
			publicIpv4: instance.main_ip === "0.0.0.0" ? null : instance.main_ip,
			createdAt: epochOfIso(instance.date_created),
		};
	}
}

/** `GET https://api.hetzner.cloud/v1/servers/{id}` — memory in GB (may be fractional), disk in GB. */
const HetznerServerSchema = z.object({
	server: z.object({
		name: z.string(),
		status: z.string(),
		created: z.string(),
		server_type: z.object({ name: z.string(), cores: z.number().int().nonnegative(), memory: z.number().nonnegative(), disk: z.number().nonnegative() }),
		datacenter: z.object({ location: z.object({ name: z.string() }) }),
		public_net: z.object({ ipv4: z.object({ ip: z.string() }).nullable() }),
	}),
});

export class HetznerServerFacts extends CloudServerFactsAdapter<typeof HetznerServerSchema> {
	public readonly provider = "HETZNER";
	protected readonly wireSchema = HetznerServerSchema;

	protected urlOf(id: string): string {
		return `https://api.hetzner.cloud/v1/servers/${id}`;
	}

	protected toFacts({ server }: z.output<typeof HetznerServerSchema>): OpsCloudServerFacts {
		return {
			provider: this.provider,
			name: server.name,
			region: server.datacenter.location.name,
			plan: server.server_type.name,
			vcpus: server.server_type.cores,
			memoryMb: Math.round(server.server_type.memory * MB_PER_GB),
			diskGb: Math.round(server.server_type.disk),
			status: server.status,
			running: RUNNING_STATUSES.has(server.status),
			publicIpv4: server.public_net.ipv4?.ip ?? null,
			createdAt: epochOfIso(server.created),
		};
	}
}
