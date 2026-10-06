"use client";

import { orgRoutes, ROUTES } from "@/lib/routes";
import { resolveAuthErrorMessage } from "@workspace/client/lib/auth/errors";
import { getEnrollmentRedirectPath } from "@workspace/client/lib/auth/edge/restricted-session";
import { markEnrollmentMessage } from "@workspace/client/lib/auth/session/enrollment-message";
import { isLoginRestrictedEnrollment, isLoginSuccess, isLoginVerificationPending } from "@workspace/client/lib/auth/forms/login-response";
import { passwordStrength } from "@workspace/client/lib/auth/password";
import { useAuth } from "@workspace/client/lib/auth";
import {
	OrganizationTeamInviteRegisterAcceptSchema,
	PLATFORM_DISPLAY_REGION,
	type ApiResponseMeta,
	type LoginClientResponse,
	type LoginResponse,
	type OrganizationMembershipRole,
	type OrganizationTeamInvitePreview,
} from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { cn } from "@workspace/ui/lib/core/utils";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { PasswordInput } from "@workspace/ui/components/password-input";
import { PasswordStrengthMeter } from "@workspace/ui/components/password-strength-meter";
import { toastMessage } from "@workspace/ui/components/toast";
import { ArrowLeft, Loader2, Mail, MapPin, Shield, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Suspense, useCallback, useMemo, useState, type ChangeEvent, type JSX, type SyntheticEvent } from "react";

import { TEAM_INVITE_PREVIEW_STALE_TIME_MS, retryTransientFailures } from "@/lib/query/query-policy";
import {
	isCompleteVerificationCode,
	resolveTeamInviteFormError,
	sanitizeVerificationCode,
	TEAM_INVITE_PREVIEW_QUERY_SCOPE,
	VERIFICATION_CODE_LENGTH,
} from "@/lib/team-invite/invite-form";

const ROLE_LABELS: Readonly<Record<OrganizationMembershipRole, string>> = {
	OWNER: "Owner",
	ADMIN: "Admin",
	MEMBER: "Member",
	POLICY_ADMIN: "Policy admin",
	CASHIER: "Cashier",
};

function formatLocationSummary(preview: OrganizationTeamInvitePreview): string {
	if (preview.locationScopeType === "ALL_LOCATIONS") {
		return "All locations";
	}

	if (preview.locationLabels.length > 0) {
		return preview.locationLabels.map((location) => location.name).join(", ");
	}

	return "Selected locations";
}

function formatExpiryDate(expiresAt: number): string {
	return formatEpochMs(expiresAt, "date", PLATFORM_DISPLAY_REGION);
}

function organizationInitials(displayName: string): string {
	const words = displayName
		.trim()
		.split(/\s+/)
		.filter((word) => word.length > 0);
	if (words.length === 0) return "?";

	if (words.length === 1) {
		const word = words[0] ?? "";
		return word.length > 0 ? word.slice(0, 2).toUpperCase() : "?";
	}

	const firstInitial = words[0]?.charAt(0) ?? "";
	const secondInitial = words[1]?.charAt(0) ?? "";
	return `${firstInitial}${secondInitial}`.toUpperCase();
}

interface InviteDetailRowProps {
	readonly icon: JSX.Element;
	readonly label: string;
	readonly value: string;
}

function InviteDetailRow({ icon, label, value }: InviteDetailRowProps): JSX.Element {
	return (
		<div className="flex items-start gap-3">
			<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-xs ring-1 ring-border/60">{icon}</div>
			<div className="min-w-0 space-y-0.5">
				<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
				<p className="text-sm font-medium text-foreground">{value}</p>
			</div>
		</div>
	);
}

interface TeamInviteContentProps {
	readonly token: string;
}

