import { describe, expect, it } from "vitest";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import { marketplaceCacheControl, MARKETPLACE_PUBLIC_CACHE_CONTROL, MARKETPLACE_VIEWER_CACHE_CONTROL } from "../viewer-cache-control";

const REQUEST = { requestId: "req-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null };

describe("marketplaceCacheControl", () => {
	it("lets a shared cache keep the signed-out answer", () => {
		const anonymous: ActorContext = { kind: "anonymous", tenantId: null, request: REQUEST };

		expect(marketplaceCacheControl(anonymous)).toBe(MARKETPLACE_PUBLIC_CACHE_CONTROL);
	});

	it("never lets a shared cache keep a signed-in answer, which can hold rewards given only to that person", () => {
		const user: ActorContext = {
			kind: "user",
			userId: "0199a1b2-0000-7000-8000-0000000000c1",
			sessionId: "session-1",
			tenantId: null,
			isSuperAdmin: false,
			accessScope: "tenant",
			impersonatorUserId: null,
			request: REQUEST,
		};

		expect(marketplaceCacheControl(user)).toBe(MARKETPLACE_VIEWER_CACHE_CONTROL);
	});
});
