// API contract leaves owned by the `feature-flags` context (feature flags v2). Composed into `apiContract`.

import { z } from "zod";

import { defineContract } from "../../contracts/define-contract";
import { paginatedResponse, singleResponse } from "../../contracts/response";
import { OkResponseSchema } from "../../schemas/api/message";
import { featureFlagsRoutes } from "./routes";
import {
	CheckConfigInputSchema,
	CheckFlagInputSchema,
	ConfigCheckResultSchema,
	DecideConfigRevisionInputSchema,
	DecideFlagRevisionInputSchema,
	DynamicConfigDetailSchema,
	DynamicConfigPathSchema,
	DynamicConfigSummaryListSchema,
	FeatureFlagDetailSchema,
	FeatureFlagEnvironmentSchema,
	FeatureFlagPathSchema,
	FeatureFlagSummaryListSchema,
	FlagCheckResultSchema,
	FlagOverrideSchema,
	FlagSubjectOptionListSchema,
	FlagSubjectSearchQuerySchema,
	RemoveFlagOverrideInputSchema,
	RevisionListSchema,
	RevisionSchema,
	SaveConfigRevisionInputSchema,
	SaveFlagRevisionInputSchema,
	SetFlagOverrideInputSchema,
	SetKillSwitchInputSchema,
	KillSwitchStateSchema,
} from "./schemas/admin";
import { ExposureBatchResultSchema, ExposureBatchSchema, FeatureFlagBundleQuerySchema, FeatureFlagBundleSchema } from "./schemas/bundle";
import {
	CreateExperimentSchema,
	ExperimentDetailSchema,
	ExperimentListSchema,
	ExperimentMetricOptionListSchema,
	ExperimentPathSchema,
	StartExperimentInputSchema,
	StopExperimentInputSchema,
	UpdateExperimentInputSchema,
} from "./schemas/experiments";
import {
	ChangeFlagGroupMembersInputSchema,
	ChangeFlagGroupMembersResultSchema,
	CreateFlagGroupSchema,
	FlagGroupListSchema,
	FlagGroupMemberListInputSchema,
	FlagGroupMemberSchema,
	FlagGroupPathSchema,
	FlagGroupSchema,
	RemoveFlagGroupInputSchema,
	UpdateFlagGroupInputSchema,
} from "./schemas/flag-groups";
import { PromotionExportQuerySchema, PromotionFileSchema, PromotionImportInputSchema, PromotionPreviewInputSchema, PromotionPreviewSchema } from "./schemas/promotion";

