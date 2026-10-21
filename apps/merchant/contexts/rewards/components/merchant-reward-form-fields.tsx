"use client";

import { MerchantRewardImagesField, REWARD_IMAGES_GUIDANCE, type SavedRewardImage } from "@/contexts/rewards/components/merchant-reward-images-field";
import { MAX_CLAIMS_OPTIONS, MIN_SPEND_PREFIX, REWARD_TYPE_OPTIONS, getRewardValueField } from "@/contexts/rewards/components/merchant-reward-form.constants";
import { RewardEditorSection } from "@/contexts/rewards/components/reward-editor-section";
import { formatClaimLimitCount } from "@/contexts/rewards/lib/reward-detail";
import { RewardEditorTextFieldSchema, type RewardEditorField, type RewardEditorState } from "@/contexts/rewards/lib/reward-editor-form";
import { RewardTypeSchema } from "@workspace/shared";
import { DatePicker } from "@workspace/ui/components/date-picker";
import { Input } from "@workspace/ui/components/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@workspace/ui/components/input-group";
import { Label } from "@workspace/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import { Select, SelectContent, SelectItem, type SelectOption, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { Textarea } from "@workspace/ui/components/textarea";
import * as React from "react";

/** The per-customer claim limits as `{ value, label }` — the select's `items` and its rendered options. */
const MAX_CLAIMS_SELECT_OPTIONS: readonly SelectOption<string>[] = MAX_CLAIMS_OPTIONS.map((option): SelectOption<string> => ({
	value: String(option),
	label: formatClaimLimitCount(option),
}));

/** The id of a field's error message — the input points at it with `aria-describedby`. */
function errorIdOf(field: RewardEditorField): string {
	return `${field}-error`;
}

