"use client";

import type { MerchantKybProfileResponse } from "@workspace/shared";
import { JsonPrimitiveSchema, MerchantKybSubmissionSchema } from "@workspace/shared";
import { z } from "zod";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { FormShell } from "@workspace/ui/components/form/form-shell";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { resolveAuthErrorMessage } from "./auth-errors";
import { useAuth } from "./index";
import { MERCHANT_ME_QUERY_KEY } from "./invalidate-session-auth";
import { MerchantKybFields, type MerchantKybFieldValues } from "./merchant-kyb-fields";

const NonEmptyStringSchema = z.string().min(1);

function readOrgString(value: string | null): string {
	const parsed = NonEmptyStringSchema.safeParse(value);
	return parsed.success ? parsed.data : "";
}

function readKybStringField(profile: MerchantKybProfileResponse, key: string): string {
	if (profile.kybFields === null) {
		return "";
	}
	const parsed = JsonPrimitiveSchema.safeParse(profile.kybFields[key]);
	if (!parsed.success || parsed.data === null) {
		return "";
	}
	return String(parsed.data);
}

function profileToFieldValues(profile: MerchantKybProfileResponse): MerchantKybFieldValues {
	return {
		legalName: readOrgString(profile.legalName),
		addressText: readOrgString(profile.addressText),
		contactPhone: readOrgString(profile.contactPhone),
		registrationNo: readKybStringField(profile, "registrationNo"),
		taxId: readKybStringField(profile, "taxId"),
		documentType: readKybStringField(profile, "documentType"),
	};
}

function kybStatusVariant(status: MerchantKybProfileResponse["kybStatus"]): "default" | "secondary" | "outline" | "destructive" {
	if (status === "APPROVED") {
		return "default";
	}
	if (status === "REJECTED") {
		return "destructive";
	}
	return "outline";
}

export function MerchantKybVerificationView(): React.JSX.Element {
	const { api } = useAuth();
	const profileQuery = api.merchant.kyb.get.useQuery({}, { staleTime: 0 });
	const profile = profileQuery.data?.data;

	if (profileQuery.isLoading && profile === undefined) {
		return <p className="text-sm text-muted-foreground">Loading business verification…</p>;
	}

	if (profile === undefined) {
		return <p className="text-sm text-destructive">Unable to load business verification details.</p>;
	}

	return <MerchantKybVerificationContent profile={profile} />;
}

interface MerchantKybVerificationContentProps {
	readonly profile: MerchantKybProfileResponse;
}

function MerchantKybVerificationContent({ profile }: MerchantKybVerificationContentProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const submitMutation = api.merchant.kyb.submit.useMutation();

	const [values, setValues] = React.useState<MerchantKybFieldValues>(() => profileToFieldValues(profile));
	const [error, setError] = React.useState<string | null>(null);
	const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

	const handleFieldChange = React.useCallback((field: keyof MerchantKybFieldValues, value: string): void => {
		setValues((current) => ({ ...current, [field]: value }));
	}, []);

	const handleSubmit = React.useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setError(null);
			setSuccessMessage(null);

			const parsed = MerchantKybSubmissionSchema.safeParse(values);
			if (!parsed.success) {
				setError(parsed.error.issues[0]?.message ?? "Check your business details and try again.");
				return;
			}

			void submitMutation
				.mutateAsync(parsed.data)
				.then((response): void => {
					setValues(profileToFieldValues(response.data));
					setSuccessMessage("Business verification submitted. Our team will review your details.");
					void queryClient.invalidateQueries({ queryKey: MERCHANT_ME_QUERY_KEY });
					void queryClient.invalidateQueries({ queryKey: ["merchant", "kyb"] });
				})
				.catch((err: unknown): void => {
					setError(resolveAuthErrorMessage(err));
				});
		},
		[queryClient, submitMutation, values],
	);

	const isApproved = profile.kybStatus === "APPROVED";
	const rejectionReasonValue = readKybStringField(profile, "rejectionReason");
	const rejectionReason = rejectionReasonValue.length > 0 ? rejectionReasonValue : null;

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant={kybStatusVariant(profile.kybStatus)}>{profile.kybStatus}</Badge>
				<span className="text-sm text-muted-foreground">{profile.businessName}</span>
			</div>

			{profile.kybStatus === "REJECTED" && rejectionReason !== null ? (
				<div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{rejectionReason}</div>
			) : null}

			{successMessage !== null ? <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">{successMessage}</div> : null}

			{isApproved ? (
				<p className="text-sm text-muted-foreground">Your business verification is approved. Contact support if any registered details need to change.</p>
			) : (
				<FormShell
					error={error}
					isLoading={submitMutation.isPending}
					submitLabel={profile.kybStatus === "REJECTED" ? "Resubmit for review" : "Submit for review"}
					loadingLabel="Submitting…"
					submitClassName="h-11"
					onSubmit={handleSubmit}>
					<MerchantKybFields values={values} onChange={handleFieldChange} idPrefix="merchant-verification" />
				</FormShell>
			)}
		</div>
	);
}
