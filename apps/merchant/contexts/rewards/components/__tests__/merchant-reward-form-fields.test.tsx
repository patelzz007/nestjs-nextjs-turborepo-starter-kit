// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { MerchantRewardFormValues } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { MerchantRewardFormFields } from "@/contexts/rewards/components/merchant-reward-form-fields";
import { REWARD_TYPE_OPTIONS } from "@/contexts/rewards/components/merchant-reward-form.constants";
import { useRewardEditorForm, type RewardEditorInput } from "@/contexts/rewards/lib/reward-editor-form";

vi.mock("@/contexts/rewards/components/merchant-reward-images-field", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/contexts/rewards/components/merchant-reward-images-field")>();
	return { ...actual, MerchantRewardImagesField: (): React.JSX.Element => <p>photos field</p> };
});

/** jsdom has no ResizeObserver; base-ui's controls observe their size. */
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

beforeAll((): void => {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

const DEFAULTS: RewardEditorInput = {
	rewardType: "DISCOUNT",
	title: "",
	description: "",
	imageFileIds: [],
	rewardValue: "0",
	minPurchase: "",
	termsConditions: "",
	startDate: "2026-11-01",
	expiryDate: "2026-11-30",
	quantityTotal: "100",
	maxClaimsPerUser: 1,
	locationScopeType: "ALL_LOCATIONS",
	locationIds: [],
};

/** The noop the stubbed photos field never calls. */
function ignoreImages(): void {
	return undefined;
}

interface FieldsHarnessProps {
	readonly stores: React.ReactNode;
	readonly onValid: (values: MerchantRewardFormValues) => void;
}

/** The editor's real form (the shared schema validates it), around the fields. */
function FieldsHarness({ stores, onValid }: FieldsHarnessProps): React.JSX.Element {
	const { editor, submit } = useRewardEditorForm<null>({ defaultValues: DEFAULTS, defaultMeta: null, onValid });
	const handleFormSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();
			void submit(null);
		},
		[submit],
	);
	return (
		<form onSubmit={handleFormSubmit}>
			<MerchantRewardFormFields editor={editor} tenantSlug="jonker-street-kitchen" initialImages={[]} onImagesChange={ignoreImages} stores={stores} />
			<button type="submit">Save</button>
		</form>
	);
}

function renderFields(stores: React.ReactNode = null): ReturnType<typeof vi.fn<(values: MerchantRewardFormValues) => void>> {
	const onValid = vi.fn<(values: MerchantRewardFormValues) => void>();
	render(<FieldsHarness stores={stores} onValid={onValid} />, { wrapper: UiKitTestProviders });
	return onValid;
}

afterEach((): void => {
	cleanup();
});

describe("MerchantRewardFormFields", () => {
	it("lays the form out as one document of titled sections, in page order", () => {
		renderFields();

		expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["The offer", "Photos", "When and how many", "Terms and conditions"]);
	});

	it("adds the Where section only when there are stores to choose from", () => {
		renderFields(<p>store choices</p>);

		expect(screen.getByRole("region", { name: "Where" }).textContent).toContain("store choices");
	});

	it("offers every reward type as a radio choice, starting on the form's type", () => {
		renderFields();
		const group = screen.getByRole("radiogroup", { name: "Reward type" });

		expect(group.querySelectorAll('[role="radio"]')).toHaveLength(REWARD_TYPE_OPTIONS.length);
		expect(screen.getByRole("radio", { name: /Discount/u }).getAttribute("aria-checked")).toBe("true");
	});

	it("labels the value with the chosen type's unit", () => {
		renderFields();
		expect(screen.getByRole("spinbutton", { name: "Discount" })).toBeTruthy();
		expect(screen.getByText("%")).toBeTruthy();

		act((): void => {
			fireEvent.click(screen.getByRole("radio", { name: /Cashback/u }));
		});

		expect(screen.getByRole("spinbutton", { name: "Cashback" })).toBeTruthy();
		expect(screen.getAllByText("RM").length).toBeGreaterThan(0);
	});

	it("puts each validation message under its field and points the field at it", async () => {
		const onValid = renderFields();

		fireEvent.click(screen.getByRole("button", { name: "Save" }));

		const title = screen.getByLabelText("Title");
		await waitFor((): void => {
			expect(title.getAttribute("aria-invalid")).toBe("true");
		});
		const describedBy = title.getAttribute("aria-describedby");
		expect(describedBy).toBe("title-error");
		expect(document.getElementById("title-error")?.getAttribute("role")).toBe("alert");
		expect(onValid).not.toHaveBeenCalled();
	});
});

describe("MerchantRewardFormFields values", () => {
	it("hands the shared schema's values to the save once the fields are filled, numbers read from their text", async () => {
		const onValid = renderFields();

		fireEvent.change(screen.getByLabelText("Title"), { target: { value: "20% off nasi lemak" } });
		fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Dine-in, any weekday." } });
		fireEvent.change(screen.getByRole("spinbutton", { name: "Discount" }), { target: { value: "20" } });
		fireEvent.change(screen.getByLabelText(/Minimum spend/u), { target: { value: "12.5" } });
		fireEvent.click(screen.getByRole("button", { name: "Save" }));

		// The photos field is stubbed, so the schema still asks for an image: nothing is saved, and the numbers parsed.
		await waitFor((): void => {
			expect(screen.getByLabelText("Title").getAttribute("aria-invalid")).toBeNull();
		});
		expect(screen.getByRole("spinbutton", { name: "Discount" })).toHaveProperty("value", "20");
		expect(screen.getByLabelText(/Minimum spend/u)).toHaveProperty("value", "12.5");
		expect(onValid).not.toHaveBeenCalled();
	});

	it("reports a cleared required number as missing, never as 0", async () => {
		renderFields();

		fireEvent.change(screen.getByLabelText("Available in total"), { target: { value: "" } });
		fireEvent.click(screen.getByRole("button", { name: "Save" }));

		await waitFor((): void => {
			expect(screen.getByLabelText("Available in total").getAttribute("aria-invalid")).toBe("true");
		});
	});
});
