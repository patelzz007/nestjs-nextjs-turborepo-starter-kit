import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";
import { SettingsSectionHeaderSkeleton } from "@workspace/ui/components/settings-shell";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { FormSkeleton, ListSkeleton, ProseSkeleton } from "@workspace/ui/components/skeleton-patterns";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { cn } from "@workspace/ui/lib/core/utils";
import type * as React from "react";

import { GITHUB_TOKEN_LOADING_LABELS, PROFILE_LOADING_LABELS, SECURITY_LOADING_LABELS } from "@/components/loading/loading-labels";
import { CardHeadingSkeleton } from "@/components/loading/skeleton-parts";

// ── Profile ──────────────────────────────────────────────────────────────────

/** `ProfileForm`: full name. */
const PROFILE_FORM_FIELDS = 1;

/** Facts in the identity header: member since, last edited, permissions. */
const PROFILE_FACTS = 3;
const PROFILE_FACT_SLOTS: readonly number[] = [...Array<number>(PROFILE_FACTS).keys()];
/** Rows in the access panel while roles load. */
const ACCESS_ROWS = 2;

/**
 * `/account/profile`: the identity header (avatar, name, email, roles, the
 * facts strip), then the personal-details card beside the access panel.
 */
export function ProfilePageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={PROFILE_LOADING_LABELS} className="flex w-full flex-col gap-8">
			<div data-skeleton="profile-identity" className="flex flex-col gap-6">
				<div className="flex flex-col gap-5 sm:flex-row sm:items-center">
					<Skeleton variant="circular" className="size-22" />
					<div className="flex flex-col gap-2">
						<Skeleton className="h-9 w-64" />
						<Skeleton variant="text" className="h-3 w-48" />
						<Skeleton className="h-5 w-24" />
					</div>
				</div>
				<div className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-card px-5 py-4 sm:grid-cols-3">
					{PROFILE_FACT_SLOTS.map((slot: number): React.JSX.Element => (
						<div key={slot} className="flex flex-col gap-2">
							<Skeleton variant="text" className="h-3 w-20" />
							<Skeleton variant="text" className="h-4 w-28" />
						</div>
					))}
				</div>
			</div>
			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<Card>
					<CardHeader>
						<CardHeadingSkeleton />
					</CardHeader>
					<CardContent className="flex flex-col gap-6">
						<div data-skeleton="profile-avatar" className="flex items-center gap-4">
							<Skeleton variant="circular" className="size-16" />
							<div className="flex flex-col gap-2">
								<div className="flex gap-2">
									<Skeleton className="h-8 w-28" />
									<Skeleton className="h-8 w-20" />
								</div>
								<Skeleton variant="text" className="h-3 w-48" />
							</div>
						</div>
						<FormSkeleton surface="plain" fields={PROFILE_FORM_FIELDS} withActions={false} />
						<Skeleton className="h-9 w-32" />
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardHeadingSkeleton />
					</CardHeader>
					<CardContent>
						<ListSkeleton rows={ACCESS_ROWS} surface="plain" withHeading={false} />
					</CardContent>
				</Card>
			</div>
		</SkeletonRegion>
	);
}

// ── Security ─────────────────────────────────────────────────────────────────

/** `ChangePasswordForm`: current, new, confirm. */
const CHANGE_PASSWORD_FIELDS = 3;
/** Signed-in device rows drawn while the sessions load. */
const SIGNED_IN_DEVICE_ROWS = 2;
/** Lines of explanatory copy in the two-factor and recovery sections. */
const SECURITY_PROSE_LINES = 2;

/** One `SecuritySettingsPanel` section: a bordered card-colored block with its `h2` + description. */
function SecuritySectionSkeleton({ wide, children }: { readonly wide: boolean; readonly children: React.ReactNode }): React.JSX.Element {
	return (
		<div data-skeleton="security-section" className={cn("flex flex-col gap-4 rounded-xl border bg-card p-6", wide && "lg:col-span-2")}>
			<CardHeadingSkeleton />
			{children}
		</div>
	);
}

/**
 * `/account/security`: the section header, then the security grid — email verification,
 * change password beside two-factor, signed-in devices, MFA recovery.
 */
export function SecurityPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={SECURITY_LOADING_LABELS} className="flex flex-col gap-6">
			<SettingsSectionHeaderSkeleton />
			<div className="grid gap-8 lg:grid-cols-2">
				<SecuritySectionSkeleton wide>
					<Skeleton variant="text" className="h-3.5 w-64 max-w-full" />
				</SecuritySectionSkeleton>
				<SecuritySectionSkeleton wide={false}>
					<FormSkeleton surface="plain" fields={CHANGE_PASSWORD_FIELDS} />
				</SecuritySectionSkeleton>
				<SecuritySectionSkeleton wide={false}>
					<ProseSkeleton lines={SECURITY_PROSE_LINES} />
					<Skeleton className="h-9 w-40" />
				</SecuritySectionSkeleton>
				<SecuritySectionSkeleton wide>
					<ListSkeleton surface="plain" leading="icon" rows={SIGNED_IN_DEVICE_ROWS} />
				</SecuritySectionSkeleton>
				<SecuritySectionSkeleton wide>
					<ProseSkeleton lines={SECURITY_PROSE_LINES} />
					<Skeleton className="h-9 w-40" />
				</SecuritySectionSkeleton>
			</div>
		</SkeletonRegion>
	);
}

// ── GitHub token ─────────────────────────────────────────────────────────────

/** Lines of the token's required permissions. */
const GITHUB_TOKEN_PERMISSION_LINES = 4;
/** The token field. */
const GITHUB_TOKEN_FORM_FIELDS = 1;

export interface GithubTokenPageSkeletonProps {
	/** The page header too (the route's `loading.tsx`); the panel's own loading state sits under the real header. */
	readonly withHeader?: boolean;
}

/**
 * `/account/github`: the linked-account card beside the link-a-token card (permissions, the
 * GitHub link button, the token field).
 */
export function GithubTokenPageSkeleton({ withHeader = false }: GithubTokenPageSkeletonProps): React.JSX.Element {
	return (
		<SkeletonRegion labels={GITHUB_TOKEN_LOADING_LABELS} className="flex flex-col gap-6">
			{withHeader ? <SettingsSectionHeaderSkeleton /> : null}
			<div className="grid items-start gap-6 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardHeadingSkeleton />
					</CardHeader>
					<CardContent>
						<Skeleton className="h-9 w-32" />
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardHeadingSkeleton />
					</CardHeader>
					<CardContent className="flex flex-col gap-5">
						<ProseSkeleton lines={GITHUB_TOKEN_PERMISSION_LINES} />
						<Skeleton className="h-9 w-52" />
						<FormSkeleton surface="plain" fields={GITHUB_TOKEN_FORM_FIELDS} />
					</CardContent>
				</Card>
			</div>
		</SkeletonRegion>
	);
}
