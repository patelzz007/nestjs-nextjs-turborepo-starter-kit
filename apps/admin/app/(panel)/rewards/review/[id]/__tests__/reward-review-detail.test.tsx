// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within, type RenderResult } from "@testing-library/react";
import { ApiDownloadError, apiDownloads, type DownloadDef, type DownloadedFile } from "@workspace/client/lib/api/download";
import { CapabilitiesProvider } from "@workspace/client/lib/auth/can";
import { PERMISSION, type AdminRewardImagesArchivePathInput } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import RewardReviewDetailView from "../reward-review-detail";

/** Only the reward fields the page renders. */
interface RewardImageStub {
	readonly fileId: string;
	readonly url: string;
	readonly width: number;
	readonly height: number;
	readonly sources: readonly { readonly width: number; readonly url: string }[];
}

function rewardImage(fileId: string, name: string): RewardImageStub {
	return {
		fileId,
		url: `https://files.example.com/rewards/${name}.webp`,
		width: 3840,
		height: 2160,
		sources: [
			{ width: 640, url: `https://files.example.com/rewards/${name}-640.webp` },
			{ width: 3840, url: `https://files.example.com/rewards/${name}.webp` },
		],
	};
}

const COVER = rewardImage("9f1c2b7e-4d3a-4c8e-9b6f-2a1d5e7c3b40", "free-coffee-cover");
const SECOND_PHOTO = rewardImage("8e0b1a6d-3c29-4b7d-8a5e-1f0c4d6b2a39", "free-coffee-counter");

interface RewardStub {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly termsConditions: string | null;
	readonly organizationName: string;
	readonly organizationLogoUrl: string | null;
	readonly organizationLogoSources: readonly { readonly width: number; readonly url: string }[];
	readonly rewardType: "FREE_ITEM" | "DISCOUNT";
	readonly rewardValue: number;
	readonly status: "PENDING_REVIEW" | "PUBLISHED";
	readonly category: string;
	readonly quantityRemaining: number;
	readonly quantityTotal: number;
	readonly startDate: number | null;
	readonly expiryDate: number;
	readonly locationScopeType: "ALL_LOCATIONS" | "SELECTED";
	readonly locationIds: readonly string[];
	readonly locationNames: readonly string[];
	readonly rules: { readonly minSpendMyr?: number; readonly maxUsePerUser?: number } | null;
	readonly referralsEnabled: boolean;
	readonly referralPoolTotal: number | null;
	readonly referralPoolRemaining: number | null;
	readonly images: readonly RewardImageStub[];
}

interface RewardQueryStub {
	readonly data: { readonly data: RewardStub } | undefined;
	readonly isLoading: boolean;
	readonly isError: boolean;
}

interface MutationOptions {
	readonly onSuccess?: () => Promise<void>;
	readonly onError?: (error: Error) => void;
}

interface MutationStub {
	readonly mutate: (input: object) => void;
	readonly isPending: boolean;
}

interface DownloadInput {
	readonly rewardId: string;
	readonly fileId: string;
}

interface DownloadResult {
	readonly data: { readonly fileId: string; readonly fileName: string; readonly downloadUrl: string; readonly expiresAt: number };
}

const { rewardQuery, approve, reject, routerPush, fetchDownload, downloadArchive, saveDownloadedFile, triggerBrowserDownload, toastMutationError } = vi.hoisted(() => ({
	rewardQuery: vi.fn<(input: { readonly rewardId: string }) => RewardQueryStub>(),
	approve: vi.fn<(input: object) => void>(),
	reject: vi.fn<(input: object) => void>(),
	routerPush: vi.fn<(href: string) => void>(),
	fetchDownload: vi.fn<(input: DownloadInput) => Promise<DownloadResult>>(),
	downloadArchive: vi.fn<(definition: DownloadDef<AdminRewardImagesArchivePathInput>, input: AdminRewardImagesArchivePathInput) => Promise<DownloadedFile>>(),
	saveDownloadedFile: vi.fn<(file: DownloadedFile) => void>(),
	triggerBrowserDownload: vi.fn<(url: string, fileName: string) => void>(),
	toastMutationError: vi.fn<(title: string, error: Error) => void>(),
}));

vi.mock("@workspace/client/lib/storage/browser-download", () => ({ triggerBrowserDownload }));

vi.mock("@workspace/client/lib/api/download", async (importOriginal) => ({ ...(await importOriginal<object>()), saveDownloadedFile }));

