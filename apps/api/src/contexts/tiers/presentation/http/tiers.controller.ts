// ============================================
// presentation/http/tiers.controller.ts — a customer's own tier (ADR 085)
// ============================================
// Whether tiers are on is public, with the caller's tier when signed in (the web app marks locked rewards for
// signed-out visitors too, as Bronze); the tier page is the
// signed-in customer's own, refused (404 TIERS_DISABLED) while tiers are off.

import { Get, Header, Inject } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { MyTierSchema, TierAvailabilitySchema, type MyTier, type TierAvailability } from "@workspace/shared";

import { ApiController } from "../../../../platform/presentation/http/versioning/api-controller.decorator";
import type { ActorContext } from "../../../../platform/application/actor-context";
import { FEATURE_FLAGS_EVALUATE_OPERATION } from "../../../feature-flags/public-api";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { PublicOperation } from "../../../../platform/presentation/http/security/decorators/public-operation.decorator";
import { OptionalAuth } from "../../../../platform/presentation/http/security/decorators/optional-auth.decorator";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { TIER_READ_SERVICE } from "../../application/ports/tiers.tokens";
import type { TierReadService } from "../../application/services/tier-read.service";

/** A public route's caller may be signed out. */
const PUBLIC_ACTOR = { allowAnonymous: true };

/** The answer names the caller's tier and follows the flag at once: no cache may keep it. */
const AVAILABILITY_CACHE_CONTROL = "private, no-store, max-age=0";

@ApiTags("Tiers")
@ApiController("/tiers")
export class TiersController {
	public constructor(@Inject(TIER_READ_SERVICE) private readonly tiers: Pick<TierReadService, "availability" | "myTier">) {}

	@OptionalAuth()
	// A signed-out visitor's request runs under the flag read: the flag tables and nothing else. The caller's tier is
	// read in a transaction of its own under `tiers.standing.read`.
	@PublicOperation(FEATURE_FLAGS_EVALUATE_OPERATION)
	@Get("availability")
	@Header("Cache-Control", AVAILABILITY_CACHE_CONTROL)
	@ApiOperation({ summary: "Whether customer tiers are on (the customer-tiers flag) and, while they are, the caller's tier — Bronze when signed out" })
	@ZodResponse(TierAvailabilitySchema, { description: "Whether tiers are on, and the caller's tier" })
	public availability(@CurrentActor(PUBLIC_ACTOR) actor: ActorContext): Promise<TierAvailability> {
		return this.tiers.availability(actor);
	}

	@ApiBearerAuth()
	@Get("me")
	@ApiOperation({
		summary:
			"The signed-in customer's tier: progress to the next, the counted redemptions per merchant, the tier hold, a pending demotion warning, what leaves the window soon, and the tier history",
	})
	@ZodResponse(MyTierSchema, { description: "The customer's tier page" })
	public me(@CurrentActor() actor: ActorContext): Promise<MyTier> {
		return this.tiers.myTier(actor);
	}
}
