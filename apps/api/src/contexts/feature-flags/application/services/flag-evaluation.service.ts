import {
	dynamicConfigKeysFor,
	epochMs,
	FEATURE_FLAG_REGISTRY,
	featureFlagKeysFor,
	type AppLanguage,
	type BundleApp,
	type ClientPlatform,
	type ConfigCheckResult,
	type DeploymentEnvironment,
	type DynamicConfigKey,
	type FeatureFlagBundle,
	type FeatureFlagKey,
	type FlagApp,
	type FlagCheckResult,
	type SubjectContext,
} from "@workspace/shared";

import type { Clock } from "../../../../platform/application/clock.port";
import type { CatalogIndex } from "../../domain/catalog/catalog-index";
import { unitIdOf, type EvaluationSubject } from "../../domain/evaluation/evaluation-subject";
import { evaluateConfig, evaluateFlag, nextChangeAt, requiredAttributes } from "../../domain/evaluation/flag-evaluator";
import type { FeatureFlags, FlagCheckSubject } from "../ports/feature-flags.port";
import type { FlagCatalogSource } from "../ports/flag-catalog.port";
import type { ServerExposures } from "../ports/server-exposures.port";
import type { SubjectFactsRegistry } from "./subject-facts.registry";

/** A bundle request as the API resolved it: the person from the session, the store only once verified. */
export interface BundleRequest {
	readonly app: BundleApp;
	readonly userId: string | null;
	/** The store the client asked for; used only when the person works there. */
	readonly tenantId: string | null;
	readonly locationId: string | null;
	readonly deviceId: string | null;
	readonly platform: ClientPlatform | null;
	readonly appVersion: string | null;
	readonly locale: AppLanguage | null;
}

interface SubjectInput {
	readonly userId: string | null;
	readonly tenantId: string | null;
	readonly locationId: string | null;
	readonly deviceId: string | null;
	readonly app: FlagApp;
	readonly platform: ClientPlatform | null;
	readonly appVersion: string | null;
	readonly locale: AppLanguage | null;
}

/**
 * Every flag and config decision (ADR 087): an app's bundle, the API's own checks (`FeatureFlags`) and the
 * console's "Check a subject". Reads the cached catalogue; looks up a person's facts only when a rule reads them.
 */
export class FlagEvaluationService implements FeatureFlags {
	public constructor(
		private readonly catalog: FlagCatalogSource,
		private readonly facts: SubjectFactsRegistry,
		private readonly exposures: ServerExposures,
		private readonly clock: Clock,
		private readonly environment: DeploymentEnvironment,
	) {}

	public async bundle(request: BundleRequest): Promise<FeatureFlagBundle> {
		const index = await this.catalog.current();
		const store = await this.verifiedStore(request);
		const flags = featureFlagKeysFor(request.app);
		const configs = dynamicConfigKeysFor(request.app);
		const subject = await this.subject(index, { ...request, ...store }, flags, configs);
		const next = nextChangeAt(index, flags, configs, subject.now);
		return {
			version: index.version,
			app: request.app,
			evaluatedAt: epochMs(subject.now),
			nextChangeAt: next === null ? null : epochMs(next),
			flags: flags.map((key) => evaluateFlag(key, index, subject).result),
			configs: configs.map((key) => evaluateConfig(key, index, subject).result),
		};
	}

	public async isOn(key: FeatureFlagKey, check: FlagCheckSubject): Promise<boolean> {
		const index = await this.catalog.current();
		const subject = await this.subject(index, { ...check, deviceId: null, app: "api", platform: null, appVersion: null, locale: null }, [key], []);
		const { result } = evaluateFlag(key, index, subject);
		const unit = FEATURE_FLAG_REGISTRY[key].rolloutUnit;
		const subjectId = unitIdOf(subject, unit);
		if (subjectId !== null) {
			this.exposures.note({ kind: "FLAG", ...result, at: epochMs(subject.now), subjectUnit: unit, subjectId });
		}
		return result.on;
	}

	public async checkFlag(key: FeatureFlagKey, context: SubjectContext): Promise<FlagCheckResult> {
		const index = await this.catalog.current();
		const subject = await this.subject(index, context, [key], []);
		const decision = evaluateFlag(key, index, subject);
		return { result: decision.result, trace: [...decision.trace] };
	}

	public async checkConfig(key: DynamicConfigKey, context: SubjectContext): Promise<ConfigCheckResult> {
		const index = await this.catalog.current();
		const subject = await this.subject(index, context, [], [key]);
		const decision = evaluateConfig(key, index, subject);
		return { result: decision.result, trace: [...decision.trace] };
	}

	/** The asked-for store when the person works there; otherwise none (a signed-out visitor never has one). */
	private async verifiedStore(request: BundleRequest): Promise<{ readonly tenantId: string | null; readonly locationId: string | null }> {
		if (request.userId === null || request.tenantId === null) {
			return { tenantId: null, locationId: null };
		}
		const works = await this.facts.worksAt(request.userId, request.tenantId, request.locationId);
		return works ? { tenantId: request.tenantId, locationId: request.locationId } : { tenantId: null, locationId: null };
	}

	private async subject(index: CatalogIndex, input: SubjectInput, flags: readonly FeatureFlagKey[], configs: readonly DynamicConfigKey[]): Promise<EvaluationSubject> {
		const facts = await this.facts.resolve(input.userId, requiredAttributes(index, flags, configs));
		return { ...input, environment: this.environment, now: this.clock.now(), facts };
	}
}
