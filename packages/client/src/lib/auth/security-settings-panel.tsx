"use client";

import { ChangePasswordForm } from "@workspace/client/lib/auth/change-password-form";
import { EmailVerificationPanel } from "@workspace/client/lib/auth/email-verification-panel";
import { resolveAuthErrorMessage } from "@workspace/client/lib/auth/auth-errors";
import { useAuth } from "@workspace/client/lib/auth";
import { consumeEnrollmentMessage } from "@workspace/client/lib/auth/restricted-session";
import { Button } from "@workspace/ui/components/form/button";
import { Checkbox } from "@workspace/ui/components/form/checkbox";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { PasswordInput } from "@workspace/ui/components/form/password-input";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type JSX } from "react";

import { MfaRecoveryRequestPanel } from "./mfa-recovery-request-panel";
import { useEmailVerifiedToast } from "./use-email-verified-toast";

/** Allowed characters for MFA backup codes (matches server charset). */
const BACKUP_CODE_CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function sanitizeBackupCodeInput(value: string): string {
	const upper = value.toUpperCase();
	let sanitized = "";
	for (const char of upper) {
		if (BACKUP_CODE_CHARSET.includes(char)) {
			sanitized += char;
		}
	}
	return sanitized.slice(0, 16);
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
	const [isLoadingSetup, setIsLoadingSetup] = useState(false);
	const enableMutation = api.auth.twoFactorEnable.useMutation();
	const rotateMutation = api.auth.twoFactorRotate.useMutation();
	const remainingQuery = api.auth.twoFactorBackupCodesRemaining.useQuery(undefined, { retry: 1 });
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

	const handleStartSetup = useCallback((): void => {
		setError(null);
		setMessage(null);
		setIsLoadingSetup(true);
		api.auth.twoFactorSetup
			.fetchOrThrow(undefined)
			.then((response): void => {
				applySetupResponse(response.data);
			})
			.catch((err: unknown): void => {
				setError(resolveAuthErrorMessage(err));
			})
			.finally((): void => {
				setIsLoadingSetup(false);
			});
	}, [api.auth.twoFactorSetup, applySetupResponse]);

	const handleTokenChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setToken(event.target.value.replace(/\D/g, "").slice(0, 6));
	}, []);

	const handleRotatePasswordChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setRotatePassword(event.target.value);
	}, []);

	const handleRotateTokenChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setRotateToken(event.target.value.replace(/\D/g, "").slice(0, 6));
	}, []);

	const handleRotateBackupCodeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setRotateBackupCode(sanitizeBackupCodeInput(event.target.value));
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
			enableMutation
				.mutateAsync({ token })
				.then((response): void => {
					setMessage(response.data.message);
					setSecret(null);
					setQrCodeDataUrl(null);
					setBackupCodes([]);
					setToken("");
					setSavedCodesConfirmed(false);
					void remainingQuery.refetch();
				})
				.catch((err: unknown): void => {
					setError(resolveAuthErrorMessage(err));
				});
		},
		[enableMutation, remainingQuery, token],
	);

	const handleRotate = useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setError(null);
			setMessage(null);

			const rotateInput = rotateUseBackupCode ? { password: rotatePassword, backupCode: rotateBackupCode } : { password: rotatePassword, token: rotateToken };

			rotateMutation
				.mutateAsync(rotateInput)
				.then((response): void => {
					applySetupResponse(response.data);
					setRotatePassword("");
					setRotateToken("");
					setRotateBackupCode("");
					setRotateUseBackupCode(false);
					setMessage("Two-factor authentication rotated. Scan the new QR code and save your new backup codes.");
					void remainingQuery.refetch();
				})
				.catch((err: unknown): void => {
					setError(resolveAuthErrorMessage(err));
				});
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
	const canSubmitEnable: boolean = token.length === 6 && savedCodesConfirmed;
	const canSubmitRotate: boolean = rotatePassword.length > 0 && (rotateUseBackupCode ? rotateBackupCode.length === 16 : rotateToken.length === 6);

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
				<Button type="button" onClick={handleStartSetup} loading={isLoadingSetup}>
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
							<Input id="two-factor-token" inputMode="numeric" maxLength={6} value={token} onChange={handleTokenChange} />
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
							placeholder="16-character backup code"
							maxLength={16}
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
						<Input id="rotate-token" inputMode="numeric" maxLength={6} value={rotateToken} onChange={handleRotateTokenChange} />
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
