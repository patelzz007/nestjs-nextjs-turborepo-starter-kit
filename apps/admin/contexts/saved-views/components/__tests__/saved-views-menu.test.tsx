// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { epochMs, type SavedListView } from "@workspace/shared";
import { accessibilityViolations } from "@workspace/ui/testing/axe";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { currentQuery, SavedViewsMenu } from "@/contexts/saved-views/components/saved-views-menu";

const { listQuery, createMutate, removeMutate, push, search } = vi.hoisted(() => ({
	listQuery: vi.fn(),
	createMutate: vi.fn(),
	removeMutate: vi.fn(),
	push: vi.fn(),
	search: { value: "filter%5Bstatus%5D=locked" },
}));

vi.mock("next/navigation", () => ({
	useRouter: (): object => ({ push }),
	usePathname: (): string => "/users",
	useSearchParams: (): URLSearchParams => new URLSearchParams(search.value),
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({ ...(await importOriginal<object>()), useQueryClient: (): object => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			savedViews: {
				list: { useQuery: listQuery },
				create: { useMutation: (): object => ({ mutate: createMutate, isPending: false }) },
				remove: { useMutation: (): object => ({ mutate: removeMutate, isPending: false }) },
			},
		},
	}),
}));

const AT = epochMs(Date.UTC(2026, 10, 3, 9, 0));
const MINE: SavedListView = {
	id: "0190f0e0-0000-7000-8000-000000000001",
	listKey: "admin.users",
	name: "Locked out",
	query: "?filter[status]=locked",
	shared: false,
	mine: true,
	ownerName: null,
	createdAt: AT,
};
const THEIRS: SavedListView = {
	id: "0190f0e0-0000-7000-8000-000000000002",
	listKey: "admin.users",
	name: "Active accounts",
	query: "?filter[status]=active",
	shared: true,
	mine: false,
	ownerName: "Sam Staff",
	createdAt: AT,
};

beforeEach((): void => {
	listQuery.mockReturnValue({ data: { data: { views: [MINE, THEIRS] } } });
	search.value = "filter%5Bstatus%5D=locked";
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

function openMenu(): void {
	act((): void => {
		fireEvent.click(screen.getByRole("button", { name: "Saved views" }));
	});
}

describe("currentQuery", () => {
	it("is the list's query as a view keeps it", () => {
		expect(currentQuery("a=1")).toBe("?a=1");
		expect(currentQuery("")).toBe("");
	});
});

describe("SavedViewsMenu", () => {
	it("lists your views and the ones others shared, and opens one by going to its URL", () => {
		render(<SavedViewsMenu listKey="admin.users" />, { wrapper: UiKitTestProviders });
		openMenu();
		expect(listQuery).toHaveBeenCalledWith({ listKey: "admin.users" });
		const list = within(screen.getByRole("list", { name: "Saved views" }));
		expect(list.getByText("Shared by Sam Staff")).toBeTruthy();
		act((): void => {
			fireEvent.click(list.getByRole("button", { name: /Active accounts/u }));
		});
		expect(push).toHaveBeenCalledWith("/users?filter[status]=active");
	});

	it("saves the filters you have now under a name, shared when asked", () => {
		render(<SavedViewsMenu listKey="admin.users" />, { wrapper: UiKitTestProviders });
		openMenu();
		const save = screen.getByRole("button", { name: "Save view" });
		expect(save).toHaveProperty("disabled", true);
		act((): void => {
			fireEvent.change(screen.getByLabelText("Save the current view as"), { target: { value: "Locked this week" } });
			fireEvent.click(screen.getByRole("switch", { name: "Share with the other staff" }));
		});
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Save view" }));
		});
		expect(createMutate).toHaveBeenCalledWith({ listKey: "admin.users", name: "Locked this week", query: "?filter%5Bstatus%5D=locked", shared: true });
	});

	it("lets you remove only your own views", () => {
		render(<SavedViewsMenu listKey="admin.users" />, { wrapper: UiKitTestProviders });
		openMenu();
		expect(screen.queryByRole("button", { name: "Remove Active accounts" })).toBeNull();
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Remove Locked out" }));
		});
		expect(removeMutate).toHaveBeenCalledWith({ viewId: MINE.id });
	});

	it("says how to start when there are no views", () => {
		listQuery.mockReturnValue({ data: { data: { views: [] } } });
		render(<SavedViewsMenu listKey="admin.users" />, { wrapper: UiKitTestProviders });
		openMenu();
		expect(screen.getByText(/No saved views yet/u)).toBeTruthy();
	});

	it("has no serious accessibility problems (enhancement 3.2)", async () => {
		render(<SavedViewsMenu listKey="admin.users" />, { wrapper: UiKitTestProviders });
		openMenu();
		await expect(accessibilityViolations(document.body)).resolves.toStrictEqual([]);
	});
});
