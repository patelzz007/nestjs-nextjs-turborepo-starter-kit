// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { MerchantRewardFormFieldsSchema, type MerchantRewardFormValues } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { useForm } from "react-hook-form";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { MerchantRewardFormFields } from "@/contexts/rewards/components/merchant-reward-form-fields";
import { REWARD_TYPE_OPTIONS } from "@/contexts/rewards/components/merchant-reward-form.constants";

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

const DEFAULTS: MerchantRewardFormValues = {
	rewardType: "DISCOUNT",
	title: "",
	description: "",
	imageFileIds: [],
	rewardValue: 0,
	startDate: "2026-11-01",
	expiryDate: "2026-11-30",
	quantityTotal: 100,
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

/** The editor's form with the shared schema's resolver, around the fields. */
function FieldsHarness({ stores, onValid }: FieldsHarnessProps): React.JSX.Element {
	const { register, control, setValue, handleSubmit, formState } = useForm<MerchantRewardFormValues>({
		resolver: zodResolver(MerchantRewardFormFieldsSchema),
		defaultValues: DEFAULTS,
	});
	const handleFormSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			void handleSubmit(onValid)(event);
		},
		[handleSubmit, onValid],
	);
	return (
		<form onSubmit={handleFormSubmit}>
			<MerchantRewardFormFields
				register={register}
				control={control}
				errors={formState.errors}
				setValue={setValue}
				organizationId={undefined}
				initialImages={[]}
				onImagesChange={ignoreImages}
				stores={stores}
			/>
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

		await act(async (): Promise<void> => {
			fireEvent.click(screen.getByRole("button", { name: "Save" }));
			await Promise.resolve();
		});

		const title = screen.getByLabelText("Title");
		expect(title.getAttribute("aria-invalid")).toBe("true");
		const describedBy = title.getAttribute("aria-describedby");
		expect(describedBy).toBe("title-error");
		expect(document.getElementById("title-error")?.getAttribute("role")).toBe("alert");
		expect(onValid).not.toHaveBeenCalled();
	});
});