interface FieldMessageProps {
	readonly field: RewardEditorField;
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
function invalidProps(field: RewardEditorField, message: string | undefined): Pick<React.AriaAttributes, "aria-invalid" | "aria-describedby"> {
	return message === undefined ? {} : { "aria-invalid": true, "aria-describedby": errorIdOf(field) };
}

export interface MerchantRewardFormFieldsProps {
	/** The editor's values, its messages and its setter (`useRewardEditorForm`). */
	readonly editor: RewardEditorState;
	/** The tenant route photos are uploaded through. */
	readonly tenantSlug: string;
	/** The saved photos in display order when editing; none for a new reward. */
	readonly initialImages: readonly SavedRewardImage[];
	/** The ready photos changed — the editor saves their ids and previews the cover. */
	readonly onImagesChange: (images: readonly SavedRewardImage[]) => void;
	/** The "Where" section's body — store availability — or `null` when the tenant has one store. */
	readonly stores: React.ReactNode;
	/** Every field is locked while the reward saves. */
	readonly disabled?: boolean;
}

/**
 * The reward editor's sections — the offer, its photos, when and how many,
 * where, and the fine print — every input controlled by the editor's state.
 * Shared by creating and editing a reward; validation comes from the shared
 * reward schema (`useRewardEditorForm`), never from rules written here.
 */
export function MerchantRewardFormFields({ editor, tenantSlug, initialImages, onImagesChange, stores, disabled = false }: MerchantRewardFormFieldsProps): React.JSX.Element {
	const { values, errors, setField } = editor;
	const valueField = getRewardValueField(values.rewardType);

	const handleTypeChange = React.useCallback(
		(value: string): void => {
			const parsed = RewardTypeSchema.safeParse(value);
			if (parsed.success) {
				setField("rewardType", parsed.data);
			}
		},
		[setField],
	);

	const handleMaxClaimsChange = React.useCallback(
		(value: string | null): void => {
			if (value !== null) {
				setField("maxClaimsPerUser", Number(value));
			}
		},
		[setField],
	);

	// Every text box names its field (`name`), so one handler keeps them all in the editor's state.
	const handleTextChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
			const field = RewardEditorTextFieldSchema.safeParse(event.currentTarget.name);
			if (field.success) {
				setField(field.data, event.currentTarget.value);
			}
		},
		[setField],
	);

	const handleStartDateChange = React.useCallback(
		(value: string): void => {
			setField("startDate", value);
		},
		[setField],
	);
	const handleExpiryDateChange = React.useCallback(
		(value: string): void => {
			setField("expiryDate", value);
		},
		[setField],
	);

	return (
		<>
			<RewardEditorSection id="reward-offer" title="The offer" description="What customers get, and the words they see it in.">
				<div className="flex flex-col gap-2.5">
					<p id="rewardType-label" className="text-sm font-medium text-foreground">
						Reward type
					</p>
					<RadioGroup aria-labelledby="rewardType-label" value={values.rewardType} onValueChange={handleTypeChange} disabled={disabled} className="flex flex-wrap gap-2">
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
								name="rewardValue"
								value={values.rewardValue}
								onChange={handleTextChange}
								{...invalidProps("rewardValue", errors.rewardValue)}
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
						<FieldMessage field="rewardValue" message={errors.rewardValue} />
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
								name="minPurchase"
								value={values.minPurchase}
								onChange={handleTextChange}
								{...invalidProps("minPurchase", errors.minPurchase)}
							/>
							<InputGroupAddon>
								<InputGroupText>{MIN_SPEND_PREFIX}</InputGroupText>
							</InputGroupAddon>
						</InputGroup>
						<FieldMessage field="minPurchase" message={errors.minPurchase} />
					</div>
				</div>

				<div className="flex flex-col gap-2">
					<Label htmlFor="title">Title</Label>
					<Input
						id="title"
						name="title"
						value={values.title}
						onChange={handleTextChange}
						placeholder="e.g. 20% off your first nasi lemak"
						disabled={disabled}
						{...invalidProps("title", errors.title)}
					/>
					<FieldMessage field="title" message={errors.title} />
				</div>

				<div className="flex flex-col gap-2">
					<Label htmlFor="description">Description</Label>
					<Textarea
						id="description"
						placeholder="What customers get, and anything they should know before they come in."
						rows={3}
						disabled={disabled}
						name="description"
						value={values.description}
						onChange={handleTextChange}
						{...invalidProps("description", errors.description)}
					/>
					<FieldMessage field="description" message={errors.description} />
				</div>
			</RewardEditorSection>

			<RewardEditorSection id="reward-photos" title="Photos" description={REWARD_IMAGES_GUIDANCE}>
				<MerchantRewardImagesField
					tenantSlug={tenantSlug}
					initialImages={initialImages}
					onImagesChange={onImagesChange}
					errorMessage={errors.imageFileIds}
					disabled={disabled}
				/>
			</RewardEditorSection>

			<RewardEditorSection id="reward-schedule" title="When and how many" description="When customers can claim it, and how many there are to go around.">
				<div className="grid gap-5 sm:grid-cols-2">
					<div className="flex flex-col gap-2">
						<Label htmlFor="startDate">Starts</Label>
						<DatePicker id="startDate" value={values.startDate} onValueChange={handleStartDateChange} disabled={disabled} placeholder="Select start date" />
						<FieldMessage field="startDate" message={errors.startDate} />
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="expiryDate">Ends</Label>
						<DatePicker
							id="expiryDate"
							value={values.expiryDate}
							onValueChange={handleExpiryDateChange}
							disabled={disabled}
							fromDate={values.startDate}
							placeholder="Select end date"
						/>
						<FieldMessage field="expiryDate" message={errors.expiryDate} />
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="quantityTotal">Available in total</Label>
						<Input
							id="quantityTotal"
							type="number"
							inputMode="numeric"
							min={1}
							disabled={disabled}
							name="quantityTotal"
							value={values.quantityTotal}
							onChange={handleTextChange}
							{...invalidProps("quantityTotal", errors.quantityTotal)}
						/>
						<FieldMessage field="quantityTotal" message={errors.quantityTotal} />
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="maxClaimsPerUser">Each customer can claim it</Label>
						<Select<string> items={MAX_CLAIMS_SELECT_OPTIONS} value={String(values.maxClaimsPerUser)} onValueChange={handleMaxClaimsChange} disabled={disabled}>
							<SelectTrigger id="maxClaimsPerUser" {...invalidProps("maxClaimsPerUser", errors.maxClaimsPerUser)}>
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
						<FieldMessage field="maxClaimsPerUser" message={errors.maxClaimsPerUser} />
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
						name="termsConditions"
						value={values.termsConditions}
						onChange={handleTextChange}
						{...invalidProps("termsConditions", errors.termsConditions)}
					/>
					<FieldMessage field="termsConditions" message={errors.termsConditions} />
				</div>
			</RewardEditorSection>
		</>
	);
}
