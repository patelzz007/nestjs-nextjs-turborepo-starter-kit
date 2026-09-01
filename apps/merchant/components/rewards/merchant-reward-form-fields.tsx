"use client";

import { MAX_CLAIMS_OPTIONS, REWARD_TYPE_OPTIONS, getRewardValueLabel } from "@/components/rewards/merchant-reward-form.constants";
import type { MerchantRewardFormValues, RewardType } from "@workspace/shared";
import { Button } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/form/select";
import { Textarea } from "@workspace/ui/components/form/textarea";
import { cn } from "@workspace/ui/lib/utils";
import { Tag } from "lucide-react";
import * as React from "react";
import type { Control, FieldErrors, UseFormRegister, UseFormSetValue } from "react-hook-form";
import { useWatch } from "react-hook-form";

interface RewardTypeOptionButtonProps {
	readonly type: (typeof REWARD_TYPE_OPTIONS)[number];
	readonly isSelected: boolean;
	readonly disabled: boolean;
	readonly onSelect: (rewardType: RewardType) => void;
}

const RewardTypeOptionButton = React.forwardRef<HTMLElement, RewardTypeOptionButtonProps>(function RewardTypeOptionButton(
	{ type, isSelected, disabled, onSelect },
	ref,
): React.JSX.Element {
	const Icon = type.icon;

	const handleClick = React.useCallback((): void => {
		onSelect(type.value);
	}, [onSelect, type.value]);

	return (
		<Button
			ref={ref}
			type="button"
			variant="outline"
			disabled={disabled}
			onClick={handleClick}
			className={cn(
				"h-auto flex-col gap-2 rounded-lg border-2 p-4 text-center transition-all",
				disabled ? "cursor-not-allowed opacity-60" : "hover:border-primary/50",
				isSelected ? "border-primary bg-primary/5" : "border-border",
			)}>
			<Icon className={cn("size-6", isSelected ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
			<span className={cn("text-sm font-medium", isSelected ? "text-primary" : "text-foreground")}>{type.label}</span>
		</Button>
	);
});

export interface MerchantRewardFormFieldsProps {
	readonly register: UseFormRegister<MerchantRewardFormValues>;
	readonly control: Control<MerchantRewardFormValues>;
	readonly errors: FieldErrors<MerchantRewardFormValues>;
	readonly setValue: UseFormSetValue<MerchantRewardFormValues>;
	readonly selectedType: RewardType;
	readonly onTypeSelect: (rewardType: RewardType) => void;
	readonly onMaxClaimsChange: (value: string | null) => void;
	readonly readOnly?: boolean;
}

export function MerchantRewardFormFields({
	register,
	control,
	errors,
	selectedType,
	onTypeSelect,
	onMaxClaimsChange,
	readOnly = false,
}: MerchantRewardFormFieldsProps): React.JSX.Element {
	const maxClaimsPerUser = useWatch({ control, name: "maxClaimsPerUser" });
	const fieldDisabled = readOnly;

	return (
		<>
			<Card className="border-border/80 bg-card shadow-xs">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Tag className="size-5 text-primary" aria-hidden="true" />
						Reward Type
					</CardTitle>
					<CardDescription>Choose the type of reward you want to offer</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
						{REWARD_TYPE_OPTIONS.map((type) => (
							<RewardTypeOptionButton key={type.value} type={type} isSelected={selectedType === type.value} disabled={fieldDisabled} onSelect={onTypeSelect} />
						))}
					</div>
					<input type="hidden" {...register("rewardType")} />
				</CardContent>
			</Card>

			<Card className="border-border/80 bg-card shadow-xs">
				<CardHeader>
					<CardTitle>Basic Information</CardTitle>
					<CardDescription>Details about your reward offer</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="title">Reward Title</Label>
						<Input id="title" placeholder="e.g., 20% Off Your First Order" disabled={fieldDisabled} {...register("title")} />
						{errors.title ? <p className="text-sm text-destructive">{errors.title.message}</p> : null}
					</div>

					<div className="space-y-2">
						<Label htmlFor="description">Description</Label>
						<Textarea id="description" placeholder="Describe what customers will get with this reward..." rows={3} disabled={fieldDisabled} {...register("description")} />
						{errors.description ? <p className="text-sm text-destructive">{errors.description.message}</p> : null}
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="rewardValue">{getRewardValueLabel(selectedType)}</Label>
							<Input id="rewardValue" type="number" min={0} placeholder="0" disabled={fieldDisabled} {...register("rewardValue", { valueAsNumber: true })} />
							{errors.rewardValue ? <p className="text-sm text-destructive">{errors.rewardValue.message}</p> : null}
						</div>

						<div className="space-y-2">
							<Label htmlFor="minPurchase">Minimum Purchase (RM)</Label>
							<Input id="minPurchase" type="number" min={0} placeholder="0 (Optional)" disabled={fieldDisabled} {...register("minPurchase", { valueAsNumber: true })} />
							{errors.minPurchase ? <p className="text-sm text-destructive">{errors.minPurchase.message}</p> : null}
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="termsConditions">Terms & Conditions (Optional)</Label>
						<Textarea id="termsConditions" placeholder="Any restrictions or requirements..." rows={2} disabled={fieldDisabled} {...register("termsConditions")} />
						{errors.termsConditions ? <p className="text-sm text-destructive">{errors.termsConditions.message}</p> : null}
					</div>
				</CardContent>
			</Card>

			<Card className="border-border/80 bg-card shadow-xs">
				<CardHeader>
					<CardTitle>Limits & Duration</CardTitle>
					<CardDescription>Set availability and claim limits</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="startDate">Start Date</Label>
							<Input id="startDate" type="date" disabled={fieldDisabled} {...register("startDate")} />
							{errors.startDate ? <p className="text-sm text-destructive">{errors.startDate.message}</p> : null}
						</div>

						<div className="space-y-2">
							<Label htmlFor="expiryDate">Expiry Date</Label>
							<Input id="expiryDate" type="date" disabled={fieldDisabled} {...register("expiryDate")} />
							{errors.expiryDate ? <p className="text-sm text-destructive">{errors.expiryDate.message}</p> : null}
						</div>
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="quantityTotal">Total Available</Label>
							<Input id="quantityTotal" type="number" min={1} disabled={fieldDisabled} {...register("quantityTotal", { valueAsNumber: true })} />
							{errors.quantityTotal ? <p className="text-sm text-destructive">{errors.quantityTotal.message}</p> : null}
						</div>

						<div className="space-y-2">
							<Label htmlFor="maxClaimsPerUser">Max Claims Per User</Label>
							<Select value={String(maxClaimsPerUser)} onValueChange={onMaxClaimsChange} disabled={fieldDisabled}>
								<SelectTrigger id="maxClaimsPerUser">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{MAX_CLAIMS_OPTIONS.map((option) => (
										<SelectItem key={option} value={String(option)}>
											{option}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{errors.maxClaimsPerUser ? <p className="text-sm text-destructive">{errors.maxClaimsPerUser.message}</p> : null}
						</div>
					</div>
				</CardContent>
			</Card>
		</>
	);
}
