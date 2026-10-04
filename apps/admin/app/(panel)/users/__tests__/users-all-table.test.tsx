// @vitest-environment jsdom
import { keepPreviousData } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ApiPaginatedMetaSchema, type AdminUserDetail, type ApiPaginatedMeta, type Envelope } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TABLE_TEXT_DEBOUNCE_MS } from "@/lib/data-table/use-table-text-draft";
import { USERS_TABLE_URL_STATE } from "@/lib/url-state/users";

import UsersAllTable from "../users-all-table";

/** Only the user fields the table renders. */
interface UserRowStub {
	readonly id: string;
	readonly fullName: string;
	readonly email: string;
	readonly roles: readonly { readonly id: string; readonly name: string }[];
	readonly isSuperAdmin: boolean;
	readonly hasAdminAccess: boolean;
}

interface UsersQueryStub {
	readonly data: { readonly data: readonly UserRowStub[]; readonly meta: ApiPaginatedMeta };
	readonly isLoading: boolean;
	readonly isError: boolean;
	readonly isFetching: boolean;
}

const { usersQuery } = vi.hoisted(() => ({ usersQuery: vi.fn() }));

// The table reads its state from the address bar, as Next.js's
// `useSearchParams` does once the History API integration has synced it.
vi.mock("next/navigation", () => ({
	useRouter: (): { readonly push: () => void } => ({ push: () => undefined }),
	useSearchParams: (): URLSearchParams => new URLSearchParams(window.location.search),
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({ api: { auth: { adminUsers: { useQuery: usersQuery } } } }),
}));

const PATH = "/users";
const NEXT_CURSOR = "eyJhdCI6MSwiaWQiOiJ1In0";

const USER: UserRowStub = { id: "u-1", fullName: "Jane Doe", email: "jane@example.com", roles: [], isSuperAdmin: false, hasAdminAccess: true };

function pageMeta(overrides: Partial<ApiPaginatedMeta>): ApiPaginatedMeta {
	return ApiPaginatedMetaSchema.parse({
		correlationId: "test",
		timestamp: 1_790_000_000_000,
		limit: 20,
		total: 100,
		page: 1,
		totalPages: 5,
		nextCursor: NEXT_CURSOR,
		hasNext: true,
		hasPrevious: false,
		...overrides,
	});
}

function queryResult(meta: ApiPaginatedMeta): UsersQueryStub {
	return { data: { data: [USER], meta }, isLoading: false, isError: false, isFetching: false };
}

function setUrl(url: string): void {
	window.history.replaceState(null, "", url);
}

function currentQuery(): string {
	return decodeURIComponent(window.location.search);
}

beforeEach((): void => {
	setUrl(PATH);
	usersQuery.mockReturnValue(queryResult(pageMeta({})));
});

