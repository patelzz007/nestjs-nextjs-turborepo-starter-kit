// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { epochMs, type OwnProfile } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useOwnAvatar } from "./use-own-avatar";

interface HookState {
	sessionScope: "full" | "restricted" | "pending";
	profile: OwnProfile | undefined;
}

const { state, profileQuery } = vi.hoisted(() => {
	const initial: HookState = { sessionScope: "full", profile: undefined };
	return { state: initial, profileQuery: vi.fn() };
});

vi.mock("../index", () => ({
	useAuth: (): object => ({
		user: { sessionScope: state.sessionScope },
		api: {
			auth: {
				profile: {
					useQuery: (input: undefined, options: { readonly enabled: boolean }): object => {
						profileQuery(input, options);
						return { data: options.enabled && state.profile !== undefined ? { data: state.profile } : undefined };
					},
				},
			},
		},
	}),
}));

const PROFILE: OwnProfile = {
	id: "4f0b7c62-3f7a-4c0e-9d8e-2f6a1b3c5d7e",
	email: "ada@example.com",
	fullName: "Ada Lovelace",
	avatar: {
		fileId: "9a1c2e4b-6d8f-4a0b-8c2d-4e6f8a0b2c4d",
		url: "http://10.0.0.5:8080/api/v1/files/9a1c2e4b-6d8f-4a0b-8c2d-4e6f8a0b2c4d/local-public",
		sources: [{ width: 128, url: "http://10.0.0.5:8080/api/v1/files/9a1c2e4b-6d8f-4a0b-8c2d-4e6f8a0b2c4d/variants/THUMBNAIL/local-public" }],
		updatedAt: epochMs(1_790_000_000_000),
	},
	version: 1,
	createdAt: epochMs(1_788_000_000_000),
	updatedAt: epochMs(1_790_000_000_000),
};

afterEach((): void => {
	state.sessionScope = "full";
	state.profile = undefined;
	profileQuery.mockReset();
});

describe("useOwnAvatar", () => {
	it("is the picture of the own profile — the query every avatar change reloads", () => {
		state.profile = PROFILE;
		const { result } = renderHook(() => useOwnAvatar());

		expect(result.current).toEqual({ url: PROFILE.avatar?.url, sources: PROFILE.avatar?.sources });
		expect(profileQuery).toHaveBeenCalledWith(undefined, { enabled: true });
	});

	it("is null for a person without a picture", () => {
		state.profile = { ...PROFILE, avatar: null };
		const { result } = renderHook(() => useOwnAvatar());

		expect(result.current).toBeNull();
	});

	it("does not ask for the profile on a restricted or still-pending session (initials show)", () => {
		state.profile = PROFILE;
		for (const scope of ["restricted", "pending"] satisfies HookState["sessionScope"][]) {
			state.sessionScope = scope;
			const { result } = renderHook(() => useOwnAvatar());

			expect(result.current).toBeNull();
			expect(profileQuery).toHaveBeenLastCalledWith(undefined, { enabled: false });
		}
	});
});
