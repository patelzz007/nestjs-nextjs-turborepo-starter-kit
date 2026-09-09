"use client";

import { formatClaimApiError } from "@/lib/rewards/claim-errors";
import { stubApiMeta } from "@/lib/api-envelope";
import { WebPageHeader } from "@/components/web-ui/page-header";
import { WebSurfacePanel } from "@/components/web-ui/surface-panel";
import { useAuth } from "@workspace/client/lib/auth";
import type { RewardResponse } from "@workspace/shared";
import { getRewardClaimBlockReason, rewardClaimBlockMessage, epochMs } from "@workspace/shared";
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

type ClaimDisplayStep = "loading" | "legal" | "otp" | "claim";

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
			refetchInterval: 60_000,
		},
	);
	const reward = rewardQuery.data?.data;

	const checkoutQuery = api.legal.status.useQuery(undefined);
	const checkout = checkoutQuery.data?.data;

	const [phoneDraft, setPhoneDraft] = React.useState<string | null>(null);
	const [otp, setOtp] = React.useState<string>("");
	const [otpSent, setOtpSent] = React.useState<boolean>(false);
	const [legalAcceptedLocally, setLegalAcceptedLocally] = React.useState<boolean>(false);
	const [forceLegalStep, setForceLegalStep] = React.useState<boolean>(false);
	const [message, setMessage] = React.useState<string | null>(null);
	const [nowMs, setNowMs] = React.useState<number>(() => Date.now());

	React.useEffect((): (() => void) => {
		const intervalId = window.setInterval((): void => {
			setNowMs(Date.now());
		}, 60_000);
		return (): void => {
			window.clearInterval(intervalId);
		};
	}, []);

	const checkoutReady = checkout !== undefined;
	const verifiedPhone = checkout?.phoneVerified === true && checkout.phone !== null ? checkout.phone : null;
	const phone = phoneDraft ?? verifiedPhone ?? "";

	const hasAcceptedLegal = forceLegalStep ? false : legalAcceptedLocally || checkout?.hasAcceptedLegal === true;

	const requiresOtp = React.useMemo((): boolean => {
		if (checkout === undefined) {
			return true;
		}
		if (!checkout.phoneVerified || checkout.phone === null) {
			return true;
		}
		return phone.trim() !== checkout.phone;
	}, [checkout, phone]);

	const displayStep = React.useMemo((): ClaimDisplayStep => {
		if (!checkoutReady) {
			return "loading";
		}
		if (!hasAcceptedLegal) {
			return "legal";
		}
		if (!requiresOtp) {
			return "claim";
		}
		if (otpSent) {
			return "claim";
		}
		return "otp";
	}, [checkoutReady, hasAcceptedLegal, otpSent, requiresOtp]);

	const claimBlockReason = React.useMemo(() => (reward === undefined ? null : getRewardClaimBlockReason(reward, epochMs(nowMs))), [reward, nowMs]);
	const canClaim = claimBlockReason === null;

	const acceptLegalMutation = api.legal.accept.useMutation({
		onSuccess: (): void => {
			setForceLegalStep(false);
			setLegalAcceptedLocally(true);
			setMessage("Terms accepted.");
			void checkoutQuery.refetch();
		},
	});

	const otpMutation = api.claims.otp.useMutation({
		onSuccess: (): void => {
			setOtpSent(true);
			setMessage("OTP sent — check your email (dev: API logs). Enter the 6-digit code below.");
		},
		onError: (error: Error): void => {
			setMessage(formatClaimApiError(error));
		},
	});

	const claimMutation = api.claims.create.useMutation({
		onSuccess: (response): void => {
			const claimId = response.data.claim.id;
			setMessage(`Claim successful! Backup code: ${response.data.backupCode}`);
			router.push(`/rewardhub/claims/${claimId}`);
		},
		onError: (error: Error): void => {
			if (error instanceof Error && error.message.includes("LEGAL_ACCEPTANCE_REQUIRED")) {
				setForceLegalStep(true);
				setLegalAcceptedLocally(false);
			}
			setMessage(formatClaimApiError(error));
			void rewardQuery.refetch();
		},
	});

	const handlePhoneChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setPhoneDraft(event.target.value);
		setOtpSent(false);
		setOtp("");
	}, []);

	const handleOtpChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setOtp(event.target.value);
	}, []);

	const handleAcceptLegal = React.useCallback((): void => {
		void acceptLegalMutation.mutateAsync({ termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION });
	}, [acceptLegalMutation]);

	const handleRequestOtp = React.useCallback((): void => {
		if (!canClaim) {
			return;
		}
		if (phone.trim().length < 8) {
			setMessage("Enter a valid phone number.");
			return;
		}
		void otpMutation.mutateAsync({ rewardId, phone: phone.trim() });
	}, [canClaim, otpMutation, phone, rewardId]);

	const handleClaim = React.useCallback((): void => {
		if (!canClaim) {
			return;
		}
		if (phone.trim().length < 8) {
			setMessage("Enter a valid phone number.");
			return;
		}
		if (requiresOtp && otp.length !== 6) {
			setMessage("Enter the 6-digit OTP.");
			return;
		}
		void claimMutation.mutateAsync({
			rewardId,
			phone: phone.trim(),
			...(requiresOtp ? { otp } : {}),
		});
	}, [canClaim, claimMutation, otp, phone, requiresOtp, rewardId]);

	if (rewardQuery.isLoading && initialReward === undefined) {
		return <p className="text-sm text-muted-foreground">Loading reward…</p>;
	}

	if (reward === undefined) {
		return (
			<div className="space-y-6">
				<WebPageHeader title="Reward unavailable" description="This reward may have expired or been removed." />
				<Link href="/rewardhub" className={cn(buttonVariants({ variant: "outline" }))}>
					Back to browse
				</Link>
			</div>
		);
	}

	const isSoldOut = reward.quantityRemaining <= 0;

	return (
		<div className="space-y-8">
			<WebPageHeader title={reward.title} description={reward.description} />

			<Link href="/rewardhub" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-mt-4")}>
				← Back to browse
			</Link>

			<WebSurfacePanel className="p-5 sm:p-6">
				<div className="flex flex-wrap gap-2">
					<Badge variant="secondary" className="capitalize">
						{reward.category}
					</Badge>
					{reward.merchantName !== undefined ? <Badge variant="outline">{reward.merchantName}</Badge> : null}
					<Badge variant="outline">{reward.rewardType.replace("_", " ")}</Badge>
					{isSoldOut ? <Badge variant="destructive">Sold out</Badge> : null}
					{claimBlockReason === "expired" ? <Badge variant="destructive">Expired</Badge> : null}
				</div>
				<p className="mt-4 text-sm text-muted-foreground">
					<span className="font-medium text-foreground">{reward.quantityRemaining}</span> remaining · Expires {format(new Date(reward.expiryDate), "d MMM yyyy")}
				</p>
			</WebSurfacePanel>

			<WebSurfacePanel accent className="p-5 sm:p-6">
				<h2 className="text-base font-semibold">Claim this reward</h2>
				<div className="mt-4 space-y-4">
					{message !== null ? <p className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">{message}</p> : null}

					{!canClaim ? (
						<div className="space-y-3">
							<p className="text-sm text-muted-foreground">{rewardClaimBlockMessage(claimBlockReason)}</p>
							<Link href="/rewardhub" className={cn(buttonVariants({ variant: "outline" }))}>
								Browse other offers
							</Link>
						</div>
					) : displayStep === "loading" ? (
						<p className="text-sm text-muted-foreground">Loading claim options…</p>
					) : (
						<>
							{displayStep === "legal" ? (
								<div className="space-y-3">
									<p className="text-sm text-muted-foreground">
										Accept the Reward Hub terms (v{TERMS_VERSION}) and privacy policy (v{PRIVACY_VERSION}) before claiming.
									</p>
									<Button disabled={acceptLegalMutation.isPending} onClick={handleAcceptLegal}>
										{acceptLegalMutation.isPending ? "Saving…" : "Accept & continue"}
									</Button>
								</div>
							) : null}

							{displayStep === "otp" || displayStep === "claim" ? (
								<div className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="claim-phone">Mobile number</Label>
										<Input id="claim-phone" type="tel" placeholder="+60123456789" value={phone} onChange={handlePhoneChange} />
									</div>
									{requiresOtp ? (
										displayStep === "otp" ? (
											<Button disabled={otpMutation.isPending} onClick={handleRequestOtp}>
												{otpMutation.isPending ? "Sending…" : "Send OTP"}
											</Button>
										) : (
											<div className="space-y-2">
												<Label htmlFor="claim-otp">6-digit OTP</Label>
												<Input id="claim-otp" inputMode="numeric" maxLength={6} value={otp} onChange={handleOtpChange} />
												<Button disabled={claimMutation.isPending} onClick={handleClaim}>
													{claimMutation.isPending ? "Claiming…" : "Verify & claim"}
												</Button>
											</div>
										)
									) : (
										<div className="space-y-2">
											<p className="text-sm text-muted-foreground">Your phone is already verified — claim directly without another OTP.</p>
											<Button disabled={claimMutation.isPending} onClick={handleClaim}>
												{claimMutation.isPending ? "Claiming…" : "Claim reward"}
											</Button>
										</div>
									)}
								</div>
							) : null}
						</>
					)}
				</div>
			</WebSurfacePanel>
		</div>
	);
}
