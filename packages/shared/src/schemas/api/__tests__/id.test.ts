import { describe, expect, expectTypeOf, it } from "vitest";

import { TenantIdSchema, type TenantId } from "../../../contexts/tenancy/schemas/tenancy-mode";
import { idSchema, LocationIdSchema, UserIdSchema, type Id, type LocationId, type UserId } from "../id";

const UUID = "019b76da-a810-7000-8000-0000000000a1";

describe("idSchema", () => {
	it("passes a uuid through unchanged", () => {
		expect(UserIdSchema.parse(UUID)).toBe(UUID);
		expect(LocationIdSchema.parse(UUID)).toBe(UUID);
	});

	it("names the entity when the value is not an id", () => {
		const result = idSchema("Reward").safeParse("reward-1");
		expect(result.success).toBe(false);
		expect(result.error?.issues.at(0)?.message).toBe("must be a Reward id");
	});

	it("keeps ids of different entities apart at compile time", () => {
		expectTypeOf<UserId>().toEqualTypeOf<Id<"User">>();
		expectTypeOf<TenantId>().toEqualTypeOf<Id<"Tenant">>();
		expectTypeOf<UserId>().not.toEqualTypeOf<TenantId>();
		expectTypeOf<LocationId>().not.toEqualTypeOf<UserId>();
		expectTypeOf(TenantIdSchema.parse(UUID)).toEqualTypeOf<TenantId>();
	});
});
