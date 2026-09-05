"use client";

import { ChangePasswordForm } from "@workspace/client/lib/auth/change-password-form";
import { EmailVerificationPanel } from "@workspace/client/lib/auth/email-verification-panel";
import { resolveAuthErrorMessage } from "@workspace/client/lib/auth/auth-errors";
import { useAuth } from "@workspace/client/lib/auth";
import { Button } from "@workspace/ui/components/form/button";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { PasswordInput } from "@workspace/ui/components/form/password-input";
import Image from "next/image";
import { useCallback, useState, type JSX } from "react";

import { useEmailVerifiedToast } from "./use-email-verified-toast";

function TwoFactorSetupPanel(): JSX.Element {
	const { api } = useAuth();
	const [isLoadingSetup, setIsLoadingSetup] = useState(false);
	const enableMutation = api.auth.twoFactorEnable.useMutation();
	const disableMutation = api.auth.twoFactorDisable.useMutation();
	const [token, setToken] = useState("");
	const [disablePassword, setDisablePassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [backupCodes, setBackupCodes] = useState<readonly string[]>([]);
	const [secret, setSecret] = useState<string | null>(null);
	const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

	const handleStartSetup = useCallback((): void => {
		setError(null);
		setMessage(null);
		setIsLoadingSetup(true);
		api.auth.twoFactorSetup
			.fetchOrThrow(undefined)
			.then((response): void => {
				setSecret(response.data.secret);
				setQrCodeDataUrl(response.data.qrCodeDataUrl);
				setBackupCodes(response.data.backupCodes);
			})
			.catch((err: unknown): void => {
				setError(resolveAuthErrorMessage(err));
			})
			.finally((): void => {
				setIsLoadingSetup(false);
			});
	}, [api.auth.twoFactorSetup]);

	const handleTokenChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setToken(event.target.value.replace(/\D/g, "").slice(0, 6));
	}, []);

	const handleDisablePasswordChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setDisablePassword(event.target.value);
	}, []);

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
					setToken("");
				})
				.catch((err: unknown): void => {
					setError(resolveAuthErrorMessage(err));
				});
		},
		[enableMutation, token],
	);

	const handleDisable = useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setError(null);
			disableMutation
				.mutateAsync({ password: disablePassword })
				.then((response): void => {
					setMessage(response.data.message);
					setDisablePassword("");
				})
				.catch((err: unknown): void => {
					setError(resolveAuthErrorMessage(err));
				});
		},
		[disableMutation, disablePassword],
	);

	return (
		<div className="space-y-6">
			{error ? <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}
			{message ? <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">{message}</div> : null}

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
					<div className="grid grid-cols-2 gap-2">
						{backupCodes.map((code) => (
							<code key={code} className="rounded border bg-muted px-2 py-1 text-center font-mono text-xs">
								{code}
							</code>
						))}
					</div>
					<form className="space-y-3" onSubmit={handleEnable}>
						<div className="space-y-2">
							<Label htmlFor="two-factor-token">Verification code</Label>
							<Input id="two-factor-token" inputMode="numeric" maxLength={6} value={token} onChange={handleTokenChange} />
						</div>
						<Button type="submit" loading={enableMutation.isPending} disabled={token.length !== 6}>
							Enable 2FA
						</Button>
					</form>
				</div>
			)}

			<form className="space-y-3 border-t pt-6" onSubmit={handleDisable}>
				<div className="space-y-2">
					<Label htmlFor="disable-password">Disable 2FA (password required)</Label>
					<PasswordInput id="disable-password" value={disablePassword} onChange={handleDisablePasswordChange} />
				</div>
				<Button type="submit" variant="outline" loading={disableMutation.isPending}>
					Disable 2FA
				</Button>
			</form>
		</div>
	);
}

export function SecuritySettingsPanel(): JSX.Element {
	useEmailVerifiedToast();

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
		</div>
	);
}