vi.mock("@/lib/api/mutation-error", async (importOriginal) => ({ ...(await importOriginal<object>()), toastMutationError }));

vi.mock("next/navigation", () => ({
	useRouter: (): { readonly push: (href: string) => void } => ({ push: routerPush }),
}));

/** A mutation that succeeds (runs `onSuccess`) as soon as it is called, recording its input. */
function succeedingMutation(record: (input: object) => void): { readonly useMutation: (options: MutationOptions) => MutationStub } {
	return {
		useMutation: (options: MutationOptions): MutationStub => ({
			mutate: (input: object): void => {
				record(input);
				void options.onSuccess?.();
			},
			isPending: false,
		}),
	};
}

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({
		api: {
			download: downloadArchive,
			rewardsAdmin: {
				getReward: { useQuery: rewardQuery },
				downloadRewardImage: { fetchOrThrow: fetchDownload },
				approveReward: succeedingMutation(approve),
				rejectReward: succeedingMutation(reject),
			},
		},
	}),
}));

const REWARD: RewardStub = {
	id: "5b2c7e19-0d4a-4e8f-9a3b-6c1d2e3f4a5b",
	title: "Free coffee",
	description: "One free latte with any breakfast set.",
	termsConditions: "Dine-in only.",
	organizationName: "Sunrise Café",
	organizationLogoUrl: null,
	organizationLogoSources: [],
	rewardType: "FREE_ITEM",
	rewardValue: 1,
	status: "PENDING_REVIEW",
	category: "cafe",
	quantityRemaining: 8,
	quantityTotal: 10,
	startDate: null,
	expiryDate: 1_786_300_000_000,
	locationScopeType: "SELECTED",
	locationIds: ["a1", "a2"],
	locationNames: ["Jonker Street", "Bukit Bintang"],
	rules: { minSpendMyr: 30, maxUsePerUser: 1 },
	referralsEnabled: false,
	referralPoolTotal: null,
	referralPoolRemaining: null,
	images: [COVER],
};

function showReward(reward: RewardStub): void {
	rewardQuery.mockReturnValue({ data: { data: reward }, isLoading: false, isError: false });
}

function renderPage(): RenderResult {
	return render(
		<QueryClientProvider client={new QueryClient()}>
			<CapabilitiesProvider capabilities={[PERMISSION.REWARD.MANAGE]}>
				<RewardReviewDetailView rewardId={REWARD.id} />
			</CapabilitiesProvider>
		</QueryClientProvider>,
		{ wrapper: UiKitTestProviders },
	);
}

function factOf(label: string): string | null {
	const term = screen.getByText(label, { selector: "dt" });
	return term.nextElementSibling?.textContent ?? null;
}

/** The photo carousel (Embla) observes sizes and slide visibility — jsdom implements neither. */
class NoopObserver {
	public observe(): void {
		return undefined;
	}
	public unobserve(): void {
		return undefined;
	}
	public disconnect(): void {
		return undefined;
	}
}

beforeAll((): void => {
	vi.stubGlobal("ResizeObserver", NoopObserver);
	vi.stubGlobal("IntersectionObserver", NoopObserver);
	window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() });
});

