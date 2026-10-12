// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RewardCoverUploadInput, UploadedRewardCover } from "@/lib/rewards/use-upload-reward-cover";

import { MerchantRewardCoverField } from "./merchant-reward-cover-field";

const ORGANIZATION_ID = "0d5c7a3e-2b8f-4e61-9c4d-7a1b2c3d4e5f";
const SAVED_URL = "https://cdn.example.com/stores/org/reward-covers/saved.webp";
const UPLOADED: UploadedRewardCover = { fileId: "4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b", publicUrl: "https://cdn.example.com/stores/org/reward-covers/new.webp" };
const LOCAL_URL = "blob:http://localhost/local-preview";

interface MutateCallbacks {
	readonly onSuccess: (cover: UploadedRewardCover) => void;
	readonly onError: (error: Error) => void;
}

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn<(input: RewardCoverUploadInput, callbacks: MutateCallbacks) => void>() }));

vi.mock("@/lib/rewards/use-upload-reward-cover", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/rewards/use-upload-reward-cover")>();
	return { ...actual, useUploadRewardCover: (): object => ({ mutate }) };
});

function renderField(props: Partial<React.ComponentProps<typeof MerchantRewardCoverField>> = {}): { readonly onCoverUploaded: ReturnType<typeof vi.fn> } {
	const onCoverUploaded = vi.fn();
	render(
		<UiKitTestProviders>
			<MerchantRewardCoverField organizationId={ORGANIZATION_ID} initialPreviewUrl={null} onCoverUploaded={onCoverUploaded} {...props} />
		</UiKitTestProviders>,
	);
	return { onCoverUploaded };
}

function pick(file: File): void {
	fireEvent.change(screen.getByLabelText("Cover image"), { target: { files: [file] } });
}

function coverImage(): HTMLImageElement | null {
	return document.querySelector('[data-slot="cover-image"] img');
}

const PHOTO = new File([new Uint8Array(16)], "kuih.webp", { type: "image/webp" });

/** jsdom has no object URLs: the local preview gets a fixed one, and its release is recorded. */
const revokeObjectUrl = vi.fn<(url: string) => void>();

beforeEach((): void => {
	URL.createObjectURL = vi.fn((): string => LOCAL_URL);
	URL.revokeObjectURL = revokeObjectUrl;
});

afterEach((): void => {
	cleanup();
	mutate.mockReset();
	revokeObjectUrl.mockReset();
});

describe("MerchantRewardCoverField", () => {
	it("invites an upload when the reward has no cover yet, with the limits from the upload policy", () => {
		renderField();

		expect(screen.getByRole("button", { name: /Upload a cover image/u })).toBeDefined();
		expect(screen.getByText(/up to 10 MB/u)).toBeDefined();
		expect(screen.getByLabelText("Cover image").getAttribute("accept")).toBe("image/jpeg,image/png,image/webp,image/avif");
	});

	it("previews the picked photo at once, then shows the published cover and saves its id", () => {
		const { onCoverUploaded } = renderField();

		pick(PHOTO);
		expect(mutate).toHaveBeenCalledWith({ organizationId: ORGANIZATION_ID, file: PHOTO }, expect.anything());
		expect(coverImage()?.getAttribute("src")).toBe(LOCAL_URL);
		expect(screen.getByText("Uploading and checking the image…")).toBeDefined();

		const [, callbacks] = mutate.mock.lastCall ?? [];
		act((): void => {
			callbacks?.onSuccess(UPLOADED);
		});

		expect(onCoverUploaded).toHaveBeenCalledWith(UPLOADED);
		expect(coverImage()?.getAttribute("src")).toBe(UPLOADED.publicUrl);
		expect(screen.getByRole("button", { name: "Replace image" })).toBeDefined();
		expect(revokeObjectUrl).toHaveBeenCalledWith(LOCAL_URL);
	});

	it("keeps the saved cover and explains why when an upload fails", () => {
		const { onCoverUploaded } = renderField({ initialPreviewUrl: SAVED_URL });

		pick(PHOTO);
		const [, callbacks] = mutate.mock.lastCall ?? [];
		act((): void => {
			callbacks?.onError(new Error("The image must be at most 10 MB."));
		});

		expect(onCoverUploaded).not.toHaveBeenCalled();
		expect(coverImage()?.getAttribute("src")).toBe(SAVED_URL);
		expect(screen.getByRole("alert").textContent).toBe("The image must be at most 10 MB.");
		expect(screen.getByLabelText("Cover image").getAttribute("aria-invalid")).toBe("true");
	});

	it("accepts a photo dropped on the upload area", () => {
		renderField();

		fireEvent.drop(screen.getByRole("button", { name: /Upload a cover image/u }), { dataTransfer: { files: [PHOTO] } });

		expect(mutate).toHaveBeenCalledWith({ organizationId: ORGANIZATION_ID, file: PHOTO }, expect.anything());
	});

	it("shows the form's message when no cover was chosen", () => {
		renderField({ errorMessage: "Add a cover image" });

		expect(screen.getByRole("alert").textContent).toBe("Add a cover image");
	});

	it("waits for the organization, and stays read-only when the reward cannot be edited", () => {
		renderField({ organizationId: undefined });
		expect(screen.getByRole("button", { name: /Upload a cover image/u }).hasAttribute("disabled")).toBe(true);
		cleanup();

		renderField({ initialPreviewUrl: SAVED_URL, disabled: true });
		expect(screen.getByRole("button", { name: "Replace image" }).hasAttribute("disabled")).toBe(true);
		pick(PHOTO);
		expect(mutate).not.toHaveBeenCalled();
	});
});
