// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { stubApiMeta, successEnvelope } from "@workspace/client/lib/api/envelope";
import { epochMs, UserResponseSchema, type Envelope, type UserResponse } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HelloView from "./hello-view";

interface MeQueryOptions {
	readonly initialData?: Envelope<UserResponse>;
	readonly initialDataUpdatedAt?: number;
}

interface PendingQuery {
	readonly data: undefined;
	readonly isLoading: true;
	readonly error: null;
}

const PENDING: PendingQuery = { data: undefined, isLoading: true, error: null };

const { meUseQuery, permissionsUseQuery, session } = vi.hoisted(() => ({
	meUseQuery: vi.fn<(input: undefined, options: MeQueryOptions) => PendingQuery>(),
	permissionsUseQuery: vi.fn<(input: undefined) => PendingQuery>(),
	/** `useIsServerRenderedSession()` — false once the tab crossed a sign-in / sign-out. */
	session: { serverRendered: true },
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): {
		readonly api: { readonly auth: { readonly me: { readonly useQuery: typeof meUseQuery }; readonly permissions: { readonly useQuery: typeof permissionsUseQuery } } };
	} => ({
		api: { auth: { me: { useQuery: meUseQuery }, permissions: { useQuery: permissionsUseQuery } } },
	}),
	useAuthUser: (): null => null,
	useIsServerRenderedSession: (): boolean => session.serverRendered,
}));

const SERVER_ANSWERED_AT = epochMs(1_790_000_000_000);

const SERVER_PROFILE: Envelope<UserResponse> = successEnvelope(
	UserResponseSchema.parse({
		id: "member-x",
		email: "x@example.com",
		fullName: "Member X",
		isActive: true,
		isSuperAdmin: false,
		isEmailVerified: true,
		twoFactorEnabled: false,
		hasAdminAccess: false,
		tokenVersion: 1,
		roles: [],
		createdAt: epochMs(0),
		updatedAt: epochMs(0),
		isDeleted: false,
		deletedAt: null,
	}),
	{ ...stubApiMeta(), timestamp: SERVER_ANSWERED_AT },
);

function lastMeOptions(): MeQueryOptions | undefined {
	return meUseQuery.mock.lastCall?.[1];
}

beforeEach((): void => {
	session.serverRendered = true;
	meUseQuery.mockReturnValue(PENDING);
	permissionsUseQuery.mockReturnValue(PENDING);
});

afterEach((): void => {
	cleanup();
	meUseQuery.mockReset();
	permissionsUseQuery.mockReset();
});

describe("HelloView server-rendered profile", () => {
	it("seeds /auth/me with the server's profile, stamped with the server's answer time", () => {
		render(<HelloView initialEnvelope={SERVER_PROFILE} />);

		expect(lastMeOptions()).toEqual({ initialData: SERVER_PROFILE, initialDataUpdatedAt: SERVER_ANSWERED_AT });
	});

	it("never seeds /auth/me with it once the tab crossed a session boundary (sign-out, another member)", () => {
		session.serverRendered = false;

		render(<HelloView initialEnvelope={SERVER_PROFILE} />);

		expect(lastMeOptions()?.initialData).toBeUndefined();
		expect(screen.getByText("Loading your profile...")).toBeDefined();
	});
});
