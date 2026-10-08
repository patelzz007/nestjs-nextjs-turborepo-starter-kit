// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ApiError } from "@workspace/client/lib/api/api-request";
import { CapabilitiesProvider } from "@workspace/client/lib/auth/can";
import {
	EmailPreviewSchema,
	epochMs,
	LIST_SLOT_INDEX,
	PERMISSION,
	type AdminCreateMerchantInviteInput,
	type AdminMerchantInviteCreatedResponse,
	type AdminMerchantInvitePreviewQuery,
	type CapabilitySlug,
	type EmailPreview,
} from "@workspace/shared";
import { toastMessage } from "@workspace/ui/components/toast";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MerchantInvitesPage from "../page";
import MerchantInvitesPanel from "../merchant-invites-panel";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";

interface MutationCallbacks<TResponse> {
	readonly onSuccess?: (response: TResponse) => void;
}

interface MutationOptions {
	readonly onError?: (error: Error) => void;
}

/** What the mocked preview query hands the panel. */
interface PreviewQueryState {
	readonly data: { readonly data: EmailPreview } | undefined;
	readonly isFetching: boolean;
	readonly isError: boolean;
	readonly refetch: () => Promise<void>;
}

/** The options the panel last passed to the send mutation. */
interface MutationOptionsHolder {
	current: MutationOptions | undefined;
}

/** The debounce the panel waits before re-rendering the preview from typing. */
const PREVIEW_SETTLE_MS = 350;

const { previewQuery, previewState, createMutate, createOptions } = vi.hoisted(() => {
	const options: MutationOptionsHolder = { current: undefined };
	return {
		previewQuery: vi.fn<(input: AdminMerchantInvitePreviewQuery) => void>(),
		previewState: vi.fn<() => PreviewQueryState>(),
		createMutate: vi.fn<(input: AdminCreateMerchantInviteInput, callbacks: MutationCallbacks<{ readonly data: AdminMerchantInviteCreatedResponse }>) => void>(),
		createOptions: options,
	};
});

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({
		api: {
			rewardsAdmin: {
				previewInviteEmail: {
					useQuery: (input: AdminMerchantInvitePreviewQuery): PreviewQueryState => {
						previewQuery(input);
						return previewState();
					},
				},
				createInvite: {
					useMutation: (options: MutationOptions): object => {
						createOptions.current = options;
						return { mutate: createMutate, isPending: false };
					},
				},
			},
		},
	}),
}));

const PREVIEW: EmailPreview = EmailPreviewSchema.parse({
	key: "merchant-invite",
	label: "Merchant invite",
	description: "Onboarding invite for a new merchant",
	to: "owner@cafe.demo",
	subject: "You're invited to join the rewards marketplace",
	previewText: "Complete onboarding for Sunrise Café in Kuala Lumpur.",
	html: "<p>Hello</p>",
	text: "Hello",
	props: {},
});

const CREATED: AdminMerchantInviteCreatedResponse = {
	inviteId: "1c8d3b6f-7a2e-4d3f-8e4b-2a3f4e5d6c7b",
	inviteToken: "invite-token-for-manual-sharing",
	expiresAt: epochMs(1_790_000_000_000),
};

const refetch = vi.fn((): Promise<void> => Promise.resolve());

function renderPanel(capabilities: readonly CapabilitySlug[] = [PERMISSION.MERCHANT_ORG.MANAGE]): void {
	render(
		<CapabilitiesProvider capabilities={capabilities}>
			<MerchantInvitesPanel />
		</CapabilitiesProvider>,
		{ wrapper: UiKitTestProviders },
	);
}

function type(label: string, value: string): void {
	fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

/** Lets the debounce elapse, so the preview catches up with the form. */
function settle(ms: number = PREVIEW_SETTLE_MS): void {
	act((): void => {
		vi.advanceTimersByTime(ms);
	});
}

/** Clicks `element`, then lets the form's async submit (validation + onSubmit) settle. */
async function clickAndSettle(element: HTMLElement): Promise<void> {
	fireEvent.click(element);
	await act(() => Promise.resolve());
}

function lastPreviewQuery(): AdminMerchantInvitePreviewQuery | undefined {
	return previewQuery.mock.lastCall?.[LIST_SLOT_INDEX.first];
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
	previewState.mockReturnValue({ data: { data: PREVIEW }, isFetching: false, isError: false, refetch });
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.clearAllMocks();
	vi.restoreAllMocks();
});

describe("MerchantInvitesPage", () => {
	it("prefetches nothing, so it never needs EMAIL READ", () => {
		expect(MerchantInvitesPage().type).toBe(MerchantInvitesPanel);
	});
});