export const featureFlagsContract = {
	bundle: defineContract({
		access: "public",
		method: "GET",
		path: featureFlagsRoutes.bundle,
		input: FeatureFlagBundleQuerySchema,
		response: singleResponse(FeatureFlagBundleSchema),
	}),
	exposures: defineContract({
		access: "public",
		method: "POST",
		path: featureFlagsRoutes.exposures,
		input: ExposureBatchSchema,
		response: singleResponse(ExposureBatchResultSchema),
	}),

	list: defineContract({ method: "GET", path: featureFlagsRoutes.list, input: z.undefined(), response: singleResponse(FeatureFlagSummaryListSchema) }),
	environment: defineContract({ method: "GET", path: featureFlagsRoutes.environment, input: z.undefined(), response: singleResponse(FeatureFlagEnvironmentSchema) }),
	subjects: defineContract({ method: "GET", path: featureFlagsRoutes.subjects, input: FlagSubjectSearchQuerySchema, response: singleResponse(FlagSubjectOptionListSchema) }),
	detail: defineContract({ method: "GET", path: featureFlagsRoutes.flag, input: FeatureFlagPathSchema, response: singleResponse(FeatureFlagDetailSchema) }),
	revisions: defineContract({ method: "GET", path: featureFlagsRoutes.revisions, input: FeatureFlagPathSchema, response: singleResponse(RevisionListSchema) }),
	saveRevision: defineContract({ method: "POST", path: featureFlagsRoutes.revisions, input: SaveFlagRevisionInputSchema, response: singleResponse(RevisionSchema) }),
	decideRevision: defineContract({
		method: "POST",
		path: featureFlagsRoutes.revisionDecision,
		input: DecideFlagRevisionInputSchema,
		response: singleResponse(RevisionSchema),
	}),
	setKillSwitch: defineContract({ method: "PUT", path: featureFlagsRoutes.killSwitch, input: SetKillSwitchInputSchema, response: singleResponse(KillSwitchStateSchema) }),
	setOverride: defineContract({ method: "PUT", path: featureFlagsRoutes.overrides, input: SetFlagOverrideInputSchema, response: singleResponse(FlagOverrideSchema) }),
	removeOverride: defineContract({
		method: "POST",
		path: featureFlagsRoutes.removeOverride,
		input: RemoveFlagOverrideInputSchema,
		response: singleResponse(OkResponseSchema),
	}),
	check: defineContract({ method: "POST", path: featureFlagsRoutes.check, input: CheckFlagInputSchema, response: singleResponse(FlagCheckResultSchema) }),

	configs: defineContract({ method: "GET", path: featureFlagsRoutes.configs, input: z.undefined(), response: singleResponse(DynamicConfigSummaryListSchema) }),
	config: defineContract({ method: "GET", path: featureFlagsRoutes.config, input: DynamicConfigPathSchema, response: singleResponse(DynamicConfigDetailSchema) }),
	configRevisions: defineContract({ method: "GET", path: featureFlagsRoutes.configRevisions, input: DynamicConfigPathSchema, response: singleResponse(RevisionListSchema) }),
	saveConfigRevision: defineContract({
		method: "POST",
		path: featureFlagsRoutes.configRevisions,
		input: SaveConfigRevisionInputSchema,
		response: singleResponse(RevisionSchema),
	}),
	decideConfigRevision: defineContract({
		method: "POST",
		path: featureFlagsRoutes.configRevisionDecision,
		input: DecideConfigRevisionInputSchema,
		response: singleResponse(RevisionSchema),
	}),
	checkConfig: defineContract({ method: "POST", path: featureFlagsRoutes.configCheck, input: CheckConfigInputSchema, response: singleResponse(ConfigCheckResultSchema) }),

	groups: defineContract({ method: "GET", path: featureFlagsRoutes.groups, input: z.undefined(), response: singleResponse(FlagGroupListSchema) }),
	group: defineContract({ method: "GET", path: featureFlagsRoutes.group, input: FlagGroupPathSchema, response: singleResponse(FlagGroupSchema) }),
	createGroup: defineContract({ method: "POST", path: featureFlagsRoutes.groups, input: CreateFlagGroupSchema, response: singleResponse(FlagGroupSchema) }),
	updateGroup: defineContract({ method: "PUT", path: featureFlagsRoutes.group, input: UpdateFlagGroupInputSchema, response: singleResponse(FlagGroupSchema) }),
	removeGroup: defineContract({ method: "POST", path: featureFlagsRoutes.removeGroup, input: RemoveFlagGroupInputSchema, response: singleResponse(OkResponseSchema) }),
	groupMembers: defineContract({
		method: "GET",
		path: featureFlagsRoutes.groupMembers,
		input: FlagGroupMemberListInputSchema,
		response: paginatedResponse(FlagGroupMemberSchema),
	}),
	changeGroupMembers: defineContract({
		method: "POST",
		path: featureFlagsRoutes.groupMembers,
		input: ChangeFlagGroupMembersInputSchema,
		response: singleResponse(ChangeFlagGroupMembersResultSchema),
	}),

	experiments: defineContract({ method: "GET", path: featureFlagsRoutes.experiments, input: z.undefined(), response: singleResponse(ExperimentListSchema) }),
	experimentMetrics: defineContract({
		method: "GET",
		path: featureFlagsRoutes.experimentMetrics,
		input: z.undefined(),
		response: singleResponse(ExperimentMetricOptionListSchema),
	}),
	experiment: defineContract({ method: "GET", path: featureFlagsRoutes.experiment, input: ExperimentPathSchema, response: singleResponse(ExperimentDetailSchema) }),
	createExperiment: defineContract({ method: "POST", path: featureFlagsRoutes.experiments, input: CreateExperimentSchema, response: singleResponse(ExperimentDetailSchema) }),
	updateExperiment: defineContract({
		method: "PUT",
		path: featureFlagsRoutes.experiment,
		input: UpdateExperimentInputSchema,
		response: singleResponse(ExperimentDetailSchema),
	}),
	startExperiment: defineContract({
		method: "POST",
		path: featureFlagsRoutes.startExperiment,
		input: StartExperimentInputSchema,
		response: singleResponse(ExperimentDetailSchema),
	}),
	stopExperiment: defineContract({
		method: "POST",
		path: featureFlagsRoutes.stopExperiment,
		input: StopExperimentInputSchema,
		response: singleResponse(ExperimentDetailSchema),
	}),

	promotionExport: defineContract({
		method: "GET",
		path: featureFlagsRoutes.promotionExport,
		input: PromotionExportQuerySchema,
		response: singleResponse(PromotionFileSchema),
	}),
	promotionPreview: defineContract({
		method: "POST",
		path: featureFlagsRoutes.promotionPreview,
		input: PromotionPreviewInputSchema,
		response: singleResponse(PromotionPreviewSchema),
	}),
	promotionImport: defineContract({ method: "POST", path: featureFlagsRoutes.promotionImport, input: PromotionImportInputSchema, response: singleResponse(RevisionSchema) }),
};
