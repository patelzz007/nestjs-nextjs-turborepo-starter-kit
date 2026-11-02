// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { BroadcastSaveIntent } from "@workspace/client/lib/features/broadcasts/broadcast-composer-form";
import type { BroadcastDraftInput } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlatformBroadcastComposer, type PlatformBroadcastComposerProps } from "@/contexts/notifications/components/platform-broadcast-composer";
import { emptyPlatformBroadcastValues, type PlatformBroadcastValues } from "@/contexts/notifications/lib/platform-broadcast-composer";

const { previewMutate } = vi.hoisted(() => ({ previewMutate: vi.fn() }));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			notificationsAdmin: {
				broadcastAudiencePreview: {
					useMutation: (): object => ({ mutate: previewMutate, data: { data: { eligible: 120, linked: 125, leftOut: [{ reason: "deleted", count: 5 }] } } }),
				},
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

const WRITTEN: PlatformBroadcastValues = {
	...emptyPlatformBroadcastValues("2026-11-03"),
	title: "Maintenance",
	body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Planned maintenance on Sunday." }] }] },
};

function renderComposer(overrides: Partial<PlatformBroadcastComposerProps> = {}): ReturnType<typeof vi.fn<(draft: BroadcastDraftInput, intent: BroadcastSaveIntent) => void>> {
	const onSave = vi.fn<(draft: BroadcastDraftInput, intent: BroadcastSaveIntent) => void>();
	render(
		<PlatformBroadcastComposer
			senderTimeZone="Asia/Kuala_Lumpur"
			initialValues={WRITTEN}
			canSend
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
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
	vi.unstubAllGlobals();
});

describe("PlatformBroadcastComposer", () => {
	it("saves a product notice to customers as a draft", () => {
		const onSave = renderComposer();
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
		});

		const [draft, intent] = onSave.mock.lastCall ?? [];
		expect(intent).toBe("draft");
		expect(draft).toMatchObject({ title: "Maintenance", category: "PRODUCT", audience: { kind: "platform-users", surfaces: ["CUSTOMER"] } });
	});

	it("sends to the groups picked, as the kind picked", () => {
		const onSave = renderComposer();
		act((): void => {
			fireEvent.click(screen.getByRole("checkbox", { name: /Merchant staff/u }));
			fireEvent.click(screen.getByRole("radio", { name: /Account notice/u }));
		});
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Send" }));
		});

		const [draft, intent] = onSave.mock.lastCall ?? [];
		expect(intent).toBe("send");
		expect(draft).toMatchObject({ category: "ACCOUNT", audience: { surfaces: ["CUSTOMER", "MERCHANT"] } });
	});

	it("narrows merchant staff by their store's state once merchant staff are picked", () => {
		renderComposer();
		expect(screen.queryByRole("radio", { name: "Active stores only" })).toBeNull();

		act((): void => {
			fireEvent.click(screen.getByRole("checkbox", { name: /Merchant staff/u }));
		});

		expect(screen.getByRole("radio", { name: "Active stores only" })).toBeTruthy();
	});

	it("asks for a group of people instead of saving with none", () => {
		const onSave = renderComposer();
		act((): void => {
			fireEvent.click(screen.getByRole("checkbox", { name: /Customers/u }));
		});
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
		});

		expect(onSave).not.toHaveBeenCalled();
		expect(screen.getByText("Choose at least one group of people.")).toBeTruthy();
	});

	it("counts who will get it, and says when it needs a second approval", () => {
		renderComposer({ initialValues: { ...WRITTEN, surfaces: ["CUSTOMER", "MERCHANT", "ADMIN"] } });

		const status = screen.getByRole("status").textContent;
		expect(status).toContain("120 people will get this. 5 left out (5 closed their account).");
		expect(status).toContain("a second staff member approves it");
	});

	it("keeps someone who may not send to drafts, and says why", () => {
		renderComposer({ canSend: false });

		expect(screen.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(true);
		expect(screen.getByText(/You can write drafts/u)).toBeTruthy();
	});
});
