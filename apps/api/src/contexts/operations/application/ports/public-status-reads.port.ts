import type { EpochMs } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { StatusIncidentRecord } from "./status-incident.repository.port";

/** The public status page's incidents, read under `operations.status.public_read` (never naming who posted). */
export interface PublicStatusReads {
	incidents(actor: ActorContext, resolvedSince: EpochMs): Promise<readonly StatusIncidentRecord[]>;
}

export const PUBLIC_STATUS_READS = Symbol("PUBLIC_STATUS_READS");
