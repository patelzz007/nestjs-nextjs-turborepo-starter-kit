// ============================================
// application/services/ops-server-view.ts — a stored server as the console shows it
// ============================================
// Pure mapping (no I/O): the record, its live sample, its open alerts and its cloud facts in; the
// shared contract shapes out.

import type { EpochMs, OpsCloudServerFacts, OpsServerDetail, OpsServerLive, OpsServerSummary } from "@workspace/shared";

import { AuthenticationError } from "../../../../platform/application/errors/app-error";
import type { ActorContext } from "../../../../platform/application/actor-context";
import { reporterHealth } from "../../domain/policies/health.policy";
import type { OpsServerRecord } from "../ports/operations-repositories.port";

const MS_PER_MINUTE = 60_000;

export function toServerSummary(server: OpsServerRecord, live: OpsServerLive | null, openAlerts: number, now: EpochMs, silentAfterMinutes: number): OpsServerSummary {
	return {
		id: server.id,
		name: server.name,
		provider: server.provider,
		providerServerId: server.providerServerId,
		health: reporterHealth(server.lastSeenAt, now, silentAfterMinutes * MS_PER_MINUTE),
		hostname: server.hostname,
		os: server.os,
		cpuModel: server.cpuModel,
		cpuCores: server.cpuCores,
		memoryTotalBytes: server.memoryTotalBytes,
		uptimeSeconds: server.uptimeSeconds,
		lastSeenAt: server.lastSeenAt,
		live,
		openAlerts,
	};
}

export function toServerDetail(
	server: OpsServerRecord,
	view: {
		readonly live: OpsServerLive | null;
		readonly openAlerts: number;
		readonly now: EpochMs;
		readonly silentAfterMinutes: number;
		readonly cloud: OpsCloudServerFacts | null;
		readonly cloudError: string | null;
	},
): OpsServerDetail {
	return {
		...toServerSummary(server, view.live, view.openAlerts, view.now, view.silentAfterMinutes),
		kernel: server.kernel,
		agentVersion: server.agentVersion,
		tokenPrefix: server.agentTokenPrefix,
		registeredAt: server.createdAt,
		cloud: view.cloud,
		cloudError: view.cloudError,
	};
}

/**
 * The command an operator runs on the server to start its agent with this token (the deployment
 * guide's Compose service; on a laptop `pnpm dev` starts it).
 */
export function agentInstallCommand(apiPublicUrl: string, token: string): string {
	return `OPS_API_URL=${apiPublicUrl} OPS_AGENT_TOKEN=${token} docker compose --profile agent up -d server-agent`;
}

/** The signed-in user an operations command acts for. */
export function actingUserIdOf(actor: ActorContext): string {
	if (actor.kind !== "user") {
		throw new AuthenticationError({ message: "A signed-in user is required for this action." });
	}
	return actor.userId;
}
