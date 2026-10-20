"use client";

import { MerchantRewardImagesField, REWARD_IMAGES_GUIDANCE, type SavedRewardImage } from "@/contexts/rewards/components/merchant-reward-images-field";
import { MAX_CLAIMS_OPTIONS, MIN_SPEND_PREFIX, REWARD_TYPE_OPTIONS, getRewardValueField } from "@/contexts/rewards/components/merchant-reward-form.constants";
import { RewardEditorSection } from "@/contexts/rewards/components/reward-editor-section";
import { optionalNumberInput } from "@/lib/forms/optional-number-input";
import { formatClaimLimitCount } from "@/contexts/rewards/lib/reward-detail";
import { RewardTypeSchema, type MerchantRewardFormValues } from "@workspace/shared";
import { DatePicker } from "@workspace/ui/components/date-picker";
import { Input } from "@workspace/ui/components/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@workspace/ui/components/input-group";
import { Label } from "@workspace/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import { Select, SelectContent, SelectItem, type SelectOption, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { Textarea } from "@workspace/ui/components/textarea";
import * as React from "react";
import type { Control, ControllerRenderProps, FieldErrors, UseFormRegister, UseFormSetValue } from "react-hook-form";
import { Controller, useWatch } from "react-hook-form";

/** The per-customer claim limits as `{ value, label }` — the select's `items` and its rendered options. */
const MAX_CLAIMS_SELECT_OPTIONS: readonly SelectOption<string>[] = MAX_CLAIMS_OPTIONS.map((option): SelectOption<string> => ({
	value: String(option),
	label: formatClaimLimitCount(option),
}));

/** The id of a field's error message — the input points at it with `aria-describedby`. */
function errorIdOf(field: keyof MerchantRewardFormValues): string {
	return `${field}-error`;
}

interface FieldMessageProps {
	readonly field: keyof MerchantRewardFormValues;
	readonly message: string | undefined;
}

/** A field's validation message, right under it and announced when it appears. */
function FieldMessage({ field, message }: FieldMessageProps): React.JSX.Element | null {
	if (message === undefined) {
		return null;
	}
	return (
		<p id={errorIdOf(field)} role="alert" className="text-sm text-destructive">
			{message}
		</p>
	);
}

/** `aria-invalid` / `aria-describedby` for an input whose field may carry an error. */
function invalidProps(field: keyof MerchantRewardFormValues, message: string | undefined): Pick<React.AriaAttributes, "aria-invalid" | "aria-describedby"> {
	return message === undefined ? {} : { "aria-invalid": true, "aria-describedby": errorIdOf(field) };
}

export interface MerchantRewardFormFieldsProps {
	readonly register: UseFormRegister<MerchantRewardFormValues>;
	readonly control: Control<MerchantRewardFormValues>;
	readonly errors: FieldErrors<MerchantRewardFormValues>;
	readonly setValue: UseFormSetValue<MerchantRewardFormValues>;
	/** The organization photos are uploaded to (`undefined` while it loads). */
	readonly organizationId: string | undefined;
	/** The saved photos in display order when editing; none for a new reward. */
	readonly initialImages: readonly SavedRewardImage[];
	/** The ready photos changed — the editor saves their ids and previews the cover. */
	readonly onImagesChange: (images: readonly SavedRewardImage[]) => void;
	/** The "Where" section's body — store availability — or `null` when the organization has one store. */
	readonly stores: React.ReactNode;
	/** Every field is locked while the reward saves. */
	readonly disabled?: boolean;
}

/**
 * The reward editor's sections — the offer, its photos, when and how many,
 * where, and the fine print — bound to one react-hook-form instance. Shared
 * by creating and editing a reward; validation comes from the form's resolver
 * (the shared reward schema), never from rules written here.
 */