function TeamInviteContent({ token }: TeamInviteContentProps): JSX.Element {
	const router = useRouter();
	const { api, isAuthenticated, isLoading: authLoading, user, login: authLogin } = useAuth();

	// One id per page instance (the route remounts this component per token), so the key carries no token.
	const [previewInstanceId] = useState<string>(() => crypto.randomUUID());
	const [formError, setFormError] = useState<string | null>(null);
	const [fullName, setFullName] = useState("");
	const [password, setPassword] = useState("");
	const [loginVerificationId, setLoginVerificationId] = useState<string | null>(null);
	const [loginVerificationMessage, setLoginVerificationMessage] = useState<string | null>(null);
	const [verificationCode, setVerificationCode] = useState("");
	const [joinedOrganizationSlug, setJoinedOrganizationSlug] = useState<string | null>(null);

	const strength = useMemo(() => passwordStrength(password), [password]);

	// Reading the invitation is a READ, so it is a query (cached, deduplicated, retried only when transient) —
	// sent as POST by the API so the token stays out of URLs and logs.
	const previewQuery = useQuery({
		queryKey: [...TEAM_INVITE_PREVIEW_QUERY_SCOPE, previewInstanceId],
		queryFn: async (): Promise<OrganizationTeamInvitePreview> => (await api.organizations.validateTeamInvite.mutate({ token })).data,
		staleTime: TEAM_INVITE_PREVIEW_STALE_TIME_MS,
		gcTime: 0,
		retry: retryTransientFailures,
	});
	const preview: OrganizationTeamInvitePreview | null = previewQuery.data ?? null;
	const loadError: string | null = previewQuery.error === null ? null : resolveTeamInviteFormError(previewQuery.error);

	const navigateAfterJoin = useCallback(
		(organizationSlug: string): void => {
			toastMessage.success({ title: "Welcome to the team" });
			router.replace(orgRoutes(organizationSlug).dashboard);
			router.refresh();
		},
		[router],
	);

	const acceptMutation = api.organizations.acceptTeamInvite.useMutation({
		onSuccess: (response): void => {
			navigateAfterJoin(response.data.organizationSlug);
		},
		onError: (error): void => {
			toastMessage.error({ title: resolveAuthErrorMessage(error) });
		},
	});

	const completeAuthenticatedLogin = useCallback(
		(loginResponse: LoginResponse, answeredBy: ApiResponseMeta): void => {
			authLogin(loginResponse.user, answeredBy);

			const organizationSlug = joinedOrganizationSlug ?? preview?.organizationSlug;
			if (organizationSlug !== undefined && organizationSlug.length > 0) {
				navigateAfterJoin(organizationSlug);
			}
		},
		[authLogin, joinedOrganizationSlug, navigateAfterJoin, preview?.organizationSlug],
	);

	const handleAuthLoginResponse = useCallback(
		(loginResponse: LoginClientResponse, answeredBy: ApiResponseMeta): void => {
			if (isLoginVerificationPending(loginResponse)) {
				setLoginVerificationId(loginResponse.verificationId);
				setLoginVerificationMessage(loginResponse.message);
				setVerificationCode("");
				setFormError(null);
				if (preview !== null) {
					setJoinedOrganizationSlug(preview.organizationSlug);
				}
				return;
			}

			if (isLoginRestrictedEnrollment(loginResponse)) {
				if (loginResponse.user !== undefined) {
					authLogin(loginResponse.user, answeredBy);
				}
				markEnrollmentMessage(loginResponse.message);
				const organizationSlug = joinedOrganizationSlug ?? loginResponse.organizationSlug ?? preview?.organizationSlug;
				router.replace(getEnrollmentRedirectPath("merchant", loginResponse.enrollmentReason, organizationSlug));
				router.refresh();
				return;
			}

			if (!isLoginSuccess(loginResponse)) {
				setFormError("Unexpected sign-in response. Try signing in manually.");
				return;
			}

			completeAuthenticatedLogin(loginResponse, answeredBy);
		},
		[authLogin, completeAuthenticatedLogin, joinedOrganizationSlug, preview, router],
	);

	const registerMutation = api.organizations.registerAndAcceptTeamInvite.useMutation({
		onSuccess: (response): void => {
			handleAuthLoginResponse(response.data, response.meta);
		},
		onError: (error): void => {
			setFormError(resolveTeamInviteFormError(error));
		},
	});

	const verifyLoginMutation = api.auth.verifyLogin.useMutation({
		onSuccess: (response): void => {
			handleAuthLoginResponse(response.data, response.meta);
		},
		onError: (error): void => {
			setFormError(resolveAuthErrorMessage(error));
		},
	});

	const handleAccept = useCallback((): void => {
		if (authLoading || !isAuthenticated) {
			setFormError("Sign in or create your account before accepting this invitation.");
			return;
		}
		acceptMutation.mutate({ token });
	}, [acceptMutation, authLoading, isAuthenticated, token]);

	const handleRegisterSubmit = useCallback(
		(event: SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setFormError(null);

			const parsed = OrganizationTeamInviteRegisterAcceptSchema.safeParse({
				token,
				fullName,
				password,
			});
			if (!parsed.success) {
				setFormError(parsed.error.issues[0]?.message ?? "Check your account details.");
				return;
			}

			registerMutation.mutate(parsed.data);
		},
		[fullName, password, registerMutation, token],
	);

	const handleFullNameChange = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
		setFullName(event.target.value);
	}, []);

	const handlePasswordChange = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
		setPassword(event.target.value);
	}, []);

	const handleVerificationCodeChange = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
		setVerificationCode(sanitizeVerificationCode(event.target.value));
	}, []);

	const handleVerificationSubmit = useCallback(
		(event: SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			if (loginVerificationId === null || !isCompleteVerificationCode(verificationCode)) {
				return;
			}

			setFormError(null);
			verifyLoginMutation.mutate({ verificationId: loginVerificationId, code: verificationCode });
		},
		[loginVerificationId, verificationCode, verifyLoginMutation],
	);

	const loginHref = useMemo((): string => {
		const params = new URLSearchParams({
			redirect: `${ROUTES.teamInvite}?${new URLSearchParams({ token }).toString()}`,
		});
		if (preview !== null) {
			params.set("email", preview.email);
		}
		return `${ROUTES.auth.login}?${params.toString()}`;
	}, [preview, token]);

	const isLoading = previewQuery.isPending;
	const isAccepting = acceptMutation.isPending;
	const isRegistering = registerMutation.isPending;
	const isVerifyingLogin = verifyLoginMutation.isPending;
	const invitedEmail = preview?.email ?? "";
	const signedInEmail = user?.email ?? "";
	const isSignedInWithPreview = isAuthenticated && preview !== null;
	const signedInEmailIsInvited = signedInEmail.toLowerCase() === invitedEmail.toLowerCase();
	const emailMatchesInvite = isSignedInWithPreview && signedInEmailIsInvited;
	const signedInWrongAccount = isSignedInWithPreview && !signedInEmailIsInvited;
	const showLoginVerificationForm = loginVerificationId !== null;
	const showCreateAccountForm = preview !== null && !preview.hasExistingAccount && !authLoading && !isAuthenticated && !showLoginVerificationForm;
	const showSignInAction = preview !== null && preview.hasExistingAccount && !authLoading && !isAuthenticated;

	return (
		<div className="overflow-hidden rounded-2xl border border-border/80 bg-card/90 shadow-lg backdrop-blur-sm">
			<div className="h-1 bg-linear-to-r from-primary via-chart-2 to-primary/50" aria-hidden="true" />

			<div className="space-y-6 p-6 sm:p-8">
				<div className="space-y-4">
					<div className="flex items-center gap-2">
						<Badge variant="secondary" className="gap-1.5 px-2.5 py-1">
							<Users className="size-3.5" aria-hidden="true" />
							Team invitation
						</Badge>
					</div>

					{isLoading ? (
						<div className="flex items-center gap-3 rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8">
							<Loader2 className="size-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
							<p className="text-sm text-muted-foreground">Validating your invitation…</p>
						</div>
					) : null}

					{loadError !== null ? <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{loadError}</div> : null}

					{preview !== null ? (
						<>
							<div className="flex items-start gap-4">
								<div
									className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-semibold text-primary ring-1 ring-primary/15"
									aria-hidden="true">
									{organizationInitials(preview.organizationDisplayName)}
								</div>
								<div className="space-y-1">
									<h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Join {preview.organizationDisplayName}</h1>
									<p className="text-sm text-muted-foreground">You&apos;ve been invited to collaborate on this organization.</p>
								</div>
							</div>

							<div className="grid gap-4 rounded-xl border border-border/60 bg-muted/25 p-4 sm:p-5">
								<InviteDetailRow icon={<Shield className="size-4" aria-hidden="true" />} label="Role" value={ROLE_LABELS[preview.intendedRole]} />
								<InviteDetailRow icon={<Mail className="size-4" aria-hidden="true" />} label="Invited email" value={preview.email} />
								<InviteDetailRow icon={<MapPin className="size-4" aria-hidden="true" />} label="Location access" value={formatLocationSummary(preview)} />
							</div>

							<div className="rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
								{preview.hasExistingAccount ? (
									<p>
										Sign in with <span className="font-medium text-foreground">{preview.email}</span> to join the team. This invitation expires on{" "}
										<span className="font-medium text-foreground">{formatExpiryDate(preview.expiresAt)}</span>.
									</p>
								) : (
									<p>
										Set up your staff account for <span className="font-medium text-foreground">{preview.email}</span> below. Expires on{" "}
										<span className="font-medium text-foreground">{formatExpiryDate(preview.expiresAt)}</span>.
									</p>
								)}
							</div>

							{signedInWrongAccount ? (
								<div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
									You&apos;re signed in as <span className="font-medium">{signedInEmail}</span>. Sign in with <span className="font-medium">{invitedEmail}</span> to accept
									this invitation.
								</div>
							) : null}

							{showLoginVerificationForm ? (
								<form className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4 sm:p-5" onSubmit={handleVerificationSubmit}>
									<div className="space-y-1">
										<p className="text-sm font-medium text-foreground">Verify your email</p>
										<p className="text-xs text-muted-foreground">
											{loginVerificationMessage ?? `Enter the ${String(VERIFICATION_CODE_LENGTH)}-digit code sent to your email to finish joining the team.`}
										</p>
									</div>
									<div className="space-y-2">
										<Label htmlFor="team-invite-verification-code">Verification code</Label>
										<Input
											id="team-invite-verification-code"
											inputMode="numeric"
											autoComplete="one-time-code"
											placeholder="000000"
											value={verificationCode}
											onChange={handleVerificationCodeChange}
											className="h-11 text-center text-lg tracking-[0.3em]"
											maxLength={VERIFICATION_CODE_LENGTH}
											required
										/>
									</div>
									{formError !== null ? <p className="text-sm text-destructive">{formError}</p> : null}
									<Button
										type="submit"
										className="h-11 w-full sm:w-auto"
										loading={isVerifyingLogin}
										disabled={isVerifyingLogin || !isCompleteVerificationCode(verificationCode)}>
										{isVerifyingLogin ? "Verifying…" : "Verify and continue"}
									</Button>
								</form>
							) : null}

							{showCreateAccountForm ? (
								<form className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4 sm:p-5" onSubmit={handleRegisterSubmit}>
									<div className="space-y-1">
										<p className="text-sm font-medium text-foreground">Create your staff account</p>
										<p className="text-xs text-muted-foreground">Use the invited email and choose a password you&apos;ll sign in with later.</p>
									</div>
									<div className="space-y-2">
										<Label htmlFor="team-invite-full-name">Full name</Label>
										<Input id="team-invite-full-name" value={fullName} onChange={handleFullNameChange} required autoComplete="name" className="h-11" />
									</div>
									<div className="space-y-2">
										<Label htmlFor="team-invite-email">Work email</Label>
										<Input id="team-invite-email" type="email" value={preview.email} readOnly className="h-11 bg-background" />
									</div>
									<div className="space-y-2">
										<Label htmlFor="team-invite-password">Password</Label>
										<PasswordInput id="team-invite-password" value={password} onChange={handlePasswordChange} required autoComplete="new-password" className="h-11" />
										<PasswordStrengthMeter score={strength.score} label={strength.label} percent={strength.percent} criteria={strength.criteria} />
									</div>
									{formError !== null ? <p className="text-sm text-destructive">{formError}</p> : null}
									<Button type="submit" className="h-11 w-full sm:w-auto" loading={isRegistering} disabled={isRegistering}>
										{isRegistering ? "Creating account…" : "Create account & join team"}
									</Button>
								</form>
							) : null}
						</>
					) : null}
				</div>

				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<Link href={ROUTES.home} className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}>
						<ArrowLeft className="size-4" aria-hidden="true" />
						Back home
					</Link>

					{preview !== null && !authLoading ? (
						emailMatchesInvite ? (
							<Button type="button" className="w-full sm:w-auto" onClick={handleAccept} disabled={isAccepting} loading={isAccepting}>
								{isAccepting ? "Joining team…" : "Accept invitation"}
							</Button>
						) : showSignInAction || signedInWrongAccount ? (
							<Link href={loginHref} className={cn(buttonVariants(), "w-full sm:w-auto")}>
								{showSignInAction ? "Sign in to accept" : "Sign in with invited email"}
							</Link>
						) : null
					) : null}
				</div>
			</div>
		</div>
	);
}

