// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { BroadcastDraftInput } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MerchantBroadcastComposer, type BroadcastSaveIntent, type MerchantBroadcastComposerProps } from "@/contexts/notifications/components/merchant-broadcast-composer";
import { emptyBroadcastComposerValues, type BroadcastComposerValues } from "@/contexts/notifications/lib/broadcast-composer";

const { previewMutate, customersQuery } = vi.hoisted(() => ({ previewMutate: vi.fn(), customersQuery: vi.fn() }));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			tenantNotifications: {
				broadcastAudiencePreview: {
					useMutation: (): object => ({ mutate: previewMutate, data: { data: { eligible: 12, linked: 15, leftOut: [{ reason: "no-consent", count: 3 }] } } }),
				},
				broadcastCustomers: { useQuery: customersQuery },
			},
		},
	}),
}));

/** jsdom has no ResizeObserver. */
class ResizeObserverStub {
	public observe(): void {
		return;
	}
	public unobserve(): void {
		return;
	}
	public disconnect(): void {
		return;
	}
}

const WRITTEN: BroadcastComposerValues = {
	...emptyBroadcastComposerValues("2026-11-03"),
	title: "Weekend specials",
	body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Half price lattes." }] }] },
};

function renderComposer(overrides: Partial<MerchantBroadcastComposerProps> = {}): ReturnType<typeof vi.fn<(draft: BroadcastDraftInput, intent: BroadcastSaveIntent) => void>> {
	const onSave = vi.fn<(draft: BroadcastDraftInput, intent: BroadcastSaveIntent) => void>();
	render(
		<MerchantBroadcastComposer
			tenantSlug="sunrise-cafe"
			storeTimeZone="Asia/Kuala_Lumpur"
			initialValues={WRITTEN}
			initialCustomers={[]}
			canSend
			sendBlockedReason={null}
			isSaving={false}
			savingIntent={undefined}
			onSave={onSave}
			cancel={null}
			{...overrides}
		/>,
		{ wrapper: UiKitTestProviders },
	);
	return onSave;
}

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
	customersQuery.mockReturnValue({ data: { data: [] }, isPending: false, isError: false });
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
	vi.unstubAllGlobals();
});

describe("MerchantBroadcastComposer", () => {
	it("saves a draft to all customers, sent as soon as it is scheduled", () => {
		const onSave = renderComposer();
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
		});

		const [draft, intent] = onSave.mock.lastCall ?? [];
		expect(intent).toBe("draft");
		expect(draft).toMatchObject({ title: "Weekend specials", category: "MARKETING", sendMode: "INSTANT" });
		expect(draft?.audience).toMatchObject({ kind: "tenant-customers", customerIds: null });
	});

	it("sends with the send button", () => {
		const onSave = renderComposer();
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Send" }));
		});

		expect(onSave).toHaveBeenCalledWith(expect.anything(), "send");
	});

	it("says what is missing instead of saving", () => {
		const onSave = renderComposer({ initialValues: emptyBroadcastComposerValues("2026-11-03") });
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
		});

		expect(onSave).not.toHaveBeenCalled();
		expect(screen.getByText("Give it a title.")).toBeTruthy();
		expect(screen.getByText("Write the message.")).toBeTruthy();
	});

	it("counts who will get it, and who is left out and why", () => {
		renderComposer();

		expect(screen.getByRole("status").textContent).toBe("12 customers will get this. 3 left out (3 opted out).");
	});

	it("asks for a customer once the merchant chooses to pick", async () => {
		const onSave = renderComposer();
		act((): void => {
			fireEvent.click(screen.getByRole("radio", { name: /Customers I pick/u }));
		});
		await waitFor((): void => {
			expect(screen.getByRole("searchbox", { name: "Search customers" })).toBeTruthy();
		});
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
		});

		expect(onSave).not.toHaveBeenCalled();
		expect(screen.getByText("Pick at least one customer, or send it to all your customers.")).toBeTruthy();
	});

	it("keeps a member who may not send to drafts, and says why", () => {
		renderComposer({ canSend: false });

		expect(screen.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(true);
		expect(screen.getByText(/Only your store owner can send broadcasts/u)).toBeTruthy();
	});

	it("previews the message as customers will see it", () => {
		renderComposer();

		expect(screen.getByRole("complementary", { name: "Preview" }).textContent).toContain("Half price lattes.");
	});
});
