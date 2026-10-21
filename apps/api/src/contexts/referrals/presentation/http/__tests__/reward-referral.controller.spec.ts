import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import { PLATFORM_OPERATION_KEY } from "../../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { CreateRewardReferralLinkCommand } from "../../../application/commands/create-reward-referral-link/create-reward-referral-link.command";
import { RecordRewardReferralAttributionCommand } from "../../../application/commands/record-reward-referral-attribution/record-reward-referral-attribution.command";
import { handlerOf } from "../../../../../../test/support/route-metadata";
import { RewardReferralController, type RewardReferralCommandDispatch } from "../reward-referral.controller";

const REQUEST = { requestId: "req-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null };
const ACTOR: ActorContext = {
	kind: "user",
	userId: "user-1",
	sessionId: "session-1",
	tenantId: null,
	isSuperAdmin: false,
	accessScope: "tenant",
	impersonatorUserId: null,
	request: REQUEST,
};
const REWARD_ID = "0199a1b2-0000-7000-8000-000000000001";
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde";

/** Raised after the bus recorded the command, so the route's own result is not needed. */
class Dispatched extends Error {}

class RecordingBus implements RewardReferralCommandDispatch {
	public readonly dispatched: object[] = [];

	public execute<TResult>(command: CreateRewardReferralLinkCommand | RecordRewardReferralAttributionCommand): Promise<TResult> {
		this.dispatched.push(command);
		return Promise.reject(new Dispatched());
	}
}

describe("RewardReferralController", () => {
	it("dispatches one command per route with the caller and the route's input", async () => {
		const bus = new RecordingBus();
		const controller = new RewardReferralController(bus);

		await expect(controller.createLink(ACTOR, { rewardId: REWARD_ID })).rejects.toBeInstanceOf(Dispatched);
		await expect(controller.recordAttribution(ACTOR, { attributionToken: TOKEN })).rejects.toBeInstanceOf(Dispatched);

		expect(bus.dispatched).toEqual([new CreateRewardReferralLinkCommand(ACTOR, REWARD_ID), new RecordRewardReferralAttributionCommand(ACTOR, TOKEN)]);
	});

	it("runs each route under its named system operation", () => {
		const reflector = new Reflector();

		expect(reflector.get(PLATFORM_OPERATION_KEY, handlerOf(RewardReferralController.prototype, "createLink"))).toBe("referrals.reward_link.create");
		expect(reflector.get(PLATFORM_OPERATION_KEY, handlerOf(RewardReferralController.prototype, "recordAttribution"))).toBe("referrals.attribution.record");
	});
});
