"use client";

import { ChangePasswordForm } from "../forms/change-password-form";
import { EmailVerificationPanel } from "../email/verification-panel";
import { resolveAuthErrorMessage } from "../errors";
import { useAuth } from "../index";
import { consumeEnrollmentMessage } from "../session/enrollment-message";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { PasswordInput } from "@workspace/ui/components/password-input";
import { toastMessage } from "@workspace/ui/components/toast";
import { BACKUP_CODE_LENGTH, normalizeBackupCodeInput, TOTP_CODE_LENGTH } from "@workspace/shared";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type JSX } from "react";

import { MfaRecoveryRequestPanel } from "./recovery-request-panel";
import { SignedInDevicesSection } from "../sessions/signed-in-devices-section";
import { SIGNED_IN_DEVICES_LABELS } from "../sessions/signed-in-devices-labels";
import { useEmailVerifiedToast } from "../email/use-verified-toast";
import { catchCaught } from "../../caught";

/** Keeps only digits, at most one TOTP code long. */
function sanitizeTotpInput(value: string): string {
	return value.replace(/\D/g, "").slice(0, TOTP_CODE_LENGTH);
}

function downloadBackupCodes(codes: readonly string[]): void {
	const content = `${codes.join("\n")}\n`;
	const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = "backup-codes.txt";
	anchor.click();
	URL.revokeObjectURL(url);
}

