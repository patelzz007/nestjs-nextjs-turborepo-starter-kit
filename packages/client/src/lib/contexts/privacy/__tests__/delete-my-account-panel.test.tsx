// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { epochMs, type AccountErasureResponse } from "@workspace/shared";
import { toastMessage } from "@workspace/ui/components/toast";
import { accessibilityViolations } from "@workspace/ui/testing/axe";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../../api/use-api";
import { ClientTestProviders } from "../../../../testing/client-test-providers";
import { DeleteMyAccountPanel, describeErasureRefusal } from "../delete-my-account-panel";

const SCHEDULED = Date.UTC(2026, 11, 3, 10, 0);
const PENDING: AccountErasureResponse = {
	id: "e-1",
	userId: "u-1",
	status: "PENDING",
	requestedBy: "self",
	reason: null,
	requestedAt: epochMs(Date.UTC(2026, 10, 3, 10, 0)),
	scheduledFor: epochMs(SCHEDULED),
	cancelledAt: null,
	completedAt: null,
};

const mocks = vi.hoisted(() => ({
	erasure: vi.fn(),
	requestAsync: vi.fn(),
	cancel: vi.fn(),
}));

vi.mock("../../identity", () => ({
	useAuth: (): object => ({
		api: {
			privacy: {
				erasure: { useQuery: mocks.erasure },
				requestErasure: { useMutation: (): object => ({ mutateAsync: mocks.requestAsync, isPending: false }) },
				cancelErasure: { useMutation: (): object => ({ mutate: mocks.cancel, isPending: false }) },
			},
		},
	}),
}));

beforeEach((): void => {
	mocks.erasure.mockReturnValue({ data: { data: { erasure: null } } });
	vi.spyOn(toastMessage, "success").mockImplementation(() => "toast");
	vi.spyOn(toastMessage, "error").mockImplementation(() => "toast");
});

afterEach((): void => {
	cleanup();
	vi.restoreAllMocks();
	mocks.requestAsync.mockReset();
	mocks.cancel.mockReset();
});

function Providers({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
	return (
		<ClientTestProviders>
			<QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
		</ClientTestProviders>
	);
}

function renderPanel(): void {
	render(<DeleteMyAccountPanel />, { wrapper: Providers });
}

describe("DeleteMyAccountPanel", () => {
	it("asks for the password in a confirmation before anything happens, then sends it", async () => {
		mocks.requestAsync.mockResolvedValue({ data: PENDING });
		renderPanel();
		fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
		expect(mocks.requestAsync).not.toHaveBeenCalled();

		fireEvent.change(await screen.findByLabelText("Your password"), { target: { value: "hunter2-hunter2" } });
		const confirm = screen.getAllByRole("button", { name: "Delete my account" }).at(-1);
		if (confirm === undefined) {
			throw new Error("no confirm button");
		}
		fireEvent.click(confirm);
		await waitFor((): void => {
			expect(mocks.requestAsync).toHaveBeenCalledWith({ password: "hunter2-hunter2" });
		});
		expect(toastMessage.success).toHaveBeenCalled();
	});

	it("lists what blocks the erasure", async () => {
		mocks.requestAsync.mockRejectedValue(
			new ApiError(
				{ error: "CONFLICT", message: "This account can't be erased yet." },
				{ details: { reason: "ACCOUNT_ERASURE_BLOCKED", blockers: ["You own a business on the platform."] } },
			),
		);
		renderPanel();
		fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
		fireEvent.change(await screen.findByLabelText("Your password"), { target: { value: "pw" } });
		const confirm = screen.getAllByRole("button", { name: "Delete my account" }).at(-1);
		if (confirm !== undefined) {
			fireEvent.click(confirm);
		}
		expect((await screen.findByRole("alert")).textContent).toContain("You own a business on the platform.");
	});

	it("shows the date of a pending erasure and lets the person keep their account", () => {
		mocks.erasure.mockReturnValue({ data: { data: { erasure: PENDING } } });
		renderPanel();
		expect(document.querySelector("[data-slot=erasure-pending]")?.textContent).toMatch(/Your account will be deleted on .*2026/u);
		fireEvent.click(screen.getByRole("button", { name: "Keep my account" }));
		expect(mocks.cancel).toHaveBeenCalled();
	});

	it("has no serious accessibility problems (enhancement 3.2)", async () => {
		renderPanel();
		await expect(accessibilityViolations(document.body)).resolves.toStrictEqual([]);
	});
});

describe("describeErasureRefusal", () => {
	it("reads the blockers from an API error, and falls back to its message", () => {
		const blocked = new ApiError({ error: "CONFLICT", message: "Blocked" }, { details: { blockers: ["A", "B"] } });
		expect(describeErasureRefusal(blocked)).toStrictEqual({ message: "Blocked", blockers: ["A", "B"] });
		expect(describeErasureRefusal(new Error("That password isn't right."))).toStrictEqual({ message: "That password isn't right.", blockers: [] });
	});
});
