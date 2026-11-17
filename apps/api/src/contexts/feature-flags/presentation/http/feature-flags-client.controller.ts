// ============================================
// presentation/http/feature-flags-client.controller.ts — what every app reads (ADR 087)
// ============================================
// The bundle: the caller's evaluated flags and configs for one app, signed in or not (rules never leave the API).
// The live stream: the catalogue version, signed in only (a refetch is the client's answer to a new version).
// Exposures: batches of "this subject was given this value", attributed by the API, never by the client.

import { Controller, Get, Header, HttpCode, HttpStatus, Inject, Post, Req, Sse, type MessageEvent } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import {
	apiPath,
	APP_VERSION_HEADER,
	AppVersionSchema,
	CLIENT_PLATFORM_HEADER,
	ClientPlatformSchema,
	DEVICE_ID_HEADER,
	DeviceIdSchema,
	ExposureBatchResultSchema,
	ExposureBatchSchema,
	FeatureFlagBundleQuerySchema,
	FeatureFlagBundleSchema,
	type ExposureBatch,
	type ExposureBatchResult,
	type FeatureFlagBundle,
	type FeatureFlagBundleQuery,
} from "@workspace/shared";
import type { FastifyRequest } from "fastify";
import { interval, map, merge, Observable } from "rxjs";
import type { z } from "zod";

import { actingUserId, type ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { OptionalAuth } from "../../../../platform/presentation/http/security/decorators/optional-auth.decorator";
import { PublicOperation } from "../../../../platform/presentation/http/security/decorators/public-operation.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ApiEventStreamResponse } from "../../../../platform/presentation/http/validation/decorators/api-event-stream.decorator";
import { ZodBody, ZodQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { FEATURE_FLAGS_EVALUATE_OPERATION } from "../../application/ports/feature-flags.operations";
import { CATALOG_VERSION_SIGNAL, FLAG_CATALOG_SOURCE, type CatalogVersionSignal, type FlagCatalogSource } from "../../application/ports/flag-catalog.port";
import type { ExposureIntakeService } from "../../application/services/exposure-intake.service";
import type { FlagEvaluationService } from "../../application/services/flag-evaluation.service";
import { EXPOSURE_INTAKE, FLAG_EVALUATION } from "../../feature-flags.tokens";

/** A frame now and then keeps proxies from closing a quiet stream. */
export const FEATURE_FLAG_STREAM_KEEPALIVE_MS = 25_000;
/** A public route's caller may be signed out. */
const PUBLIC_ACTOR = { allowAnonymous: true };
/** A bundle names the caller's values and follows changes at once: no cache may keep it. */
const NO_STORE = "private, no-store, max-age=0";

/** One optional header, read only when it is a valid value (a malformed one counts as absent, never as an error). */
function header<T>(request: FastifyRequest, name: string, schema: z.ZodType<T>): T | null {
	const parsed = schema.safeParse(request.headers[name.toLowerCase()]);
	return parsed.success ? parsed.data : null;
}

@ApiTags("Feature flags")
@Controller(apiPath("/feature-flags"))
export class FeatureFlagsClientController {
	public constructor(
		@Inject(FLAG_EVALUATION) private readonly evaluation: FlagEvaluationService,
		@Inject(EXPOSURE_INTAKE) private readonly exposures: ExposureIntakeService,
		@Inject(FLAG_CATALOG_SOURCE) private readonly catalog: FlagCatalogSource,
		@Inject(CATALOG_VERSION_SIGNAL) private readonly versions: CatalogVersionSignal,
	) {}

	// A page-load read (every server render of every app asks for it), not a credential endpoint: only the
	// `default` throttler (per principal) and the per-IP `preAuth` bucket apply. Under the per-IP `strict` one, a Next
	// server rendering for many visitors from one address ran out within seconds and every flag fell back to its default.
	@SkipThrottle({ strict: true })
	@OptionalAuth()
	// Under the flag read: the catalogue tables and nothing else. A person's facts (email domain, tier, …) are read
	// by the contexts that own them, each under its own operation.
	@PublicOperation(FEATURE_FLAGS_EVALUATE_OPERATION)
	@Get("bundle")
	@Header("Cache-Control", NO_STORE)
	@ApiOperation({
		summary: "The caller's evaluated feature flags and dynamic configs for one app",
		description: `Signed in or not. Send \`${DEVICE_ID_HEADER}\` (a random UUID per browser or install) for device-unit flags, \`${CLIENT_PLATFORM_HEADER}\` and \`${APP_VERSION_HEADER}\` from the mobile app. A \`tenantId\` / \`locationId\` count only when the signed-in person works there.`,
	})
	@ZodResponse(FeatureFlagBundleSchema, { description: "The values, the catalogue version and when a scheduled rollout next changes them" })
	public bundle(
		@CurrentActor(PUBLIC_ACTOR) actor: ActorContext,
		@ZodQuery(FeatureFlagBundleQuerySchema) query: FeatureFlagBundleQuery,
		@Req() request: FastifyRequest,
	): Promise<FeatureFlagBundle> {
		return this.evaluation.bundle({
			app: query.app,
			userId: actingUserId(actor),
			tenantId: query.tenantId ?? null,
			locationId: query.locationId ?? null,
			deviceId: header(request, DEVICE_ID_HEADER, DeviceIdSchema),
			platform: header(request, CLIENT_PLATFORM_HEADER, ClientPlatformSchema) ?? (query.app === "mobile" ? null : "web"),
			appVersion: header(request, APP_VERSION_HEADER, AppVersionSchema),
			locale: query.locale ?? null,
		});
	}

	// Opened once per signed-in page load, like the bundle: not a credential endpoint.
	@SkipThrottle({ strict: true })
	@ApiBearerAuth()
	@Sse("stream")
	@ApiOperation({ summary: "The feature flag catalogue's version, live (SSE): a `{ version }` frame on connect and whenever it changes; refetch the bundle when it does" })
	@ApiEventStreamResponse("A `{ version }` frame per change and a `ping` every 25 s (no envelope)")
	public stream(): Observable<MessageEvent> {
		const changes = new Observable<MessageEvent>((subscriber) => {
			void this.catalog.current().then((index) => {
				subscriber.next({ data: { version: index.version } });
			});
			return this.versions.subscribe((version: number): void => {
				subscriber.next({ data: { version } });
			});
		});
		return merge(changes, interval(FEATURE_FLAG_STREAM_KEEPALIVE_MS).pipe(map((): MessageEvent => ({ type: "ping", data: "" }))));
	}

	@OptionalAuth()
	@PublicOperation(FEATURE_FLAGS_EVALUATE_OPERATION)
	@RateLimit(RATE_LIMIT_POLICY.featureFlagExposures)
	@Post("exposures")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: "Record a batch of feature flag exposures",
		description: `The subject of each comes from the session, \`${DEVICE_ID_HEADER}\`, or a store the person works at — never from the body. Signed out, only device-unit flags count. Up to 50 per batch.`,
	})
	@ZodResponse(ExposureBatchResultSchema, { description: "How many were accepted and how many ignored" })
	public record(
		@CurrentActor(PUBLIC_ACTOR) actor: ActorContext,
		@ZodBody(ExposureBatchSchema) batch: ExposureBatch,
		@Req() request: FastifyRequest,
	): Promise<ExposureBatchResult> {
		return this.exposures.intake({ userId: actingUserId(actor), deviceId: header(request, DEVICE_ID_HEADER, DeviceIdSchema) }, batch);
	}
}
