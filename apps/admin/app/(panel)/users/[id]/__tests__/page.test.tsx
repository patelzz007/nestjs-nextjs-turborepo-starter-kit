import { afterEach, describe, expect, it, vi } from "vitest";

import UserDetailPage from "../page";

const { userDetailQuery } = vi.hoisted(() => ({ userDetailQuery: vi.fn() }));

vi.mock("next/navigation", () => ({
	notFound: (): void => {
		throw new Error("NEXT_NOT_FOUND");
	},
	redirect: (): void => {
		throw new Error("NEXT_REDIRECT");
	},
}));

vi.mock("@/lib/admin-server-api", () => ({
	createAdminServerCaller: (): object => ({
		auth: { adminUserDetail: { query: userDetailQuery } },
		admin: { roles: { list: { query: vi.fn() } }, permissions: { list: { query: vi.fn() } } },
	}),
}));

afterEach(() => {
	vi.clearAllMocks();
});

describe("UserDetailPage", () => {
	it("renders the 404 page for a malformed id without calling the API", async () => {
		await expect(UserDetailPage({ params: Promise.resolve({ id: "not-a-uuid" }) })).rejects.toThrow("NEXT_NOT_FOUND");
		expect(userDetailQuery).not.toHaveBeenCalled();
	});
});