function TwoFactorSetupPanel(): JSX.Element {
	const { api } = useAuth();
	const meQuery = api.auth.me.useQuery(undefined, { retry: 1 });
	const twoFactorEnabled = meQuery.data?.data.twoFactorEnabled === true;
	const setupMutation = api.auth.twoFactorSetup.useMutation();
	const enableMutation = api.auth.twoFactorEnable.useMutation();
	const rotateMutation = api.auth.twoFactorRotate.useMutation();
	const remainingQuery = api.auth.twoFactorBackupCodesRemaining.useQuery(undefined, { enabled: twoFactorEnabled, retry: 1 });
	const [token, setToken] = useState("");
	const [rotatePassword, setRotatePassword] = useState("");
	const [rotateToken, setRotateToken] = useState("");
	const [rotateBackupCode, setRotateBackupCode] = useState("");
	const [rotateUseBackupCode, setRotateUseBackupCode] = useState(false);
	const [savedCodesConfirmed, setSavedCodesConfirmed] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [backupCodes, setBackupCodes] = useState<readonly string[]>([]);
	const [secret, setSecret] = useState<string | null>(null);
	const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

	const applySetupResponse = useCallback((response: { readonly secret: string; readonly qrCodeDataUrl: string; readonly backupCodes: readonly string[] }): void => {
		setSecret(response.secret);
		setQrCodeDataUrl(response.qrCodeDataUrl);
		setBackupCodes(response.backupCodes);
		setSavedCodesConfirmed(false);
		setToken("");
	}, []);

	// Starting a setup stores a new pending secret server-side — a mutation, never a query refetch.
	const handleStartSetup = useCallback((): void => {
		setError(null);
		setMessage(null);
		void catchCaught(
			setupMutation.mutateAsync({}).then((response): void => {
				applySetupResponse(response.data);
			}),
			(err): void => {
				setError(resolveAuthErrorMessage(err));
			},
		);
	}, [applySetupResponse, setupMutation]);

	const handleTokenChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setToken(sanitizeTotpInput(event.target.value));
	}, []);

	const handleRotatePasswordChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setRotatePassword(event.target.value);
	}, []);

	const handleRotateTokenChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setRotateToken(sanitizeTotpInput(event.target.value));
	}, []);

	const handleRotateBackupCodeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setRotateBackupCode(normalizeBackupCodeInput(event.target.value));
	}, []);

	const handleSavedCodesChange = useCallback((checked: boolean | undefined): void => {
		setSavedCodesConfirmed(checked === true);
	}, []);

	const handleCopyBackupCodes = useCallback((): void => {
		if (backupCodes.length === 0) {
			return;
		}

		void navigator.clipboard.writeText(backupCodes.join("\n")).then((): void => {
			toastMessage.success({
				title: "Backup codes copied",
				description: "Store them somewhere safe — each code works only once.",
			});
		});
	}, [backupCodes]);

	const handleDownloadBackupCodes = useCallback((): void => {
		if (backupCodes.length === 0) {
			return;
		}
		downloadBackupCodes(backupCodes);
	}, [backupCodes]);

	const handleEnable = useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setError(null);
			void catchCaught(
				enableMutation.mutateAsync({ token }).then((response): void => {
					setMessage(response.data.message);
					setSecret(null);
					setQrCodeDataUrl(null);
					setBackupCodes([]);
					setToken("");
					setSavedCodesConfirmed(false);
					void remainingQuery.refetch();
				}),
				(err): void => {
					setError(resolveAuthErrorMessage(err));
				},
			);
		},
		[enableMutation, remainingQuery, token],
	);

	const handleRotate = useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setError(null);
			setMessage(null);

			const rotateInput = rotateUseBackupCode ? { password: rotatePassword, backupCode: rotateBackupCode } : { password: rotatePassword, token: rotateToken };

			void catchCaught(
				rotateMutation.mutateAsync(rotateInput).then((response): void => {
					applySetupResponse(response.data);
					setRotatePassword("");
					setRotateToken("");
					setRotateBackupCode("");
					setRotateUseBackupCode(false);
					setMessage("Two-factor authentication rotated. Scan the new QR code and save your new backup codes.");
					void remainingQuery.refetch();
				}),
				(err): void => {
					setError(resolveAuthErrorMessage(err));
				},
			);
		},
		[applySetupResponse, remainingQuery, rotateBackupCode, rotateMutation, rotatePassword, rotateToken, rotateUseBackupCode],
	);

	const handleRotateUseAuthenticator = useCallback((): void => {
		setRotateUseBackupCode(false);
		setRotateBackupCode("");
	}, []);

	const handleRotateUseBackupCode = useCallback((): void => {
		setRotateUseBackupCode(true);
		setRotateToken("");
	}, []);

	const remainingCount: number | null = remainingQuery.data?.data.remaining ?? null;
	const canSubmitEnable: boolean = token.length === TOTP_CODE_LENGTH && savedCodesConfirmed;
	const canSubmitRotate: boolean =
		rotatePassword.length > 0 && (rotateUseBackupCode ? rotateBackupCode.length === BACKUP_CODE_LENGTH : rotateToken.length === TOTP_CODE_LENGTH);

	return (
		<div className="space-y-6">
			{error ? <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}
			{message ? <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">{message}</div> : null}

			{remainingCount !== null ? (
				<p className="text-sm text-muted-foreground">
					<strong>{remainingCount}</strong> unused backup {remainingCount === 1 ? "code" : "codes"} remaining.
				</p>
			) : null}

			{qrCodeDataUrl === null ? (
				<Button type="button" onClick={handleStartSetup} loading={setupMutation.isPending}>
					Set up authenticator app
				</Button>
			) : (
				<div className="space-y-4">
					<p className="text-sm text-muted-foreground">Scan this QR code with Microsoft Authenticator or another TOTP app.</p>
					<div className="flex justify-center">
						<Image src={qrCodeDataUrl} alt="2FA QR code" width={200} height={200} className="rounded-lg border bg-white p-3" unoptimized />
					</div>
					{secret !== null ? (
						<p className="text-center text-xs text-muted-foreground">
							Manual entry key: <code className="rounded bg-muted px-2 py-1 font-mono">{secret}</code>
						</p>
					) : null}
					<div className="space-y-3">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<p className="text-sm font-medium">Backup codes</p>
							<div className="flex flex-wrap gap-2">
								<Button type="button" variant="outline" size="sm" onClick={handleCopyBackupCodes} disabled={backupCodes.length === 0}>
									Copy all
								</Button>
								<Button type="button" variant="outline" size="sm" onClick={handleDownloadBackupCodes} disabled={backupCodes.length === 0}>
									Download .txt
								</Button>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-2">
							{backupCodes.map((code) => (
								<code key={code} className="rounded border bg-muted px-2 py-1 text-center font-mono text-xs">
									{code}
								</code>
							))}
						</div>
					</div>
					<div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
						<Checkbox id="saved-backup-codes" checked={savedCodesConfirmed} onCheckedChange={handleSavedCodesChange} />
						<Label htmlFor="saved-backup-codes" className="text-sm leading-snug">
							I saved my backup codes in a secure place
						</Label>
					</div>
					<form className="space-y-3" onSubmit={handleEnable}>
						<div className="space-y-2">
							<Label htmlFor="two-factor-token">Verification code</Label>
							<Input id="two-factor-token" inputMode="numeric" maxLength={TOTP_CODE_LENGTH} value={token} onChange={handleTokenChange} />
						</div>
						<Button type="submit" loading={enableMutation.isPending} disabled={!canSubmitEnable}>
							Enable 2FA
						</Button>
					</form>
				</div>
			)}

			<form className="space-y-4 border-t pt-6" onSubmit={handleRotate}>
				<div>
					<h3 className="text-sm font-semibold">Rotate two-factor authentication</h3>
					<p className="text-sm text-muted-foreground">Confirm your password and current authenticator or backup code to generate a new secret and backup codes.</p>
				</div>
				<div className="space-y-2">
					<Label htmlFor="rotate-password">Password</Label>
					<PasswordInput id="rotate-password" value={rotatePassword} onChange={handleRotatePasswordChange} />
				</div>
				{rotateUseBackupCode ? (
					<div className="space-y-2">
						<Label htmlFor="rotate-backup-code">Current backup code</Label>
						<Input
							id="rotate-backup-code"
							autoComplete="one-time-code"
							placeholder={`${String(BACKUP_CODE_LENGTH)}-character backup code`}
							maxLength={BACKUP_CODE_LENGTH}
							value={rotateBackupCode}
							onChange={handleRotateBackupCodeChange}
							className="font-mono tracking-widest"
						/>
						<Button type="button" variant="link" className="h-auto justify-start p-0 text-sm" onClick={handleRotateUseAuthenticator}>
							Use authenticator code instead
						</Button>
					</div>
				) : (
					<div className="space-y-2">
						<Label htmlFor="rotate-token">Current authenticator code</Label>
						<Input id="rotate-token" inputMode="numeric" maxLength={TOTP_CODE_LENGTH} value={rotateToken} onChange={handleRotateTokenChange} />
						<Button type="button" variant="link" className="h-auto justify-start p-0 text-sm" onClick={handleRotateUseBackupCode}>
							Use a backup code instead
						</Button>
					</div>
				)}
				<div className="border-t pt-4">
					<Button type="submit" variant="outline" className="w-full sm:w-auto" loading={rotateMutation.isPending} disabled={!canSubmitRotate}>
						Rotate 2FA
					</Button>
				</div>
			</form>
		</div>
	);
}

