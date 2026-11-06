// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { epochMs, type NotificationPreferencesResponse, type PushDeviceResponse } from "@workspace/shared";
import type { JSX, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { envelopeFixture } from "../../../../testing/auth-fixtures";
import { ClientTestProviders } from "../../../../testing/client-test-providers";
import { minuteToTime, NotificationSettings, timeToMinute } from "../notification-settings";
import { NOTIFICATION_SETTINGS_LABELS } from "../notification-settings-labels";
import { accessibilityViolations } from "@workspace/ui/testing/axe";

const TENANT = "0193f2c4-0000-7000-8000-0000000000c1";
const DEVICE = "0193f2c4-0000-7000-8000-0000000000d1";

/** What the page hands a mutation besides its input: the leave dialog closes once the call settles. */
interface MutateOptions {
	readonly onSettled?: () => void;
}

const mocks = vi.hoisted(() => ({
	preferences: vi.fn<() => NotificationPreferencesResponse>(),
	devices: vi.fn<() => PushDeviceResponse[]>(),
	updatePreferences: vi.fn(),
	updateSchedule: vi.fn(),
	setConsent: vi.fn(),
	leaveTenant: vi.fn<(input: object, options?: MutateOptions) => void>(),
	removePushDevice: vi.fn(),
}));

function mutationOf(mutate: (input: object, options?: MutateOptions) => void): { readonly useMutation: () => object } {
	return { useMutation: (): object => ({ mutate, isPending: false }) };
}

vi.mock("../../../contexts/identity", () => {
	const api = {
		notifications: {
			preferences: { useQuery: (): object => ({ data: envelopeFixture(mocks.preferences()), isError: false }) },
			pushDevices: { useQuery: (): object => ({ data: envelopeFixture(mocks.devices()) }) },
			updatePreferences: mutationOf(mocks.updatePreferences),
			updateSchedule: mutationOf(mocks.updateSchedule),
			setConsent: mutationOf(mocks.setConsent),
			leaveTenant: mutationOf(mocks.leaveTenant),
			removePushDevice: mutationOf(mocks.removePushDevice),
		},
	};
	return { useAuth: (): { readonly api: typeof api } => ({ api }), useAuthClientType: (): "web" => "web" };
});

const PREFERENCES: NotificationPreferencesResponse = {
	tenantId: null,
	categories: [
		{
			category: "SECURITY",
			channels: [
				{ channel: "IN_APP", enabled: true, locked: true, available: true, reason: null },
				{ channel: "PUSH", enabled: true, locked: false, available: false, reason: "no-push-device" },
			],
		},
		{
			category: "MARKETING",
			channels: [
				{ channel: "IN_APP", enabled: false, locked: false, available: true, reason: null },
				{ channel: "PUSH", enabled: false, locked: false, available: false, reason: "no-push-device" },
			],
		},
	],
	platformMarketingConsent: false,
	schedule: { quietHoursEnabled: true, quietStartMinute: 1320, quietEndMinute: 420, timeZone: "Asia/Kuala_Lumpur", digestFrequency: "OFF" },
	tenants: [{ tenantId: TENANT, tenantName: "Sunrise Cafe", marketingConsent: true, left: false }],
};

let queryClient: QueryClient;

function Providers({ children }: { readonly children: ReactNode }): JSX.Element {
	return (
		<QueryClientProvider client={queryClient}>
			<ClientTestProviders>{children}</ClientTestProviders>
		</QueryClientProvider>
	);
}

beforeEach(() => {
	queryClient = new QueryClient();
	mocks.preferences.mockReturnValue(PREFERENCES);
	mocks.devices.mockReturnValue([
		{
			id: DEVICE,
			platform: "ANDROID",
			surface: "CUSTOMER",
			deviceLabel: "Pixel 9",
			appVersion: "1.0.0",
			lastSeenAt: epochMs(Date.UTC(2026, 9, 30)),
			isCurrentSession: false,
			createdAt: epochMs(0),
			updatedAt: epochMs(0),
			isDeleted: false,
			deletedAt: null,
		},
	]);
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("minuteToTime / timeToMinute", () => {
	it("round-trips a minute of the day", () => {
		expect(minuteToTime(1320)).toBe("22:00");
		expect(minuteToTime(5)).toBe("00:05");
		expect(timeToMinute("07:30")).toBe(450);
		expect(timeToMinute("07:30:00")).toBe(450);
		expect(timeToMinute("7am")).toBeNull();
	});
});

describe("NotificationSettings", () => {
	it("has no serious accessibility problems (enhancement 3.2)", async () => {
		render(<NotificationSettings />, { wrapper: Providers });
		await expect(accessibilityViolations(document.body)).resolves.toStrictEqual([]);
	});

	it("gives every node of the tree a title and a subtitle, an ordinary channel included", () => {
		render(<NotificationSettings />, { wrapper: Providers });

		const branch = screen.getByRole("list", { name: "Offers" });
		for (const item of within(branch).getAllByRole("listitem")) {
			const title = item.querySelector('[data-slot="tree-node-title"]');
			const description = item.querySelector('[data-slot="tree-node-description"]');
			expect(title?.textContent).not.toBe("");
			expect(description?.textContent).not.toBe("");
		}
		expect(within(branch).getByText(NOTIFICATION_SETTINGS_LABELS.channelDescriptions.IN_APP)).toBeTruthy();
		expect(screen.getByText(NOTIFICATION_SETTINGS_LABELS.categories.MARKETING.description)).toBeTruthy();
	});

	it("puts the tree in the main column and the smaller settings in the side column", () => {
		render(<NotificationSettings />, { wrapper: Providers });

		const layout = screen.getByTestId("notification-settings-layout");
		expect(layout.className).toContain("lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]");
		const side = screen.getByTestId("notification-settings-side");
		expect(within(side).getByText(NOTIFICATION_SETTINGS_LABELS.scheduleTitle)).toBeTruthy();
		expect(within(side).getByText(NOTIFICATION_SETTINGS_LABELS.devicesTitle)).toBeTruthy();
		expect(within(side).queryByRole("list", { name: "Offers" })).toBeNull();
	});

	it("shows each kind of message as a checkbox with its channels hung under it", () => {
		render(<NotificationSettings />, { wrapper: Providers });

		const security = screen.getByRole("checkbox", { name: "Security" });
		expect(security.getAttribute("aria-checked")).toBe("true");
		expect(security.hasAttribute("data-locked")).toBe(true);
		const offers = screen.getByRole("checkbox", { name: "Offers" });
		expect(offers.getAttribute("aria-checked")).toBe("false");
		expect(offers.hasAttribute("data-disabled")).toBe(false);

		const branch = screen.getByRole("list", { name: "Security" });
		expect(branch.dataset.slot).toBe("tree-branch");
		const locked = within(branch).getByRole("checkbox", { name: "Security: In app" });
		expect(locked.hasAttribute("data-locked")).toBe(true);
		expect(locked.hasAttribute("data-disabled")).toBe(true);
		expect(screen.getByText(NOTIFICATION_SETTINGS_LABELS.locked.SECURITY)).toBeTruthy();
		const phone = within(branch).getByRole("checkbox", { name: "Security: Phone" });
		expect(phone.hasAttribute("data-disabled")).toBe(true);
		expect(phone.hasAttribute("data-locked")).toBe(false);
		expect(screen.getAllByText(NOTIFICATION_SETTINGS_LABELS.unavailable["no-push-device"]).length).toBeGreaterThan(0);
		expect(screen.queryByRole("switch", { name: "Security: In app" })).toBeNull();
	});

	it("hides a channel a kind is never sent on", () => {
		mocks.preferences.mockReturnValue({
			...PREFERENCES,
			categories: [
				{
					category: "PRODUCT",
					channels: [
						{ channel: "IN_APP", enabled: true, locked: false, available: true, reason: null },
						{ channel: "SMS", enabled: false, locked: false, available: false, reason: "not-offered" },
					],
				},
			],
		});
		render(<NotificationSettings />, { wrapper: Providers });

		expect(screen.getByRole("checkbox", { name: "Product news" }).getAttribute("aria-checked")).toBe("true");
		expect(screen.getByRole("checkbox", { name: "Product news: In app" })).toBeTruthy();
		expect(screen.queryByRole("checkbox", { name: "Product news: SMS" })).toBeNull();
	});

	it("saves one channel at a time", async () => {
		render(<NotificationSettings />, { wrapper: Providers });
		fireEvent.click(screen.getByRole("checkbox", { name: "Offers: In app" }));

		await waitFor(() => {
			expect(mocks.updatePreferences).toHaveBeenCalledWith({ tenantId: null, changes: [{ category: "MARKETING", channel: "IN_APP", enabled: true }] });
		});
	});

	it("ticks every channel a kind can use at once, leaving out the ones not available or kept on", async () => {
		mocks.preferences.mockReturnValue({
			...PREFERENCES,
			categories: [
				{
					category: "ACCOUNT",
					channels: [
						{ channel: "IN_APP", enabled: true, locked: true, available: true, reason: null },
						{ channel: "EMAIL", enabled: true, locked: false, available: true, reason: null },
						{ channel: "PUSH", enabled: false, locked: false, available: true, reason: null },
						{ channel: "SMS", enabled: false, locked: false, available: false, reason: "phone-unverified" },
					],
				},
			],
		});
		render(<NotificationSettings />, { wrapper: Providers });

		const account = screen.getByRole("checkbox", { name: "Account" });
		expect(account.getAttribute("aria-checked")).toBe("mixed");
		fireEvent.click(account);

		await waitFor(() => {
			expect(mocks.updatePreferences).toHaveBeenCalledWith({ tenantId: null, changes: [{ category: "ACCOUNT", channel: "PUSH", enabled: true }] });
		});
	});

	it("unticks every channel a kind can change when all of them are on", async () => {
		mocks.preferences.mockReturnValue({
			...PREFERENCES,
			categories: [
				{
					category: "PRODUCT",
					channels: [
						{ channel: "IN_APP", enabled: true, locked: false, available: true, reason: null },
						{ channel: "EMAIL", enabled: true, locked: false, available: true, reason: null },
					],
				},
			],
		});
		render(<NotificationSettings />, { wrapper: Providers });
		fireEvent.click(screen.getByRole("checkbox", { name: "Product news" }));

		await waitFor(() => {
			expect(mocks.updatePreferences).toHaveBeenCalledWith({
				tenantId: null,
				changes: [
					{ category: "PRODUCT", channel: "IN_APP", enabled: false },
					{ category: "PRODUCT", channel: "EMAIL", enabled: false },
				],
			});
		});
	});

	it("turns quiet hours off, keeping the rest of the schedule", async () => {
		render(<NotificationSettings />, { wrapper: Providers });
		fireEvent.click(screen.getByRole("switch", { name: NOTIFICATION_SETTINGS_LABELS.quietHours }));

		await waitFor(() => {
			expect(mocks.updateSchedule).toHaveBeenCalledWith({ ...PREFERENCES.schedule, quietHoursEnabled: false });
		});
	});

	it("records consent per store with the wording version, and leaves a store only once asked", async () => {
		render(<NotificationSettings />, { wrapper: Providers });
		fireEvent.click(screen.getByRole("switch", { name: /Sunrise Cafe/u }));
		fireEvent.click(screen.getByRole("button", { name: NOTIFICATION_SETTINGS_LABELS.leave }));

		await waitFor(() => {
			expect(mocks.setConsent).toHaveBeenCalledWith(expect.objectContaining({ scope: "TENANT", tenantId: TENANT, granted: false, source: "SETTINGS" }));
		});
		expect(await screen.findByText(NOTIFICATION_SETTINGS_LABELS.leaveTitle("Sunrise Cafe"))).toBeTruthy();
		expect(mocks.leaveTenant).not.toHaveBeenCalled();

		const confirm = screen.getAllByRole("button", { name: NOTIFICATION_SETTINGS_LABELS.leave }).at(-1);
		if (confirm === undefined) {
			throw new Error("The dialog has no confirm button");
		}
		fireEvent.click(confirm);
		await waitFor(() => {
			expect(mocks.leaveTenant).toHaveBeenCalledTimes(1);
		});
		const [input, options] = mocks.leaveTenant.mock.calls.at(0) ?? [];
		expect(input).toEqual({ tenantId: TENANT });

		act((): void => {
			options?.onSettled?.();
		});
		await waitFor(() => {
			expect(screen.queryByText(NOTIFICATION_SETTINGS_LABELS.leaveTitle("Sunrise Cafe"))).toBeNull();
		});
	});

	it("shows a store you left as text, not as a switch", () => {
		mocks.preferences.mockReturnValue({ ...PREFERENCES, tenants: [{ tenantId: TENANT, tenantName: "Sunrise Cafe", marketingConsent: false, left: true }] });
		render(<NotificationSettings />, { wrapper: Providers });

		expect(screen.getByText(NOTIFICATION_SETTINGS_LABELS.leftTenant)).toBeTruthy();
		expect(screen.queryByRole("switch", { name: /Sunrise Cafe/u })).toBeNull();
	});

	it("lists the phones and removes one", async () => {
		render(<NotificationSettings />, { wrapper: Providers });
		expect(screen.getByText("Pixel 9")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: NOTIFICATION_SETTINGS_LABELS.removeDevice }));

		await waitFor(() => {
			expect(mocks.removePushDevice).toHaveBeenCalledWith({ deviceId: DEVICE });
		});
	});
});
