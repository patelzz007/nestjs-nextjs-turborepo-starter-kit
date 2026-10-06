"use client";

import { formatClaimApiError } from "@/lib/rewards/claim-errors";
import { useAuth } from "@workspace/client/lib/auth";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { useRouter } from "next/navigation";
import * as React from "react";
import { walletClaimPath } from "@/lib/routes";

const TERMS_VERSION = "1.0";
const PRIVACY_VERSION = "1.0";

type ClaimDisplayStep = "loading" | "legal" | "otp" | "claim";

export interface RewardClaimFlowProps {
	readonly rewardId: string;
	/** Status copy shown above the flow by the parent. */
	readonly onMessage: (message: string) => void;
	/** Claim was rejected — the parent refetches the reward (stock/expiry may have changed). */
	readonly onClaimFailed: () => void;
}

/**
 * Legal acceptance → OTP → claim. `/legal/*` and `/claims/*` require a
 * signed-in user but no permission (every consumer may claim a published
 * reward), so the parent gates this on authentication only; guests never
 * mount it, so they never trigger its authenticated queries.
 */
export function RewardClaimFlow({ rewardId, onMessage, onClaimFailed }: RewardClaimFlowProps): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();

	const checkoutQuery = api.legal.status.useQuery(undefined);
	const checkout = checkoutQuery.data?.data;

	const [phoneDraft, setPhoneDraft] = React.useState<string | null>(null);
	const [otp, setOtp] = React.useState<string>("");
	const [otpSent, setOtpSent] = React.useState<boolean>(false);
	const [legalAcceptedLocally, setLegalAcceptedLocally] = React.useState<boolean>(false);
	const [forceLegalStep, setForceLegalStep] = React.useState<boolean>(false);

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

	const acceptLegalMutation = api.legal.accept.useMutation({
		onSuccess: (): void => {
			setForceLegalStep(false);
			setLegalAcceptedLocally(true);
			onMessage("Terms accepted.");
			void checkoutQuery.refetch();
		},
	});

	const otpMutation = api.claims.otp.useMutation({
		onSuccess: (): void => {
			setOtpSent(true);
			onMessage("OTP sent — check your email (dev: API logs). Enter the 6-digit code below.");
		},
		onError: (error: Error): void => {
			onMessage(formatClaimApiError(error));
		},
	});

	const claimMutation = api.claims.create.useMutation({
		onSuccess: (response): void => {
			const claimId = response.data.claim.id;
			onMessage(`Claim successful! Backup code: ${response.data.backupCode}`);
			router.push(walletClaimPath(claimId));
		},
		onError: (error: Error): void => {
			if (error.message.includes("LEGAL_ACCEPTANCE_REQUIRED")) {
				setForceLegalStep(true);
				setLegalAcceptedLocally(false);
			}
			onMessage(formatClaimApiError(error));
			onClaimFailed();
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
		if (phone.trim().length < 8) {
			onMessage("Enter a valid phone number.");
			return;
		}
		void otpMutation.mutateAsync({ rewardId, phone: phone.trim() });
	}, [onMessage, otpMutation, phone, rewardId]);

	const handleClaim = React.useCallback((): void => {
		if (phone.trim().length < 8) {
			onMessage("Enter a valid phone number.");
			return;
		}
		if (requiresOtp && otp.length !== 6) {
			onMessage("Enter the 6-digit OTP.");
			return;
		}
		void claimMutation.mutateAsync({
			rewardId,
			phone: phone.trim(),
			...(requiresOtp ? { otp } : {}),
		});
	}, [claimMutation, onMessage, otp, phone, requiresOtp, rewardId]);

	if (displayStep === "loading") {
		return <p className="text-sm text-muted-foreground">Loading claim options…</p>;
	}

	if (displayStep === "legal") {
		return (
			<div className="space-y-3">
				<p className="text-sm text-muted-foreground">
					Accept the Reward Hub terms (v{TERMS_VERSION}) and privacy policy (v{PRIVACY_VERSION}) before claiming.
				</p>
				<Button disabled={acceptLegalMutation.isPending} onClick={handleAcceptLegal}>
					{acceptLegalMutation.isPending ? "Saving…" : "Accept & continue"}
				</Button>
			</div>
		);
	}

	return (
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
	);
}