function useEnrollmentMessageToast(): void {
	const handledRef = useRef(false);

	useEffect((): void => {
		if (handledRef.current) {
			return;
		}

		const enrollmentMessage = consumeEnrollmentMessage();
		if (enrollmentMessage === null) {
			return;
		}

		handledRef.current = true;
		toastMessage.info({
			title: "Action required",
			description: enrollmentMessage,
		});
	}, []);
}

export function SecuritySettingsPanel(): JSX.Element {
	useEmailVerifiedToast();
	useEnrollmentMessageToast();

	return (
		<div className="grid gap-8 lg:grid-cols-2">
			<section className="space-y-4 rounded-xl border bg-card p-6 lg:col-span-2">
				<div>
					<h2 className="text-lg font-semibold">Email verification</h2>
					<p className="text-sm text-muted-foreground">Confirm you own this email address.</p>
				</div>
				<EmailVerificationPanel />
			</section>
			<section className="space-y-4 rounded-xl border bg-card p-6">
				<div>
					<h2 className="text-lg font-semibold">Change password</h2>
					<p className="text-sm text-muted-foreground">Update your password and sign out other sessions.</p>
				</div>
				<ChangePasswordForm />
			</section>
			<section className="space-y-4 rounded-xl border bg-card p-6">
				<div>
					<h2 className="text-lg font-semibold">Two-factor authentication</h2>
					<p className="text-sm text-muted-foreground">Protect your account with Microsoft Authenticator or another TOTP app.</p>
				</div>
				<TwoFactorSetupPanel />
			</section>
			<section className="space-y-4 rounded-xl border bg-card p-6 lg:col-span-2" aria-labelledby="signed-in-devices-heading">
				<div>
					<h2 id="signed-in-devices-heading" className="text-lg font-semibold">
						{SIGNED_IN_DEVICES_LABELS.title}
					</h2>
					<p className="text-sm text-muted-foreground">{SIGNED_IN_DEVICES_LABELS.description}</p>
				</div>
				<SignedInDevicesSection labels={SIGNED_IN_DEVICES_LABELS} />
			</section>
			<section className="space-y-4 rounded-xl border bg-card p-6 lg:col-span-2">
				<div>
					<h2 className="text-lg font-semibold">MFA recovery</h2>
					<p className="text-sm text-muted-foreground">Request administrator help if you lose your authenticator and backup codes.</p>
				</div>
				<MfaRecoveryRequestPanel />
			</section>
		</div>
	);
}
