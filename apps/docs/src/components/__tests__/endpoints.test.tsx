// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import type { EndpointRow } from "@workspace/docs-renderer/api-reference/endpoint-index";
import { REFERENCE_PAGES } from "@workspace/docs-renderer/api-reference/pages";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { docIcon } from "@/lib/icons";

import { accessSummary, AUTH_ICONS, AUTH_LABELS, EndpointsExplorer, fetchEndpoints, groupIcon, optionsOf } from "../endpoints-explorer";
import { jsonFetch } from "./fixtures";
import { renderWithRouter } from "./render-with-router";

const ROWS: readonly EndpointRow[] = [
	{
		operationId: "Auth_login",
		method: "post",
		path: "/api/v1/auth/login",
		summary: "Sign in",
		group: "Auth and sessions",
		href: "/docs/technical/api-reference/auth-and-sessions#post-apiv1authlogin",
		auth: "public",
		superAdminOnly: false,
		permissions: [],
		rateLimits: ["login"],
		deprecated: false,
	},
	{
		operationId: "Roles_update",
		method: "patch",
		path: "/api/v1/admin/roles/{id}",
		summary: "Update a role",
		group: "Access control",
		href: "/docs/technical/api-reference/access-control#patch-apiv1adminrolesid",
		auth: "session",
		superAdminOnly: true,
		permissions: ["UPDATE ROLE"],
		rateLimits: [],
		deprecated: false,
	},
];

beforeEach(() => {
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: () => ({ matches: true, addEventListener: (): void => undefined, removeEventListener: (): void => undefined }),
	});
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("endpoint data", () => {
	it("should validate the endpoint list and fail on a bad response", async () => {
		await expect(fetchEndpoints(jsonFetch(ROWS))).resolves.toEqual(ROWS);
		await expect(fetchEndpoints(jsonFetch({}, 404))).rejects.toThrow("HTTP 404");
	});

	it("should say who may call an endpoint in one line", () => {
		const [login, update] = ROWS;
		expect(login === undefined ? "" : accessSummary(login)).toBe("Public");
		expect(update === undefined ? "" : accessSummary(update)).toBe("Signed in · SuperAdmin · UPDATE ROLE");
	});

	it("should build a filter's options from the values the rows have, sorted and labelled", () => {
		expect(
			optionsOf(
				ROWS,
				(row) => row.method,
				(value) => value.toUpperCase(),
			),
		).toEqual([
			{ value: "patch", label: "PATCH" },
			{ value: "post", label: "POST" },
		]);
		expect(optionsOf(ROWS, (row) => row.group)).toEqual([
			{ value: "Access control", label: "Access control" },
			{ value: "Auth and sessions", label: "Auth and sessions" },
		]);
		expect(AUTH_LABELS.apiKey).toBe("Merchant API key");
	});

	it("should give an option an icon only when asked, drawn at the list's size", () => {
		const [patch] = optionsOf(
			ROWS,
			(row) => row.method,
			(value) => value,
			() => "globe",
		);
		expect(renderToStaticMarkup(<>{patch?.icon}</>)).toMatch(/^<svg [^>]*width="16" height="16"/);
		expect(optionsOf(ROWS, (row) => row.method).every((option) => option.icon === undefined)).toBe(true);
	});

	it("should use a group's reference page icon, and the guide fallback for a page without one", () => {
		const [login, update] = ROWS;
		expect(login === undefined ? "" : groupIcon(login)).toBe("keyRound");
		expect(update === undefined ? "" : groupIcon(update)).toBe("shieldCheck");
		expect(login === undefined ? "" : groupIcon({ ...login, href: "/docs/technical/api-reference/not-a-page#x" })).toBe("fileText");
		expect(AUTH_ICONS.refreshToken).toBe("cookie");
	});

	it("should give every API reference page its own icon in the guide tree", () => {
		for (const page of REFERENCE_PAGES) {
			expect(docIcon(`technical/api-reference/${page.slug}`), page.slug).not.toBe("fileText");
		}
	});
});

describe("EndpointsExplorer", () => {
	it("should list every endpoint, linked to its reference section, with method, group and access", async () => {
		vi.stubGlobal("fetch", jsonFetch(ROWS));
		await renderWithRouter(<EndpointsExplorer />);
		const link = await screen.findByRole("link", { name: "/api/v1/auth/login" });
		expect(link.getAttribute("href")).toBe("/docs/technical/api-reference/auth-and-sessions#post-apiv1authlogin");
		const row = link.closest("tr");
		expect(row === null ? "" : within(row).getByText("post").textContent).toBe("post");
		expect(screen.getByText("Signed in · SuperAdmin · UPDATE ROLE")).toBeTruthy();
	});

	it("should find endpoints by path, summary or group", async () => {
		vi.stubGlobal("fetch", jsonFetch(ROWS));
		await renderWithRouter(<EndpointsExplorer />);
		await screen.findByRole("link", { name: "/api/v1/auth/login" });
		await act(async () => {
			fireEvent.change(screen.getByRole("textbox"), { target: { value: "role" } });
			await new Promise((resolve) => setTimeout(resolve, 400));
		});
		expect(screen.queryByRole("link", { name: "/api/v1/auth/login" })).toBeNull();
		expect(screen.getByRole("link", { name: "/api/v1/admin/roles/{id}" })).toBeTruthy();
	});

	it.each([
		{ filter: "Access", choices: ["All (2)", "Public (1)", "Signed in (1)"] },
		{ filter: "Group", choices: ["All (2)", "Access control (1)", "Auth and sessions (1)"] },
	])("should show an icon beside every $filter choice", async ({ filter, choices }) => {
		vi.stubGlobal("fetch", jsonFetch(ROWS));
		await renderWithRouter(<EndpointsExplorer />);
		await screen.findByRole("link", { name: "/api/v1/auth/login" });
		await act(async () => {
			fireEvent.click(screen.getByRole("combobox", { name: new RegExp(`^${filter}:`, "u") }));
			await Promise.resolve();
		});
		const options = await screen.findAllByRole("option", { hidden: true });
		expect(options.map((option) => option.textContent)).toEqual(choices);
		for (const option of options) {
			expect(option.querySelector("[data-slot=filter-option-icon] svg")).not.toBeNull();
		}
	});

	it("should explain how to recover when the list does not load", async () => {
		vi.stubGlobal("fetch", jsonFetch({}, 500));
		await renderWithRouter(<EndpointsExplorer />);
		expect(await screen.findByText("The endpoint list did not load")).toBeTruthy();
	});
});
