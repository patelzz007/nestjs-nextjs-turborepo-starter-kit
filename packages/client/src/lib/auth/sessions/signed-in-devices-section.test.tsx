// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, useMutation, type UseMutationResult } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { epochMs, LIST_SLOT_INDEX, type Envelope, type RevokeSessionInput, type RevokeSessionResponse, type Session } from "@workspace/shared";
import { toastMessage } from "@workspace/ui/components/toast";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import type { JSX, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { envelopeFixture } from "../../../test/auth-fixtures";
import { apiRouter } from "../../api/endpoints";
import { ApiError } from "../../api/use-api";
import { SIGNED_IN_DEVICES_LABELS, type SignedInDevicesLabels } from "./signed-in-devices-labels";
import { SignedInDevicesSection } from "./signed-in-devices-section";

/** What the stubbed `api.auth.sessions.useQuery` answers. */
interface SessionsQueryState {
	readonly data: Envelope<Session[]> | undefined;
	readonly isPending: boolean;
	readonly isError: boolean;
}

const mocks = vi.hoisted(() => ({
	sessionsState: vi.fn<() => SessionsQueryState>(),
	refetch: vi.fn<() => Promise<void>>(),
	revoke: vi.fn<(input: RevokeSessionInput) => Promise<Envelope<RevokeSessionResponse>>>(),
	logoutEverywhere: vi.fn<() => Promise<boolean>>(),
}));

vi.mock("../index", () => {
	const api = {
		auth: {
			sessions: {
				useQuery: (): SessionsQueryState & { readonly refetch: typeof mocks.refetch } => ({ ...mocks.sessionsState(), refetch: mocks.refetch }),
			},
			revokeSession: {
				// A real TanStack mutation over the stubbed request, so its pending / error state re-renders like the app's.
				useMutation: (): UseMutationResult<Envelope<RevokeSessionResponse>, Error, RevokeSessionInput> =>
					useMutation({ mutationFn: (input: RevokeSessionInput): Promise<Envelope<RevokeSessionResponse>> => mocks.revoke(input) }),
			},
		},
	};
	return {
		useAuth: (): { readonly api: typeof api; readonly logoutEverywhere: typeof mocks.logoutEverywhere } => ({ api, logoutEverywhere: mocks.logoutEverywhere }),
	};
});

const SIGNED_IN_AT_MS = 1_790_000_000_000;
const HOUR_MS = 3_600_000;

const THIS_BROWSER: Session = {
	id: "4b0a6f0e-8c1e-4d47-9a51-0d3f3f9b2c11",
	label: "Chrome 141 on macOS",
	isCurrent: true,
	clientType: "web",
	browserName: "Chrome",
	browserVersion: "141.0.7390.54",
	osName: "macOS",
	osVersion: "16.1",
	deviceType: "DESKTOP",
	deviceModel: null,
	deviceName: null,
	appVersion: null,
	signInMethod: "PASSWORD_TOTP",
	ipAddress: "203.0.113.24",
	lastIpAddress: "203.0.113.24",
	location: null,
	createdAt: epochMs(SIGNED_IN_AT_MS),
	lastActiveAt: epochMs(SIGNED_IN_AT_MS + HOUR_MS),
	expiresAt: epochMs(SIGNED_IN_AT_MS + 7 * 24 * HOUR_MS),
};

const PHONE: Session = {
	...THIS_BROWSER,
	id: "8f6f2d55-1c0f-4c3e-9b8e-6a1f2b3c4d5e",
	label: "Alex’s iPhone",
	isCurrent: false,
	clientType: "mobile",
	browserName: "CFNetwork",
	browserVersion: null,
	osName: "iOS",
	osVersion: null,
	deviceType: "MOBILE",
	deviceModel: "iPhone 15 Pro",
	deviceName: "Alex’s iPhone",
	appVersion: "1.4.0",
	signInMethod: "PASSWORD_NEW_DEVICE_CODE",
	ipAddress: "198.51.100.7",
	lastIpAddress: "198.51.100.99",
	location: { country: "MY", region: "Selangor", city: "Petaling Jaya" },
};

const MERCHANT_TABLET: Session = {
	...THIS_BROWSER,
	id: "c2d7f1a4-9b3e-4f6a-8d2c-1e5b7a9c3f01",
	label: "Chrome 141 on Android",
	isCurrent: false,
	clientType: "merchant",
	osName: "Android",
	osVersion: "14",
	deviceType: "TABLET",
	signInMethod: null,
};

function listed(sessions: Session[]): SessionsQueryState {
	return { data: envelopeFixture(sessions), isPending: false, isError: false };
}

let queryClient: QueryClient;

function Providers({ children }: { readonly children: ReactNode }): JSX.Element {
	return (
		<QueryClientProvider client={queryClient}>
			<UiKitTestProviders>{children}</UiKitTestProviders>
		</QueryClientProvider>
	);
}

function renderSection(labels?: SignedInDevicesLabels): void {
	render(<SignedInDevicesSection {...(labels === undefined ? {} : { labels })} />, { wrapper: Providers });
}

function rowOf(label: string): HTMLElement {
	const row = screen.getByText(label).closest("li");
	if (row === null) {
		throw new Error(`No row for ${label}`);
	}
	return row;
}

beforeEach(() => {
	vi.clearAllMocks();
	queryClient = new QueryClient();
	mocks.sessionsState.mockReturnValue(listed([THIS_BROWSER, PHONE, MERCHANT_TABLET]));
	mocks.refetch.mockResolvedValue(undefined);
	mocks.revoke.mockResolvedValue(envelopeFixture({ message: "Device signed out", revokedCurrentSession: false }));
	mocks.logoutEverywhere.mockResolvedValue(true);
	vi.spyOn(toastMessage, "success").mockImplementation(() => "toast");
	vi.spyOn(toastMessage, "error").mockImplementation(() => "toast");
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("SignedInDevicesSection — states", () => {
	it("shows a loading state while the list loads", () => {
		mocks.sessionsState.mockReturnValue({ data: undefined, isPending: true, isError: false });
		renderSection();

		expect(screen.getByRole("status", { name: SIGNED_IN_DEVICES_LABELS.loading })).toBeDefined();
		expect(screen.queryByRole("list")).toBeNull();
	});

	it("shows an error with a retry that refetches the list", () => {
		mocks.sessionsState.mockReturnValue({ data: undefined, isPending: false, isError: true });
		renderSection();

		expect(screen.getByText(SIGNED_IN_DEVICES_LABELS.loadErrorTitle)).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: SIGNED_IN_DEVICES_LABELS.retry }));

		expect(mocks.refetch).toHaveBeenCalledTimes(1);
	});

	it("shows the empty state when no device is listed", () => {
		mocks.sessionsState.mockReturnValue(listed([]));
		renderSection();

		expect(screen.getByText(SIGNED_IN_DEVICES_LABELS.empty)).toBeDefined();
	});
});