describe("MerchantInvitesPanel live preview", () => {
	it("renders the invite for the first pilot city at once, before anything is typed", () => {
		renderPanel();

		expect(lastPreviewQuery()).toEqual({ city: "KUALA_LUMPUR" });
		expect(screen.getByRole("heading", { name: PREVIEW.subject })).toBeTruthy();
		expect(screen.getByTitle("Merchant invite preview")).toBeTruthy();
	});

	it("re-renders once the business name stops changing, not on every keystroke", () => {
		renderPanel();
		for (const partial of ["S", "Su", "Sun", "Sunrise Café"]) {
			type("Business", partial);
		}
		expect(lastPreviewQuery()).toEqual({ city: "KUALA_LUMPUR" });

		settle();
		expect(lastPreviewQuery()).toEqual({ businessName: "Sunrise Café", city: "KUALA_LUMPUR" });
		const queriedNames = previewQuery.mock.calls.map((call) => call[LIST_SLOT_INDEX.first].businessName);
		expect(queriedNames).not.toContain("Su");
	});

	it("re-renders for a newly chosen pilot city without waiting", () => {
		renderPanel();

		fireEvent.click(screen.getByRole("button", { name: "Melaka" }));

		expect(lastPreviewQuery()).toEqual({ city: "MELAKA" });
	});

	it("leaves a blank business name to the template's sample", () => {
		renderPanel();
		type("Business", "   ");
		settle();

		expect(lastPreviewQuery()).toEqual({ city: "KUALA_LUMPUR" });
	});

	it("shows the typed recipient on the To line instantly, and never sends it to the preview", () => {
		renderPanel();
		type("To", "owner@cafe.demo");

		expect(screen.getByText("owner@cafe.demo")).toBeTruthy();
		settle();
		expect(JSON.stringify(previewQuery.mock.calls)).not.toContain("owner@cafe.demo");
	});

	it("says it is updating while the business name settles", () => {
		renderPanel();
		expect(screen.getByRole("status").textContent).toBe("Live preview");

		type("Business", "Kopi");
		expect(screen.getByRole("status").textContent).toBe("Updating…");

		settle();
		expect(screen.getByRole("status").textContent).toBe("Live preview");
	});

	it("offers a retry when the preview cannot be rendered", () => {
		previewState.mockReturnValue({ data: undefined, isFetching: false, isError: true, refetch });
		renderPanel();

		fireEvent.click(screen.getByRole("button", { name: "Try again" }));

		expect(refetch).toHaveBeenCalledTimes(1);
	});
});

describe("MerchantInvitesPanel sending", () => {
	it("keeps Send disabled until the email and business name are valid", () => {
		renderPanel();
		const send = screen.getByRole("button", { name: "Send invite" });
		expect(send.hasAttribute("disabled")).toBe(true);

		type("To", "not-an-email");
		type("Business", "Sunrise Café");
		expect(send.hasAttribute("disabled")).toBe(true);

		type("To", "owner@cafe.demo");
		expect(send.hasAttribute("disabled")).toBe(false);
	});

	it("shows the shared schema's error for a field once the admin leaves it", async () => {
		renderPanel();
		type("To", "not-an-email");
		fireEvent.blur(screen.getByLabelText("To"));
		await act(() => Promise.resolve());

		expect(screen.getByLabelText("To").getAttribute("aria-invalid")).toBe("true");
	});

	it("never shows a stale error on the field being typed, and shows a current one once it is left", async () => {
		renderPanel();
		type("To", "owner@cafe.demo");
		fireEvent.blur(screen.getByLabelText("To"));
		await act(() => Promise.resolve());

		type("Business", "Kopi Kita");
		await act(() => Promise.resolve());
		expect(screen.getByLabelText("Business").getAttribute("aria-invalid")).toBe("false");

		type("Business", "");
		fireEvent.blur(screen.getByLabelText("Business"));
		await act(() => Promise.resolve());
		expect(screen.getByLabelText("Business").getAttribute("aria-invalid")).toBe("true");
	});

	it("sends the parsed invite, then shows the token for manual sharing and clears the form", async () => {
		createMutate.mockImplementation((_input, callbacks) => {
			callbacks.onSuccess?.({ data: CREATED });
		});
		const successToast = vi.spyOn(toastMessage, "success").mockImplementation(() => "toast-id");
		renderPanel();
		fireEvent.click(screen.getByRole("button", { name: "Melaka" }));
		type("To", "owner@cafe.demo");
		type("Business", "Sunrise Café");

		await clickAndSettle(screen.getByRole("button", { name: "Send invite" }));

		expect(createMutate.mock.lastCall?.[LIST_SLOT_INDEX.first]).toEqual({ email: "owner@cafe.demo", businessName: "Sunrise Café", city: "MELAKA" });
		expect(successToast).toHaveBeenCalledWith({ title: "Invite sent", description: "Sunrise Café will get the onboarding email at owner@cafe.demo." });
		expect(screen.getByText("Invite sent to owner@cafe.demo")).toBeTruthy();
		expect(screen.getByText(CREATED.inviteToken)).toBeTruthy();
		expect(screen.getByLabelText<HTMLInputElement>("To").value).toBe("");
	});

	it("surfaces a failed send as an error toast with the API reason", () => {
		const errorToast = vi.spyOn(toastMessage, "error").mockImplementation(() => "toast-id");
		renderPanel();
		createOptions.current?.onError?.(new ApiError({ error: "CONFLICT", message: "An open invite already exists for this email", statusCode: 409 }));

		expect(errorToast).toHaveBeenCalledWith({ title: "Invite not sent", description: "An open invite already exists for this email" });
	});

	it("links the template browser only for admins with EMAIL READ", () => {
		renderPanel([PERMISSION.MERCHANT_ORG.MANAGE]);
		expect(screen.queryByRole("link", { name: "Open template" })).toBeNull();
		cleanup();

		renderPanel([PERMISSION.MERCHANT_ORG.MANAGE, PERMISSION.EMAIL.READ]);
		expect(screen.getByRole("link", { name: "Open template" }).getAttribute("href")).toBe("/emails/templates?key=merchant-invite");
	});
});