export function MerchantRewardFormFields({
	register,
	control,
	errors,
	setValue,
	organizationId,
	initialImages,
	onImagesChange,
	stores,
	disabled = false,
}: MerchantRewardFormFieldsProps): React.JSX.Element {
	const rewardType = useWatch({ control, name: "rewardType" });
	const maxClaimsPerUser = useWatch({ control, name: "maxClaimsPerUser" });
	const startDate = useWatch({ control, name: "startDate" });
	const valueField = getRewardValueField(rewardType);

	const handleTypeChange = React.useCallback(
		(value: string): void => {
			const parsed = RewardTypeSchema.safeParse(value);
			if (parsed.success) {
				setValue("rewardType", parsed.data, { shouldValidate: true, shouldDirty: true });
			}
		},
		[setValue],
	);

	const handleMaxClaimsChange = React.useCallback(
		(value: string | null): void => {
			if (value !== null) {
				setValue("maxClaimsPerUser", Number(value), { shouldValidate: true, shouldDirty: true });
			}
		},
		[setValue],
	);

	const renderStartDateField = React.useCallback(
		({ field }: { readonly field: ControllerRenderProps<MerchantRewardFormValues, "startDate"> }): React.JSX.Element => (
			<DatePicker id="startDate" value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} disabled={disabled} placeholder="Select start date" />
		),
		[disabled],
	);

	const renderExpiryDateField = React.useCallback(
		({ field }: { readonly field: ControllerRenderProps<MerchantRewardFormValues, "expiryDate"> }): React.JSX.Element => (
			<DatePicker
				id="expiryDate"
				value={field.value}
				onValueChange={field.onChange}
				onBlur={field.onBlur}
				disabled={disabled}
				fromDate={startDate}
				placeholder="Select end date"
			/>
		),
		[disabled, startDate],
	);

	return (
		<>
			<RewardEditorSection id="reward-offer" title="The offer" description="What customers get, and the words they see it in.">
				<div className="flex flex-col gap-2.5">
					<p id="rewardType-label" className="text-sm font-medium text-foreground">
						Reward type
					</p>
					<RadioGroup aria-labelledby="rewardType-label" value={rewardType} onValueChange={handleTypeChange} disabled={disabled} className="flex flex-wrap gap-2">
						{REWARD_TYPE_OPTIONS.map((option): React.JSX.Element => {
							const Icon = option.icon;
							return (
								<Label
									key={option.value}
									data-slot="reward-type-option"
									className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5 font-normal transition-colors duration-150 hover:border-foreground/20 has-data-checked:border-primary has-data-checked:bg-primary/5 has-data-disabled:cursor-not-allowed has-data-disabled:opacity-60 motion-reduce:transition-none dark:has-data-checked:bg-primary/10">
									<RadioGroupItem value={option.value} />
									<Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
									<span className="text-sm text-foreground">{option.label}</span>
								</Label>
							);
						})}
					</RadioGroup>
				</div>

				<div className="grid gap-5 sm:grid-cols-2">
					<div className="flex flex-col gap-2">
						<Label htmlFor="rewardValue">{valueField.label}</Label>
						<InputGroup>
							<InputGroupInput
								id="rewardValue"
								type="number"
								inputMode="numeric"
								min={0}
								placeholder="0"
								disabled={disabled}
								{...invalidProps("rewardValue", errors.rewardValue?.message)}
								{...register("rewardValue", { valueAsNumber: true })}
							/>
							{valueField.prefix === undefined ? null : (
								<InputGroupAddon>
									<InputGroupText>{valueField.prefix}</InputGroupText>
								</InputGroupAddon>
							)}
							{valueField.suffix === undefined ? null : (
								<InputGroupAddon align="inline-end">
									<InputGroupText>{valueField.suffix}</InputGroupText>
								</InputGroupAddon>
							)}
						</InputGroup>
						<FieldMessage field="rewardValue" message={errors.rewardValue?.message} />
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="minPurchase">
							Minimum spend <span className="font-normal text-muted-foreground">(optional)</span>
						</Label>
						<InputGroup>
							<InputGroupInput
								id="minPurchase"
								type="number"
								inputMode="decimal"
								min={0}
								placeholder="No minimum"
								disabled={disabled}
								{...invalidProps("minPurchase", errors.minPurchase?.message)}
								{...register("minPurchase", { setValueAs: optionalNumberInput })}
							/>
							<InputGroupAddon>
								<InputGroupText>{MIN_SPEND_PREFIX}</InputGroupText>
							</InputGroupAddon>
						</InputGroup>
						<FieldMessage field="minPurchase" message={errors.minPurchase?.message} />
					</div>
				</div>

				<div className="flex flex-col gap-2">
					<Label htmlFor="title">Title</Label>
					<Input id="title" placeholder="e.g. 20% off your first nasi lemak" disabled={disabled} {...invalidProps("title", errors.title?.message)} {...register("title")} />
					<FieldMessage field="title" message={errors.title?.message} />
				</div>

				<div className="flex flex-col gap-2">
					<Label htmlFor="description">Description</Label>
					<Textarea
						id="description"
						placeholder="What customers get, and anything they should know before they come in."
						rows={3}
						disabled={disabled}
						{...invalidProps("description", errors.description?.message)}
						{...register("description")}
					/>
					<FieldMessage field="description" message={errors.description?.message} />
				</div>
			</RewardEditorSection>

			<RewardEditorSection id="reward-photos" title="Photos" description={REWARD_IMAGES_GUIDANCE}>
				<MerchantRewardImagesField
					organizationId={organizationId}
					initialImages={initialImages}
					onImagesChange={onImagesChange}
					errorMessage={errors.imageFileIds?.message}
					disabled={disabled}
				/>
			</RewardEditorSection>

			<RewardEditorSection id="reward-schedule" title="When and how many" description="When customers can claim it, and how many there are to go around.">
				<div className="grid gap-5 sm:grid-cols-2">
					<div className="flex flex-col gap-2">
						<Label htmlFor="startDate">Starts</Label>
						<Controller name="startDate" control={control} render={renderStartDateField} />
						<FieldMessage field="startDate" message={errors.startDate?.message} />
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="expiryDate">Ends</Label>
						<Controller name="expiryDate" control={control} render={renderExpiryDateField} />
						<FieldMessage field="expiryDate" message={errors.expiryDate?.message} />
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="quantityTotal">Available in total</Label>
						<Input
							id="quantityTotal"
							type="number"
							inputMode="numeric"
							min={1}
							disabled={disabled}
							{...invalidProps("quantityTotal", errors.quantityTotal?.message)}
							{...register("quantityTotal", { valueAsNumber: true })}
						/>
						<FieldMessage field="quantityTotal" message={errors.quantityTotal?.message} />
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="maxClaimsPerUser">Each customer can claim it</Label>
						<Select<string> items={MAX_CLAIMS_SELECT_OPTIONS} value={String(maxClaimsPerUser)} onValueChange={handleMaxClaimsChange} disabled={disabled}>
							<SelectTrigger id="maxClaimsPerUser" {...invalidProps("maxClaimsPerUser", errors.maxClaimsPerUser?.message)}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{MAX_CLAIMS_SELECT_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<FieldMessage field="maxClaimsPerUser" message={errors.maxClaimsPerUser?.message} />
					</div>
				</div>
			</RewardEditorSection>

			{stores === null ? null : (
				<RewardEditorSection id="reward-stores" title="Where" description="The stores that accept this reward.">
					{stores}
				</RewardEditorSection>
			)}

			<RewardEditorSection id="reward-terms" title="Terms and conditions" description="Optional. Shown to customers with the reward.">
				<div className="flex flex-col gap-2">
					<Label htmlFor="termsConditions" className="sr-only">
						Terms and conditions
					</Label>
					<Textarea
						id="termsConditions"
						placeholder="e.g. Dine-in only. Not valid with other promotions."
						rows={3}
						disabled={disabled}
						{...invalidProps("termsConditions", errors.termsConditions?.message)}
						{...register("termsConditions")}
					/>
					<FieldMessage field="termsConditions" message={errors.termsConditions?.message} />
				</div>
			</RewardEditorSection>
		</>
	);
}
