import { DYNAMIC_CONFIG_REGISTRY, FEATURE_FLAG_REGISTRY, type Exposure, type ExposureBatch, type ExposureBatchResult, type RolloutUnit } from "@workspace/shared";

import type { ExposureRecorder } from "../ports/exposure-recorder.port";
import type { SubjectFactsRegistry } from "./subject-facts.registry";

/** Who sent a batch, as the API knows it. */
export interface ExposureSender {
	readonly userId: string | null;
	readonly deviceId: string | null;
}

function unitOf(exposure: Exposure): RolloutUnit {
	return exposure.kind === "FLAG" ? FEATURE_FLAG_REGISTRY[exposure.key].rolloutUnit : DYNAMIC_CONFIG_REGISTRY[exposure.key].rolloutUnit;
}

function appsOf(exposure: Exposure): readonly string[] {
	return exposure.kind === "FLAG" ? FEATURE_FLAG_REGISTRY[exposure.key].apps : DYNAMIC_CONFIG_REGISTRY[exposure.key].apps;
}

/**
 * Takes a client's exposures (Phase B). Each is attributed to the subject of its flag's rollout unit as the API
 * knows it: the session's person, the device id, or a store the person works at. A signed-out sender counts only
 * for device-unit flags; an exposure without its subject, or of a flag the app never receives, is ignored.
 */
export class ExposureIntakeService {
	public constructor(
		private readonly recorder: ExposureRecorder,
		private readonly facts: SubjectFactsRegistry,
	) {}

	public async intake(sender: ExposureSender, batch: ExposureBatch): Promise<ExposureBatchResult> {
		const store = await this.verifiedStore(sender.userId, batch.tenantId ?? null, batch.locationId ?? null);
		const ids: Readonly<Record<RolloutUnit, string | null>> = {
			USER: sender.userId,
			DEVICE: sender.deviceId,
			TENANT: store.tenantId,
			LOCATION: store.locationId,
		};
		const accepted = batch.exposures.flatMap((exposure) => {
			const subjectUnit = unitOf(exposure);
			const subjectId = ids[subjectUnit];
			const signedOutOnlyDevice = sender.userId !== null || subjectUnit === "DEVICE";
			return subjectId !== null && signedOutOnlyDevice && appsOf(exposure).includes(batch.app) ? [{ ...exposure, subjectUnit, subjectId }] : [];
		});
		if (accepted.length > 0) {
			await this.recorder.record({ app: batch.app, exposures: accepted });
		}
		return { accepted: accepted.length, ignored: batch.exposures.length - accepted.length };
	}

	private async verifiedStore(
		userId: string | null,
		tenantId: string | null,
		locationId: string | null,
	): Promise<{ readonly tenantId: string | null; readonly locationId: string | null }> {
		if (userId === null || tenantId === null || !(await this.facts.worksAt(userId, tenantId, locationId))) {
			return { tenantId: null, locationId: null };
		}
		return { tenantId, locationId };
	}
}