afterEach((): void => {
	cleanup();
	usersQuery.mockReset();
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe("UsersAllTable URL state", () => {
	it("queries exactly what the URL asks for and shows it in the controls", () => {
		setUrl(`${PATH}?page=2&sort=-email&search=jane&filter[status]=locked`);
		render(<UsersAllTable />);

		expect(usersQuery).toHaveBeenLastCalledWith(
			{ page: 2, limit: 20, sort: "-email", search: "jane", filter: { status: { eq: "locked" } } },
			expect.objectContaining({ placeholderData: keepPreviousData }),
		);
		expect(screen.getByDisplayValue("jane")).toBeDefined();
		expect(screen.getByRole("combobox", { name: "Account status" }).textContent).toContain("Locked");
	});

	it("ignores invalid params instead of sending them", () => {
		setUrl(`${PATH}?page=-1&sort=passwordHash&filter[status]=root&limit=7`);
		render(<UsersAllTable />);

		expect(usersQuery).toHaveBeenLastCalledWith({ page: 1, limit: 20 }, expect.anything());
	});

	it("commits the debounced search to the URL with replace and returns to page 1", () => {
		vi.useFakeTimers();
		setUrl(`${PATH}?page=3`);
		const replaceState = vi.spyOn(window.history, "replaceState");
		const pushState = vi.spyOn(window.history, "pushState");
		render(<UsersAllTable />);

		fireEvent.change(screen.getByDisplayValue(""), { target: { value: "  bob " } });
		expect(replaceState).not.toHaveBeenCalled();
		act((): void => {
			vi.advanceTimersByTime(TABLE_TEXT_DEBOUNCE_MS);
		});

		expect(replaceState).toHaveBeenCalledTimes(1);
		expect(pushState).not.toHaveBeenCalled();
		expect(currentQuery()).toBe("?search=bob");
	});

	it("restores search, sort and page from the URL on back/forward", () => {
		setUrl(`${PATH}?search=jane`);
		const view = render(<UsersAllTable />);
		expect(screen.getByDisplayValue("jane")).toBeDefined();

		setUrl(`${PATH}?page=4&search=bob&sort=fullName`);
		view.rerender(<UsersAllTable />);

		expect(screen.getByDisplayValue("bob")).toBeDefined();
		expect(usersQuery).toHaveBeenLastCalledWith({ page: 4, limit: 20, sort: "fullName", search: "bob" }, expect.anything());
	});

	it("pushes a status filter change and resets to page 1", async () => {
		setUrl(`${PATH}?page=3`);
		const pushState = vi.spyOn(window.history, "pushState");
		render(<UsersAllTable />);

		const trigger = screen.getByRole("combobox", { name: "Account status" });
		fireEvent.pointerDown(trigger, { pointerType: "mouse", button: 0 });
		fireEvent.mouseDown(trigger, { button: 0 });
		fireEvent.click(trigger);
		const option = await screen.findByRole("option", { name: "Locked" });
		fireEvent.pointerDown(option, { pointerType: "mouse", button: 0 });
		fireEvent.mouseDown(option, { button: 0 });
		fireEvent.pointerUp(option, { pointerType: "mouse", button: 0 });
		fireEvent.mouseUp(option, { button: 0 });
		fireEvent.click(option);

		expect(pushState).toHaveBeenCalledTimes(1);
		expect(currentQuery()).toBe("?filter[status]=locked");
	});

	it("pushes a sort change and resets to page 1", () => {
		setUrl(`${PATH}?page=3`);
		const pushState = vi.spyOn(window.history, "pushState");
		render(<UsersAllTable />);

		fireEvent.click(screen.getByText("Name"));

		expect(pushState).toHaveBeenCalledTimes(1);
		expect(currentQuery()).toBe("?sort=fullName");
	});

	it("pushes the next page with the response's keyset cursor (default order)", () => {
		const pushState = vi.spyOn(window.history, "pushState");
		render(<UsersAllTable />);

		fireEvent.click(screen.getByRole("button", { name: /next page/i }));

		expect(pushState).toHaveBeenCalledTimes(1);
		expect(currentQuery()).toBe(`?page=2&cursor=${NEXT_CURSOR}`);
	});

	it("pages by offset only when a custom sort is active", () => {
		setUrl(`${PATH}?sort=email`);
		render(<UsersAllTable />);

		fireEvent.click(screen.getByRole("button", { name: /next page/i }));

		expect(currentQuery()).toBe("?page=2&sort=email");
	});

	it("uses the server-prefetched page only for the URL state it was fetched for", () => {
		setUrl(`${PATH}?page=2`);
		const envelope: Envelope<AdminUserDetail[]> = { success: true, data: [], meta: pageMeta({ page: 2 }) };
		const prefetchedFor = USERS_TABLE_URL_STATE.serialize(USERS_TABLE_URL_STATE.parse(new URLSearchParams("page=2")));
		const view = render(<UsersAllTable initialPage={{ stateKey: prefetchedFor, data: envelope }} />);
		expect(usersQuery).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ initialData: envelope }));

		setUrl(`${PATH}?page=3`);
		view.rerender(<UsersAllTable initialPage={{ stateKey: prefetchedFor, data: envelope }} />);
		expect(usersQuery).toHaveBeenLastCalledWith(expect.anything(), expect.not.objectContaining({ initialData: envelope }));
	});
});
