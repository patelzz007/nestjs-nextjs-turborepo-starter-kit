// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CapabilitiesProvider } from "@workspace/client/lib/auth/can";
import { ApiError } from "@workspace/client/lib/api/api-request";
import { PERMISSION, type CapabilitySlug, type CheckPermissionInput } from "@workspace/shared";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AccessControlPanel from "../access-control-panel";

interface ListQueryStub {
	readonly useQuery: () => { readonly data: { readonly data: { readonly items: readonly [] } }; readonly isError: boolean };
}

interface MutationOptionsStub {
	readonly onError?: (error: Error) => void;
}

interface AuthStub {
	readonly api: {
		readonly admin: {
			readonly roles: { readonly list: ListQueryStub };
			readonly permissions: {
				readonly list: ListQueryStub;
				readonly check: { readonly useMutation: (options: MutationOptionsStub) => { readonly mutate: (input: CheckPermissionInput) => void; readonly isPending: boolean } };
			};
		};
	};
}

const { checkMutate, checkOptions } = vi.hoisted(() => {
	const options: MutationOptionsStub[] = [];
	return { checkMutate: vi.fn<(input: CheckPermissionInput) => void>(), checkOptions: options };
});

vi.mock("@workspace/client/lib/auth", () => {
	const emptyList: ListQueryStub = { useQuery: () => ({ data: { data: { items: [] } }, isError: false }) };
	const auth: AuthStub = {
		api: {
			admin: {
				roles: { list: emptyList },
				permissions: {
					list: emptyList,
					check: {
						useMutation: (options: MutationOptionsStub) => {
							checkOptions.push(options);
							return { mutate: checkMutate, isPending: false };
						},
					},
				},
			},
		},
	};
	return { useAuth: (): AuthStub => auth };
});

function renderPanel(capabilities: readonly CapabilitySlug[]): void {
	render(
		<CapabilitiesProvider capabilities={capabilities}>
			<AccessControlPanel />
		</CapabilitiesProvider>,
	);
}

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
	vi.restoreAllMocks();
	checkOptions.length = 0;
});

/** Clicks `element`, then lets the form's async submit (validation + onSubmit) settle. */
async function clickAndSettle(element: HTMLElement): Promise<void> {
	fireEvent.click(element);
	await act(() => Promise.resolve());
}

describe("AccessControlPanel authorization", () => {
	it("shows every tab when all three permissions are granted", () => {
		renderPanel([PERMISSION.ROLE.LIST, PERMISSION.PERMISSION.LIST, PERMISSION.PERMISSION.READ]);
		expect(screen.getByRole("tab", { name: /Roles/ })).toBeDefined();
		expect(screen.getByRole("tab", { name: /Permissions/ })).toBeDefined();
		expect(screen.getByRole("tab", { name: "Permission checker" })).toBeDefined();
	});

	it("shows only the checker tab (selected) for permission.read alone", () => {
		renderPanel([PERMISSION.PERMISSION.READ]);
		expect(screen.queryByRole("tab", { name: /Roles/ })).toBeNull();
		expect(screen.queryByRole("tab", { name: /Permissions/ })).toBeNull();
		expect(screen.getByRole("tab", { name: "Permission checker" }).getAttribute("aria-selected")).toBe("true");
	});

	it("selects the first permitted tab — permissions when roles cannot be listed", () => {
		renderPanel([PERMISSION.PERMISSION.LIST, PERMISSION.PERMISSION.READ]);
		expect(screen.queryByRole("tab", { name: /Roles/ })).toBeNull();
		expect(screen.getByRole("tab", { name: /Permissions/ }).getAttribute("aria-selected")).toBe("true");
		expect(screen.getByRole("tab", { name: "Permission checker" }).getAttribute("aria-selected")).toBe("false");
	});

	it("selects the roles tab first when every view is permitted", () => {
		renderPanel([PERMISSION.ROLE.LIST, PERMISSION.PERMISSION.LIST, PERMISSION.PERMISSION.READ]);
		expect(screen.getByRole("tab", { name: /Roles/ }).getAttribute("aria-selected")).toBe("true");
	});
});

describe("AccessControlPanel permission checker", () => {
	const USER_ID = "3f2a8c3e-7a53-4f5c-9d0a-0d6a6b8f2c11";

	it("validates the user id with the shared schema before calling the API", async () => {
		renderPanel([PERMISSION.PERMISSION.READ]);
		fireEvent.change(screen.getByLabelText("User ID"), { target: { value: "not-a-uuid" } });
		await clickAndSettle(screen.getByRole("button", { name: "Check permission" }));

		expect(checkMutate).not.toHaveBeenCalled();
		expect(screen.getByRole("alert")).toBeDefined();
	});

	it("checks the parsed input", async () => {
		renderPanel([PERMISSION.PERMISSION.READ]);
		fireEvent.change(screen.getByLabelText("User ID"), { target: { value: USER_ID } });
		await clickAndSettle(screen.getByRole("button", { name: "Check permission" }));

		expect(checkMutate).toHaveBeenCalledWith({ userId: USER_ID, action: "READ", resource: "USER" });
	});

	it("surfaces a failed check as an error toast", () => {
		const errorToast = vi.spyOn(toastMessage, "error").mockImplementation(() => "toast-id");
		renderPanel([PERMISSION.PERMISSION.READ]);
		checkOptions[0]?.onError?.(new ApiError({ error: "NOT_FOUND", message: "User not found", statusCode: 404 }));

		expect(errorToast).toHaveBeenCalledWith({ title: "Could not check the permission", description: "User not found" });
	});
});