function InvalidInviteCard(): JSX.Element {
	return (
		<div className="overflow-hidden rounded-2xl border border-destructive/20 bg-card/90 shadow-lg backdrop-blur-sm">
			<div className="h-1 bg-destructive/40" aria-hidden="true" />
			<div className="space-y-4 p-6 sm:p-8">
				<div className="space-y-2">
					<h1 className="text-xl font-semibold tracking-tight text-foreground">Invalid invitation link</h1>
					<p className="text-sm text-muted-foreground">This link is missing a token or has already been used. Ask your organization admin to send a new team invitation.</p>
				</div>
				<Link href={ROUTES.home} className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}>
					<ArrowLeft className="size-4" aria-hidden="true" />
					Back home
				</Link>
			</div>
		</div>
	);
}

function TeamInviteRouteContent(): JSX.Element {
	const searchParams = useSearchParams();
	const token = searchParams.get("token");

	if (token === null || token.length === 0) {
		return <InvalidInviteCard />;
	}

	// Keyed by token: another invitation link starts a fresh page instance (and preview query).
	return <TeamInviteContent key={token} token={token} />;
}

export default function TeamInvitePage(): JSX.Element {
	return (
		<div className="relative min-h-svh overflow-x-hidden bg-background">
			<div className="merchant-grid-bg-subtle pointer-events-none absolute inset-0" aria-hidden="true" />
			<div className="pointer-events-none absolute -top-24 right-0 size-80 rounded-full bg-primary/6 blur-3xl" aria-hidden="true" />
			<div className="pointer-events-none absolute bottom-0 left-0 size-72 rounded-full bg-chart-2/6 blur-3xl" aria-hidden="true" />

			<div className="relative z-10 mx-auto flex min-h-svh w-full max-w-3xl flex-col px-4 py-6 sm:px-6">
				<header className="mb-8 flex items-center gap-3">
					<div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
						<Users className="size-5" aria-hidden="true" />
					</div>
					<div>
						<p className="text-sm font-semibold text-foreground">Reward Hub</p>
						<p className="text-xs text-muted-foreground">Team invitation</p>
					</div>
				</header>

				<main className="flex flex-1 flex-col justify-center pb-8">
					<Suspense
						fallback={
							<div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-border bg-card/80">
								<Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
								<span className="sr-only">Loading invitation…</span>
							</div>
						}>
						<TeamInviteRouteContent />
					</Suspense>
				</main>

				<footer className="pt-2 text-center text-xs text-muted-foreground sm:text-left">&copy; {new Date().getFullYear()} Reward Hub. All rights reserved.</footer>
			</div>
		</div>
	);
}