describe("SignedInDevicesSection — the list", () => {
	it("lists every device in the server's order, the current one marked 'This device' with no revoke button", () => {
		renderSection();

		const rows = within(screen.getByRole("list", { name: SIGNED_IN_DEVICES_LABELS.listLabel })).getAllByRole("listitem");
		expect(rows.map((row) => row.querySelector("p")?.textContent)).toEqual(["Chrome 141 on macOS", "Alex’s iPhone", "Chrome 141 on Android"]);
		const current = rowOf(THIS_BROWSER.label);
		expect(within(current).getByText("This device")).toBeDefined();
		expect(within(current).queryByRole("button")).toBeNull();
		expect(within(rowOf(PHONE.label)).getByRole("button", { name: "Revoke Alex’s iPhone" })).toBeDefined();
	});

	it("shows a browser session's app, browser and OS, sign-in method and IPs", () => {
		renderSection();
		const current = within(rowOf(THIS_BROWSER.label));

		expect(current.getByText("Web")).toBeDefined();
		expect(current.getByText("Chrome 141 · macOS 16")).toBeDefined();
		expect(current.getByText("Password + 2FA")).toBeDefined();
		expect(current.getAllByText("203.0.113.24")).toHaveLength(2);
		expect(current.queryByText(SIGNED_IN_DEVICES_LABELS.fields.location, { exact: false })).toBeNull();
	});

	it("shows a mobile session's model, app version, first and last IP and location", () => {
		renderSection();
		const phone = within(rowOf(PHONE.label));

		expect(phone.getByText("Mobile app")).toBeDefined();
		expect(phone.getByText("iPhone 15 Pro · iOS")).toBeDefined();
		expect(phone.getByText("App 1.4.0")).toBeDefined();
		expect(phone.getByText("Password + new-device code")).toBeDefined();
		expect(phone.getByText("198.51.100.7")).toBeDefined();
		expect(phone.getByText("198.51.100.99")).toBeDefined();
		expect(phone.getByText("Petaling Jaya, Selangor, MY")).toBeDefined();
	});

	it("hides the details a session does not have (no sign-in method recorded)", () => {
		renderSection();

		expect(within(rowOf(MERCHANT_TABLET.label)).queryByText(SIGNED_IN_DEVICES_LABELS.fields.signInMethod, { exact: false })).toBeNull();
		expect(within(rowOf(MERCHANT_TABLET.label)).getByText("Merchant")).toBeDefined();
	});

	it("renders a device name as text, never as markup", () => {
		const hostile: Session = { ...PHONE, label: "<img src=x onerror=alert(1)>" };
		mocks.sessionsState.mockReturnValue(listed([THIS_BROWSER, hostile]));
		renderSection();

		expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeDefined();
		expect(document.querySelector("img")).toBeNull();
	});

	it("uses the labels it is given", () => {
		renderSection({ ...SIGNED_IN_DEVICES_LABELS, thisDevice: "Cet appareil", signOutEverywhere: "Se déconnecter partout" });

		expect(screen.getByText("Cet appareil")).toBeDefined();
		expect(screen.getByRole("button", { name: "Se déconnecter partout" })).toBeDefined();
	});
});

