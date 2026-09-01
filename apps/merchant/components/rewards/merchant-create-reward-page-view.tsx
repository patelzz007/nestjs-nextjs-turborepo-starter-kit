"use client";

import { MerchantRewardFormFields } from "@/components/rewards/merchant-reward-form-fields";
import { useAuth } from "@workspace/client/lib/auth";
import {
	mapMerchantCreateRewardFormToInput,
	MerchantRewardFormFieldsSchema,
	type MerchantCreateRewardFormValues,
	type MerchantRewardFormValues,
	type RewardCategory,
	type RewardType,
} from "@workspace/shared";
import { Card, CardContent } from "@workspace/ui/components/display/card";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { Button } from "@workspace/ui/components/form/button";
import { Label } from "@workspace/ui/components/form/label";
import { Switch } from "@workspace/ui/components/form/switch";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, format } from "date-fns";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm, useWatch } from "react-hook-form";

function buildDefaultFormValues(): MerchantRewardFormValues {
	const startDate = new Date();
	const expiryDate = addDays(startDate, 30);

	return {
		rewardType: "DISCOUNT",
		title: "",
		description: "",
		rewardValue: 0,
		startDate: format(startDate, "yyyy-MM-dd"),
		expiryDate: format(expiryDate, "yyyy-MM-dd"),
		quantityTotal: 100,
		maxClaimsPerUser: 1,
	};
}

export interface MerchantCreateRewardPageViewProps {
	readonly defaultCategory: RewardCategory;
}

export function MerchantCreateRewardPageView({ defaultCategory }: MerchantCreateRewardPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();
	const [saveAsDraft, setSaveAsDraft] = React.useState<boolean>(false);

	const {
		register,
		handleSubmit,
		setValue,
		control,
		formState: { errors },
	} = useForm<MerchantRewardFormValues>({
		resolver: zodResolver(MerchantRewardFormFieldsSchema),
		defaultValues: buildDefaultFormValues(),
	});

	const selectedType = useWatch({ control, name: "rewardType" });

	const createMutation = api.merchant.rewards.create.useMutation({
		onSuccess: (response): void => {
			toastMessage.success({
				title: saveAsDraft ? "Draft saved" : "Reward created",
				description: saveAsDraft ? "Your draft is ready to edit." : "Redirecting to reward details.",
			});
			router.push(`/rewards/${response.data.id}`);
		},
		onError: (): void => {
			toastMessage.error({ title: "Create failed", description: "Could not create reward." });
		},
	});

	const handleTypeSelect = React.useCallback(
		(rewardType: RewardType): void => {
			setValue("rewardType", rewardType, { shouldValidate: true });
		},
		[setValue],
	);

	const onSubmit = React.useCallback(
		(form: MerchantRewardFormValues): void => {
			const createForm: MerchantCreateRewardFormValues = { ...form, saveAsDraft };
			const payload = mapMerchantCreateRewardFormToInput(createForm, defaultCategory);
			void createMutation.mutateAsync(payload);
		},
		[createMutation, defaultCategory, saveAsDraft],
	);

	const handleFormSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			void handleSubmit(onSubmit)(event);
		},
		[handleSubmit, onSubmit],
	);

	const handleMaxClaimsChange = React.useCallback(
		(value: string | null): void => {
			if (value !== null) {
				setValue("maxClaimsPerUser", Number(value), { shouldValidate: true });
			}
		},
		[setValue],
	);

	const handleSaveAsDraftChange = React.useCallback((checked: boolean): void => {
		setSaveAsDraft(checked);
	}, []);

	return (
		<div className="mx-auto space-y-6">
			<div className="mb-2 flex items-center gap-4">
				<Link href="/rewards">
					<Button type="button" variant="ghost" size="icon" aria-label="Back to rewards">
						<ArrowLeft className="size-5" aria-hidden="true" />
					</Button>
				</Link>
				<div>
					<h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl">Create Reward</h1>
					<p className="mt-1 text-muted-foreground">Design a new reward campaign</p>
				</div>
			</div>

			<form onSubmit={handleFormSubmit} className="space-y-6">
				<MerchantRewardFormFields
					register={register}
					control={control}
					errors={errors}
					setValue={setValue}
					selectedType={selectedType}
					onTypeSelect={handleTypeSelect}
					onMaxClaimsChange={handleMaxClaimsChange}
				/>

				<Card className="border-border/80 bg-card shadow-xs">
					<CardContent className="p-6">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<Switch id="saveAsDraft" checked={saveAsDraft} onCheckedChange={handleSaveAsDraftChange} />
								<Label htmlFor="saveAsDraft" className="cursor-pointer">
									<span className="font-medium">Save as Draft</span>
									<span className="block text-sm text-muted-foreground">Don&apos;t publish yet, save for later</span>
								</Label>
							</div>
						</div>
					</CardContent>
				</Card>

				<div className="flex items-center justify-end gap-4">
					<Link href="/rewards">
						<Button type="button" variant="outline">
							Cancel
						</Button>
					</Link>
					<Button type="submit" disabled={createMutation.isPending} className="gap-2">
						{createMutation.isPending ? (
							<>
								<Loader2 className="size-4 animate-spin" aria-hidden="true" />
								Saving...
							</>
						) : (
							<>
								<Save className="size-4" aria-hidden="true" />
								{saveAsDraft ? "Save Draft" : "Create Reward"}
							</>
						)}
					</Button>
				</div>
			</form>
		</div>
	);
}
