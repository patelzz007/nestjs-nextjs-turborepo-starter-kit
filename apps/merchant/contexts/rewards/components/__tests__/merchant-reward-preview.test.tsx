// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { MerchantRewardFormValues } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";

import { MerchantRewardPreview } from "@/contexts/rewards/components/merchant-reward-preview";
import { REWARD_FIXTURE_COVER_URL, REWARD_FIXTURE_IMAGE } from "@/test/rewards";

const COMPLETE_DRAFT: MerchantRewardFormValues = {
	rewardType: "DISCOUNT",
	title: "20% off nasi lemak",
	description: "Any nasi lemak set.",
	imageFileIds: [REWARD_FIXTURE_IMAGE.fileId],
	rewardValue: 20,
	startDate: "2026-11-01",
	expiryDate: "2026-11-14",
	quantityTotal: 40,
	maxClaimsPerUser: 1,
	locationScopeType: "ALL_LOCATIONS",
	locationIds: [],
};

const ALL_STORES = { label: "All stores", fullLabel: "All stores" };
const NO_ACTIVITY = { claimCount: 0, redemptionCount: 0 };

interface PreviewHarnessProps {
	readonly defaults: MerchantRewardFormValues;
	readonly withCover: boolean;
}

/** The editor's form reduced to the preview, with one field to type into. */
function PreviewHarness({ defaults, withCover }: PreviewHarnessProps): React.JSX.Element {
	const { control, register } = useForm<MerchantRewardFormValues>({ defaultValues: defaults });
	return (
		<UiKitTestProviders>
			<input aria-label="Title" {...register("title")} />
			<MerchantRewardPreview
				control={control}
				category="cafe"
				status={undefined}
				cover={withCover ? REWARD_FIXTURE_IMAGE : undefined}
				stores={ALL_STORES}
				activity={NO_ACTIVITY}
				actions={<button type="submit">Save as draft</button>}
			/>
		</UiKitTestProviders>
	);
}

function preview(): HTMLElement {
	return screen.getByRole("complementary", { name: "How customers see it" });
}

afterEach((): void => {
	cleanup();
});

describe("MerchantRewardPreview", () => {
	it("draws the reward as the catalog voucher: offer, title, cover, stock and end date", () => {
		render(<PreviewHarness defaults={COMPLETE_DRAFT} withCover />);
		const voucher = within(preview());

		expect(voucher.getByText("20% off")).toBeTruthy();
		expect(voucher.getByText("20% off nasi lemak")).toBeTruthy();
		expect(voucher.getByText("40 of 40 left")).toBeTruthy();
		expect(voucher.getByText("Ends 14 Nov 2026")).toBeTruthy();
		expect(preview().querySelector("img")?.getAttribute("src")).toBe(REWARD_FIXTURE_COVER_URL);
	});

	it("redraws the voucher as the merchant types", () => {
		render(<PreviewHarness defaults={COMPLETE_DRAFT} withCover />);

		act((): void => {
			fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Free teh tarik" } });
		});

		expect(within(preview()).getByText("Free teh tarik")).toBeTruthy();
	});

	it("says the reward is ready once nothing is missing", () => {
		render(<PreviewHarness defaults={COMPLETE_DRAFT} withCover />);

		expect(within(preview()).getByText("Ready to save")).toBeTruthy();
		expect(within(preview()).queryByText("Still needed")).toBeNull();
	});

	it("lists what is still needed, each linking to the section that fixes it", () => {
		render(<PreviewHarness defaults={{ ...COMPLETE_DRAFT, title: "", imageFileIds: [] }} withCover={false} />);
		const list = within(preview()).getByRole("list", { name: "Still needed" });

		expect(within(list).getByRole("link", { name: "Give it a title" }).getAttribute("href")).toBe("#reward-offer");
		expect(within(list).getByRole("link", { name: "Add at least one photo" }).getAttribute("href")).toBe("#reward-photos");
		expect(within(preview()).getByText("Your reward title")).toBeTruthy();
	});

	it("keeps the save buttons beside the preview", () => {
		render(<PreviewHarness defaults={COMPLETE_DRAFT} withCover />);

		expect(within(preview()).getByRole("button", { name: "Save as draft" })).toBeTruthy();
	});
});
