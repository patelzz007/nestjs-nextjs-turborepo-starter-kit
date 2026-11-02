// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { describeUnsubscribe, UnsubscribeView } from "@/contexts/notifications/components/unsubscribe-view";

interface MutationState {
	readonly isPending: boolean;
	readonly isError: boolean;
	readonly isSuccess: boolean;
	readonly data: { readonly data: { readonly category: string; readonly channel: string; readonly tenantName: string | null } } | undefined;
}

const { mutate, state } = vi.hoisted(() => ({ mutate: vi.fn(), state: vi.fn<() => MutationState>() }));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({ api: { notifications: { unsubscribe: { useMutation: (): object => ({ mutate, ...state() }) } } } }),
}));

beforeEach((): void => {
	state.mockReturnValue({ isPending: false, isError: false, isSuccess: false, data: undefined });
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

describe("UnsubscribeView", () => {
	it("asks before unsubscribing, so a mail scanner opening the link changes nothing", () => {
		render(<UnsubscribeView token="signed-token" settingsHref="/dashboard/notifications/settings" />);
		expect(mutate).not.toHaveBeenCalled();

		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Unsubscribe" }));
		});

		expect(mutate).toHaveBeenCalledWith({ token: "signed-token" });
	});

	it("says what stopped once it is done", () => {
		state.mockReturnValue({ isPending: false, isError: false, isSuccess: true, data: { data: { category: "MARKETING", channel: "EMAIL", tenantName: "Sunrise Cafe" } } });
		render(<UnsubscribeView token="signed-token" settingsHref="/s" />);

		expect(screen.getByRole("status").textContent).toContain("You won't get offers from Sunrise Cafe by email any more.");
	});

	it("points a missing or rejected link to the settings", () => {
		render(<UnsubscribeView token={null} settingsHref="/s" />);
		expect(screen.getByRole("link", { name: "Notification settings" }).getAttribute("href")).toBe("/s");
		cleanup();
		state.mockReturnValue({ isPending: false, isError: true, isSuccess: false, data: undefined });
		render(<UnsubscribeView token="expired" settingsHref="/s" />);
		expect(screen.getByRole("alert")).toBeTruthy();
	});
});

describe("describeUnsubscribe", () => {
	it("leaves the sender out of a platform message", () => {
		expect(describeUnsubscribe({ category: "PRODUCT", channel: "PUSH", tenantName: null })).toBe("You won't get product news on your phone any more.");
	});
});
