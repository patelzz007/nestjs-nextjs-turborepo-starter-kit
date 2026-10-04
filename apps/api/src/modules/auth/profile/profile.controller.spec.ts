import "reflect-metadata";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants.js";
import { Reflector } from "@nestjs/core";
import { apiPath, epochMs, OwnProfileSchema, type OwnProfile, type UpdateOwnProfileInput } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { createAuditTrailDouble } from "../../../../test/support/audit-trail-double";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { createTestPrisma } from "../../../../test/support/test-service-graph";
import { RequestContextService } from "../../../common/context/request-context";
import { getResponseContract } from "../../../common/decorators/zod-response.decorators";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { AUTHORIZE_KEY, type AuthorizationRequirement } from "../../authorization/decorators/authorize.decorator";
import { UserSessionCacheService } from "../cache/user-session-cache.service";
import type { AccessTokenPayload } from "../services/token.service";
import { OwnProfileRepository } from "./own-profile.repository";
import { OwnProfileService } from "./own-profile.service";
import { OwnProfileWritePolicy } from "./own-profile-write.policy";
import type { ProfileActor } from "./profile-actor";
import { ProfileController } from "./profile.controller";

const USER_ID = "7d3e9a10-2b4c-4d6e-8f01-23456789abcd";
const SUPER_ADMIN_ID = "0a1b2c3d-4e5f-4061-8728-394a5b6c7d8e";
const EPOCH_MS = 1_788_253_200_000;

const PROFILE: OwnProfile = {
	id: USER_ID,
	email: "user@example.com",
	fullName: "Regular User",
	avatar: null,
	version: 1,
	createdAt: epochMs(EPOCH_MS),
	updatedAt: epochMs(EPOCH_MS),
};

function token(overrides: Partial<AccessTokenPayload> = {}): AccessTokenPayload {
	return {
		sub: USER_ID,
		id: USER_ID,
		email: "user@example.com",
		fullName: "Regular User",
		isActive: true,
		isSuperAdmin: false,
		isEmailVerified: true,
		hasAdminAccess: false,
		tokenVersion: 0,
		...overrides,
	};
}

/** Records the actor and input each call was delegated with. */
class RecordingProfileService extends OwnProfileService {
	public readonly calls: { readonly method: "get" | "update"; readonly actor: ProfileActor; readonly input?: UpdateOwnProfileInput }[] = [];

	public override getOwnProfile(actor: ProfileActor): Promise<OwnProfile> {
		this.calls.push({ method: "get", actor });
		return Promise.resolve(PROFILE);
	}

	public override updateOwnProfile(actor: ProfileActor, input: UpdateOwnProfileInput): Promise<OwnProfile> {
		this.calls.push({ method: "update", actor, input });
		return Promise.resolve(PROFILE);
	}
}

function controller(): { readonly controller: ProfileController; readonly service: RecordingProfileService } {
	const requestContext = new RequestContextService();
	const prisma = createTestPrisma();
	const service = new RecordingProfileService(
		new OwnProfileRepository(prisma),
		new OwnProfileWritePolicy(),
		new TenantTransactionService(prisma, requestContext),
		createAuditTrailDouble(requestContext).auditTrail,
		new UserSessionCacheService(createTestTypedConfig()),
	);
	return { controller: new ProfileController(service), service };
}

function handlerOf<TKey extends keyof ProfileController>(key: TKey): ProfileController[TKey] {
	const descriptor: TypedPropertyDescriptor<ProfileController[TKey]> | undefined = Object.getOwnPropertyDescriptor(ProfileController.prototype, key);
	const handler: ProfileController[TKey] | undefined = descriptor?.value;
	if (handler === undefined) {
		throw new Error(`ProfileController.${key} missing`);
	}
	return handler;
}

function authorizationOf(key: keyof ProfileController): AuthorizationRequirement | undefined {
	return new Reflector().get<AuthorizationRequirement | undefined>(AUTHORIZE_KEY, handlerOf(key));
}

describe("ProfileController", () => {
	it("serves GET and PATCH on the versioned /auth/profile route", () => {
		const reflector = new Reflector();
		expect(reflector.get<string>(PATH_METADATA, ProfileController)).toBe(apiPath("/auth"));
		expect([reflector.get<string>(PATH_METADATA, handlerOf("getOwnProfile")), reflector.get<RequestMethod>(METHOD_METADATA, handlerOf("getOwnProfile"))]).toEqual([
			"/profile",
			RequestMethod.GET,
		]);
		expect([reflector.get<string>(PATH_METADATA, handlerOf("updateOwnProfile")), reflector.get<RequestMethod>(METHOD_METADATA, handlerOf("updateOwnProfile"))]).toEqual([
			"/profile",
			RequestMethod.PATCH,
		]);
	});

	it("maps each route to its explicit own-record authorization (READ / UPDATE PROFILE on self)", () => {
		const read = authorizationOf("getOwnProfile");
		const update = authorizationOf("updateOwnProfile");

		expect([read?.action, read?.resource, typeof read?.resourceId]).toEqual(["READ", "PROFILE", "function"]);
		expect([update?.action, update?.resource, typeof update?.resourceId]).toEqual(["UPDATE", "PROFILE", "function"]);
	});

	it("answers both routes with the shared profile contract", () => {
		expect(getResponseContract(handlerOf("getOwnProfile"))).toMatchObject({ kind: "single", schema: OwnProfileSchema, status: 200 });
		expect(getResponseContract(handlerOf("updateOwnProfile"))).toMatchObject({ kind: "single", schema: OwnProfileSchema, status: 200 });
	});

	it("acts on the token subject's own profile, as themselves", async () => {
		const { controller: profiles, service } = controller();

		await profiles.getOwnProfile(token());
		await profiles.updateOwnProfile(token(), { version: 1, fullName: "Jane Doe" });

		expect(service.calls).toEqual([
			{ method: "get", actor: { kind: "self", userId: USER_ID } },
			{ method: "update", actor: { kind: "self", userId: USER_ID }, input: { version: 1, fullName: "Jane Doe" } },
		]);
	});

	it("passes an impersonation session on as an impersonated actor (the service refuses its writes)", async () => {
		const { controller: profiles, service } = controller();

		await profiles.updateOwnProfile(token({ isImpersonating: true, originalUserId: SUPER_ADMIN_ID }), { version: 1, fullName: "Jane Doe" });

		expect(service.calls.at(0)?.actor).toEqual({ kind: "impersonated", userId: USER_ID });
	});
});