describe("SignedInDevicesSection — revoking a device", () => {
	it("asks for confirmation naming the device, revokes it, confirms with a toast and refreshes the list", async () => {
		const invalidate = vi.spyOn(queryClient, "invalidateQueries");
		renderSection();

		fireEvent.click(screen.getByRole("button", { name: "Revoke Alex’s iPhone" }));
		const dialog = await screen.findByRole("alertdialog");
		expect(within(dialog).getByText("Sign out “Alex’s iPhone”?")).toBeDefined();
		expect(mocks.revoke).not.toHaveBeenCalled();

		fireEvent.click(within(dialog).getByRole("button", { name: SIGNED_IN_DEVICES_LABELS.revokeConfirm }));

		await waitFor((): void => {
			expect(toastMessage.success).toHaveBeenCalledWith({ title: "Device signed out", description: "Alex’s iPhone has been signed out." });
		});
		expect(mocks.revoke).toHaveBeenCalledWith({ sessionId: PHONE.id });
		expect(invalidate.mock.lastCall?.[LIST_SLOT_INDEX.first]).toEqual({ queryKey: apiRouter.auth.sessions.scopeKey(undefined) });
		await waitFor((): void => {
			expect(screen.queryByRole("alertdialog")).toBeNull();
		});
	});

	it("does nothing when the confirmation is cancelled", async () => {
		renderSection();

		fireEvent.click(screen.getByRole("button", { name: "Revoke Alex’s iPhone" }));
		const dialog = await screen.findByRole("alertdialog");
		fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

		await waitFor((): void => {
			expect(screen.queryByRole("alertdialog")).toBeNull();
		});
		expect(mocks.revoke).not.toHaveBeenCalled();
	});

	it("keeps the dialog open with the API's error when the revoke fails", async () => {
		mocks.revoke.mockRejectedValue(new ApiError({ message: "Session not found.", statusCode: 404 }));
		renderSection();

		fireEvent.click(screen.getByRole("button", { name: "Revoke Alex’s iPhone" }));
		const dialog = await screen.findByRole("alertdialog");
		fireEvent.click(within(dialog).getByRole("button", { name: SIGNED_IN_DEVICES_LABELS.revokeConfirm }));

		expect(await within(dialog).findByRole("alert")).toBeDefined();
		expect(within(dialog).getByText("Session not found.")).toBeDefined();
		expect(toastMessage.success).not.toHaveBeenCalled();
	});
});

describe("SignedInDevicesSection — sign out everywhere", () => {
	it("explains that it includes this device and the mobile app, then signs out everywhere", async () => {
		renderSection();

		fireEvent.click(screen.getByRole("button", { name: SIGNED_IN_DEVICES_LABELS.signOutEverywhere }));
		const dialog = await screen.findByRole("alertdialog");
		expect(within(dialog).getByText(SIGNED_IN_DEVICES_LABELS.signOutEverywhereDescription)).toBeDefined();
		expect(mocks.logoutEverywhere).not.toHaveBeenCalled();

		fireEvent.click(within(dialog).getByRole("button", { name: SIGNED_IN_DEVICES_LABELS.signOutEverywhereConfirm }));

		await waitFor((): void => {
			expect(mocks.logoutEverywhere).toHaveBeenCalledTimes(1);
		});
		expect(toastMessage.error).not.toHaveBeenCalled();
	});

	it("says so when the API did not confirm the sign-out", async () => {
		mocks.logoutEverywhere.mockResolvedValue(false);
		renderSection();

		fireEvent.click(screen.getByRole("button", { name: SIGNED_IN_DEVICES_LABELS.signOutEverywhere }));
		const dialog = await screen.findByRole("alertdialog");
		fireEvent.click(within(dialog).getByRole("button", { name: SIGNED_IN_DEVICES_LABELS.signOutEverywhereConfirm }));

		await waitFor((): void => {
			expect(toastMessage.error).toHaveBeenCalledWith({
				title: SIGNED_IN_DEVICES_LABELS.signOutEverywhereFailedTitle,
				description: SIGNED_IN_DEVICES_LABELS.signOutEverywhereFailedDescription,
			});
		});
	});
});
