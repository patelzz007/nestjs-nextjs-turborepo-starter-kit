"use client";

import { stubApiMeta } from "@/lib/api-envelope";
import { WebPageHeader } from "@/components/web-ui/page-header";
import { WebSurfacePanel } from "@/components/web-ui/surface-panel";
import { useAuth } from "@workspace/client/lib/auth";
import type { RewardResponse } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button, buttonVariants } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/utils";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

const TERMS_VERSION = "1.0";
const PRIVACY_VERSION = "1.0";

export interface RewardDetailViewProps {
	readonly rewardId: string;
	readonly initialReward?: RewardResponse;
}

/** Reward detail with legal acceptance + OTP claim flow. */
export function RewardDetailView({ rewardId, initialReward }: RewardDetailViewProps): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();

	const initialQueryData = React.useMemo(
		() =>
			initialReward !== undefined
				? {
						success: true as const,
						data: initialReward,
						meta: stubApiMeta(),
					}
				: undefined,
		[initialReward],
	);

	const rewardQuery = api.rewards.detail.useQuery(
		{ rewardId },
		{
			initialData: initialQueryData,
		},
	);
	const reward = rewardQuery.data?.data;

	const [phone, setPhone] = React.useState<string>("");
	const [otp, setOtp] = React.useState<string>("");
	const [legalAccepted, setLegalAccepted] = React.useState<boolean>(false);
	const [step, setStep] = React.useState<"legal" | "otp" | "claim">("legal");
	const [message, setMessage] = React.useState<string | null>(null);

	const acceptLegalMutation = api.legal.accept.useMutation({
		onSuccess: (): void => {
			setLegalAccepted(true);
			setStep("otp");
			setMessage("Terms accepted. Request an OTP to continue.");
		},
	});

	const otpMutation = api.claims.otp.useMutation({
		onSuccess: (): void => {
			setStep("claim");
			setMessage("OTP sent — check your email (dev: API logs). Enter the 6-digit code below.");
		},
	});

	const claimMutation = api.claims.create.useMutation({
		onSuccess: (response): void => {
			const claimId = response.data.claim.id;
			setMessage(`Claim successful! Backup code: ${response.data.backupCode}`);
			router.push(`/rewardhub/claims/${claimId}`);
		},
		onError: (error: Error): void => {
			if (error.message.includes("LEGAL_ACCEPTANCE_REQUIRED")) {
				setStep("legal");
				setLegalAccepted(false);
			}
			setMessage(error.message);
		},
	});

	const handleAcceptLegal = React.useCallback((): void => {
		void acceptLegalMutation.mutateAsync({ termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION });
	}, [acceptLegalMutation]);

	const handleRequestOtp = React.useCallback((): void => {
		if (phone.trim().length < 8) {
			setMessage("Enter a valid phone number.");
			return;
		}
		void otpMutation.mutateAsync({ rewardId, phone: phone.trim() });
	}, [otpMutation, phone, rewardId]);

	const handleClaim = React.useCallback((): void => {
		if (otp.length !== 6) {
			setMessage("Enter the 6-digit OTP.");
			return;
		}
		void claimMutation.mutateAsync({ rewardId, phone: phone.trim(), otp });
	}, [claimMutation, otp, phone, rewardId]);

	if (rewardQuery.isLoading && initialReward === undefined) {
		return <p className="text-sm text-muted-foreground">Loading reward…</p>;
	}

	if (reward === undefined) {
		return (
			<div className="space-y-6">
				<WebPageHeader title="Reward unavailable" description="This reward may have expired or been removed." />
				<Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
					Back to browse
				</Link>
			</div>
		);
	}

	return (
		<div className="space-y-8">
			<WebPageHeader title={reward.title} description={reward.description} />

			<Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-mt-4")}>
				← Back to browse
			</Link>

			<WebSurfacePanel className="p-5 sm:p-6">
				<div className="flex flex-wrap gap-2">
					<Badge variant="secondary" className="capitalize">
						{reward.category}
					</Badge>
					{reward.merchantName !== undefined ? <Badge variant="outline">{reward.merchantName}</Badge> : null}
					<Badge variant="outline">{reward.rewardType.replace("_", " ")}</Badge>
				</div>
				<p className="mt-4 text-sm text-muted-foreground">
					<span className="font-medium text-foreground">{reward.quantityRemaining}</span> remaining · Expires {format(new Date(reward.expiryDate), "d MMM yyyy")}
				</p>
			</WebSurfacePanel>

			<WebSurfacePanel accent className="p-5 sm:p-6">
				<h2 className="text-base font-semibold">Claim this reward</h2>
				<div className="mt-4 space-y-4">
					{message !== null ? <p className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">{message}</p> : null}

					{step === "legal" && !legalAccepted ? (
						<div className="space-y-3">
							<p className="text-sm text-muted-foreground">
								Accept the Reward Hub terms (v{TERMS_VERSION}) and privacy policy (v{PRIVACY_VERSION}) before claiming.
							</p>
							<Button disabled={acceptLegalMutation.isPending} onClick={handleAcceptLegal}>
								{acceptLegalMutation.isPending ? "Saving…" : "Accept & continue"}
							</Button>
						</div>
					) : null}

					{step === "otp" || step === "claim" ? (
						<div className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="claim-phone">Mobile number</Label>
								<Input
									id="claim-phone"
									type="tel"
									placeholder="+60123456789"
									value={phone}
									onChange={(event: React.ChangeEvent<HTMLInputElement>): void => setPhone(event.target.value)}
								/>
							</div>
							{step === "otp" ? (
								<Button disabled={otpMutation.isPending} onClick={handleRequestOtp}>
									{otpMutation.isPending ? "Sending…" : "Send OTP"}
								</Button>
							) : (
								<div className="space-y-2">
									<Label htmlFor="claim-otp">6-digit OTP</Label>
									<Input
										id="claim-otp"
										inputMode="numeric"
										maxLength={6}
										value={otp}
										onChange={(event: React.ChangeEvent<HTMLInputElement>): void => setOtp(event.target.value)}
									/>
									<Button disabled={claimMutation.isPending} onClick={handleClaim}>
										{claimMutation.isPending ? "Claiming…" : "Verify & claim"}
									</Button>
								</div>
							)}
						</div>
					) : null}
				</div>
			</WebSurfacePanel>
		</div>
	);
}
