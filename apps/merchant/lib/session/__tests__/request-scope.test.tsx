// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it } from "vitest";

import {
	createRequestScopeHolder,
	NO_REQUEST_SCOPE,
	requestScopeHeaders,
	RequestScopeProvider,
	useRequestScope,
	type RequestScope,
	type RequestScopeHolder,
} from "@/lib/session/request-scope";

const TENANT_ID = "019b76da-a800-7000-8000-0000000000a1";
const LOCATION_ID = "019b76da-a800-7000-8000-0000000000b1";

function inHolder(holder: RequestScopeHolder): (props: { readonly children: React.ReactNode }) => React.JSX.Element {
	return function Wrapper({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
		return <RequestScopeProvider value={holder}>{children}</RequestScopeProvider>;
	};
}

describe("requestScopeHeaders", () => {
	it("names the tenant and the chosen store", () => {
		expect(requestScopeHeaders({ tenantId: TENANT_ID, locationId: LOCATION_ID })).toEqual({ "X-Tenant-Id": TENANT_ID, "X-Location-Id": LOCATION_ID });
	});

	it("names no store for All locations", () => {
		expect(requestScopeHeaders({ tenantId: TENANT_ID, locationId: null })).toEqual({ "X-Tenant-Id": TENANT_ID });
	});

	it("names nothing outside a tenant", () => {
		expect(requestScopeHeaders(NO_REQUEST_SCOPE)).toEqual({});
	});
});

describe("useRequestScope", () => {
	it("writes the scope while mounted, follows a change, and clears it on unmount", () => {
		const holder = createRequestScopeHolder();
		const chosen: RequestScope = { tenantId: TENANT_ID, locationId: LOCATION_ID };
		const { rerender, unmount } = renderHook(
			(scope: RequestScope): void => {
				useRequestScope(scope);
			},
			{
				initialProps: chosen,
				wrapper: inHolder(holder),
			},
		);
		expect(holder.read()).toEqual({ tenantId: TENANT_ID, locationId: LOCATION_ID });

		rerender({ tenantId: TENANT_ID, locationId: null });
		expect(holder.read()).toEqual({ tenantId: TENANT_ID, locationId: null });

		unmount();
		expect(holder.read()).toEqual(NO_REQUEST_SCOPE);
	});

	it("does nothing outside a provider", () => {
		expect(() =>
			renderHook((): void => {
				useRequestScope({ tenantId: TENANT_ID, locationId: LOCATION_ID });
			}),
		).not.toThrow();
	});
});