beforeEach(() => {
	showReward(REWARD);
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("RewardReviewDetailView", () => {
	it("shows the reward in full: status, title, merchant, copy and every condition", () => {
		renderPage();

		expect(rewardQuery).toHaveBeenCalledWith({ rewardId: REWARD.id }, expect.anything());
		expect(screen.getByRole("heading", { level: 1, name: "Free coffee" })).toBeDefined();
		expect(screen.getByText("Pending review")).toBeDefined();
		expect(screen.getByText("Sunrise Café")).toBeDefined();
		expect(screen.getByText("One free latte with any breakfast set.")).toBeDefined();
		expect(screen.getByText("Dine-in only.")).toBeDefined();
		expect(factOf("Offer")).toBe("Free item");
		expect(factOf("Category")).toBe("Café");
		expect(factOf("Quantity")).toBe("8 of 10 left");
		expect(factOf("Starts")).toBe("When approved");
		expect(factOf("Stores")).toBe("Jonker Street, Bukit Bintang");
		expect(factOf("Minimum spend")).toBe("RM 30.00");
		expect(factOf("Uses per customer")).toBe("Once");
		expect(factOf("Referrals")).toBe("Off");
		expect(factOf("Reward ID")).toBe(REWARD.id);
		expect(screen.getByRole("link", { name: "Back to queue" }).getAttribute("href")).toBe("/rewards/review");
	});

	it("says when no terms were given", () => {
		showReward({ ...REWARD, termsConditions: null });
		renderPage();

		expect(screen.getByText("None given.")).toBeDefined();
	});

	it("approves the reward, then returns to the queue", async () => {
		renderPage();

		fireEvent.click(screen.getByRole("button", { name: "Approve" }));

		expect(approve).toHaveBeenCalledWith({ rewardId: REWARD.id });
		await waitFor((): void => {
			expect(routerPush).toHaveBeenCalledWith("/rewards/review");
		});
	});

	it("rejects with the reviewer's reason, trimmed, then returns to the queue", async () => {
		renderPage();

		fireEvent.click(screen.getByRole("button", { name: "Reject" }));
		const dialog = screen.getByRole("dialog", { name: "Reject this reward?" });
		fireEvent.change(within(dialog).getByLabelText("Reason (optional)"), { target: { value: "  Use a photo of the actual latte.  " } });
		fireEvent.click(within(dialog).getByRole("button", { name: "Reject reward" }));

		expect(reject).toHaveBeenCalledWith({ rewardId: REWARD.id, reason: "Use a photo of the actual latte." });
		await waitFor((): void => {
			expect(routerPush).toHaveBeenCalledWith("/rewards/review");
		});
	});

	it("rejects without a reason when none is given", () => {
		renderPage();

		fireEvent.click(screen.getByRole("button", { name: "Reject" }));
		fireEvent.click(within(screen.getByRole("dialog", { name: "Reject this reward?" })).getByRole("button", { name: "Reject reward" }));

		expect(reject).toHaveBeenCalledWith({ rewardId: REWARD.id });
	});

	it("offers no decision on a reward that is no longer pending", () => {
		showReward({ ...REWARD, status: "PUBLISHED" });
		renderPage();

		expect(screen.getByText("Published")).toBeDefined();
		expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
	});

	it("shows the page skeleton while the reward loads", () => {
		rewardQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });
		renderPage();

		expect(screen.getByRole("status").textContent).toBe("Loading reward…");
	});

	it("says so, with a way back, when the reward cannot be loaded", () => {
		rewardQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true });
		renderPage();

		expect(screen.getByText("Could not load this reward.")).toBeDefined();
		expect(screen.getByRole("link", { name: "Back to queue" })).toBeDefined();
	});
});

describe("RewardReviewDetailView photos", () => {
	it("shows a single photo with its renditions, and no carousel controls", () => {
		const { container } = renderPage();

		const cover = container.querySelector('[data-slot="cover-image"] img');
		expect(cover?.getAttribute("src")).toBe(COVER.url);
		expect(cover?.getAttribute("srcset")).toBe(`${COVER.url.replace(".webp", "-640.webp")} 640w, ${COVER.url} 3840w`);
		// Decorative: the title heads the page and every control carries the name.
		expect(cover?.getAttribute("alt")).toBe("");
		expect(container.querySelector('[data-slot="image-carousel"]')).toBeNull();
		expect(screen.getByText("1 photo, 3840 × 2160 pixels")).toBeDefined();
		expect(screen.getByRole("button", { name: "View the photos of Free coffee full size" }).textContent).toBe("View full size");
		expect(screen.getByRole("button", { name: "Download photo 1 of 1 of Free coffee" })).toBeDefined();
		expect(screen.queryByRole("button", { name: /^Download all/ })).toBeNull();
	});

	it("shows several photos as one carousel — never stacked one under another", () => {
		showReward({ ...REWARD, images: [COVER, SECOND_PHOTO] });
		const { container } = renderPage();

		const carousel = container.querySelector('[data-slot="image-carousel"]');
		expect(carousel).not.toBeNull();
		expect(screen.getAllByRole("group").map((slide) => slide.getAttribute("aria-label"))).toEqual(["Image 1 of 2", "Image 2 of 2"]);
		const photos = [...container.querySelectorAll('[data-slot="cover-image"] img')];
		expect(photos).toHaveLength(2);
		expect(photos.every((photo) => carousel?.contains(photo) === true)).toBe(true);
		expect(screen.getByText("2 photos, 3840 × 2160 pixels")).toBeDefined();
	});

	it("opens the photos full size in a carousel dialog, on the photo the page shows", () => {
		showReward({ ...REWARD, images: [COVER, SECOND_PHOTO] });
		renderPage();

		fireEvent.click(screen.getByRole("button", { name: "View the photos of Free coffee full size" }));

		const dialog = screen.getByRole("dialog", { name: "Free coffee" });
		expect(dialog.textContent).toContain("Photo 1 of 2, uploaded at 3840 × 2160 pixels.");
		const viewer = dialog.querySelector('[data-slot="image-carousel"]');
		expect(viewer).not.toBeNull();
		expect([...(viewer?.querySelectorAll("img") ?? [])].map((photo) => photo.getAttribute("loading"))).toEqual(["eager", "lazy"]);
		expect(within(dialog).getByRole("button", { name: "Download photo 1 of 2 of Free coffee" }).textContent).toBe("Download photo 1");
	});

	it("downloads the shown photo's original upload through a fresh signed URL", async () => {
		showReward({ ...REWARD, images: [COVER, SECOND_PHOTO] });
		fetchDownload.mockResolvedValue({
			data: { fileId: COVER.fileId, fileName: "free-coffee-cover.webp", downloadUrl: "https://files.example.com/signed?token=abc", expiresAt: 1_786_300_300_000 },
		});
		renderPage();

		fireEvent.click(screen.getByRole("button", { name: "Download photo 1 of 2 of Free coffee" }));

		await waitFor((): void => {
			expect(triggerBrowserDownload).toHaveBeenCalledWith("https://files.example.com/signed?token=abc", "free-coffee-cover.webp");
		});
		expect(fetchDownload).toHaveBeenCalledWith({ rewardId: REWARD.id, fileId: COVER.fileId });
		expect(toastMutationError).not.toHaveBeenCalled();
	});

	it("says so when a download fails, and lets the reviewer try again", async () => {
		const failure = new Error("Reward image not found");
		fetchDownload.mockRejectedValue(failure);
		renderPage();

		const button = screen.getByRole("button", { name: "Download photo 1 of 1 of Free coffee" });
		fireEvent.click(button);

		await waitFor((): void => {
			expect(toastMutationError).toHaveBeenCalledWith("Download failed", failure);
		});
		expect(triggerBrowserDownload).not.toHaveBeenCalled();
		await waitFor((): void => {
			expect(button.hasAttribute("disabled")).toBe(false);
		});
	});

	it("offers every photo at once as one ZIP, from the page and from the viewer", async () => {
		showReward({ ...REWARD, images: [COVER, SECOND_PHOTO] });
		const archive: DownloadedFile = { blob: new Blob(["PK"]), fileName: "free-coffee-photos.zip", contentType: "application/zip" };
		downloadArchive.mockResolvedValue(archive);
		renderPage();

		const pageButton = screen.getByRole("button", { name: "Download all 2 photos of Free coffee as a ZIP file" });
		expect(pageButton.textContent).toBe("Download all");
		fireEvent.click(pageButton);

		await waitFor((): void => {
			expect(saveDownloadedFile).toHaveBeenCalledWith(archive);
		});
		expect(downloadArchive).toHaveBeenCalledWith(apiDownloads.rewardsAdmin.rewardImagesArchive, { rewardId: REWARD.id });
		expect(fetchDownload).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: "View the photos of Free coffee full size" }));
		const dialog = screen.getByRole("dialog", { name: "Free coffee" });
		fireEvent.click(within(dialog).getByRole("button", { name: "Download all 2 photos of Free coffee as a ZIP file" }));
		await waitFor((): void => {
			expect(saveDownloadedFile).toHaveBeenCalledTimes(2);
		});
		expect(toastMutationError).not.toHaveBeenCalled();
	});

	it("says why the archive failed, and lets the reviewer try again", async () => {
		showReward({ ...REWARD, images: [COVER, SECOND_PHOTO] });
		const failure = new ApiDownloadError({ code: "REWARD_IMAGE_NOT_FOUND", statusCode: 404, message: "Reward image not found" });
		downloadArchive.mockRejectedValue(failure);
		renderPage();

		const button = screen.getByRole("button", { name: "Download all 2 photos of Free coffee as a ZIP file" });
		fireEvent.click(button);

		await waitFor((): void => {
			expect(toastMutationError).toHaveBeenCalledWith("Download failed", failure);
		});
		expect(saveDownloadedFile).not.toHaveBeenCalled();
		await waitFor((): void => {
			expect(button.hasAttribute("disabled")).toBe(false);
		});
	});
});
