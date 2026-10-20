"use client";

import { initialDataOption, readPaginatedHasNext, readPaginatedNextCursor, readPaginatedTotal } from "@workspace/client/lib/api/envelope";
import { LIST_FIRST_PAGE, listPagePatch } from "@workspace/client/lib/url-state/list-url-state";
import { prefetchedDataFor, type PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import { REFEREES_LOADING_LABELS, REFERRAL_CODE_LOADING_LABELS } from "@/components/loading/loading-labels";
import { RefereeRowsBones, ReferralCodeBones } from "@/components/loading/referrals-skeleton";
import { WebPageHeader } from "@/components/web-ui/page-header";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import {
	PLATFORM_DISPLAY_REGION,
	type Envelope,
	type SignupReferralCodeState,
	type SignupReferralDashboard,
	type SignupReferralRefereeItem,
	type SignupReferralStatus,
} from "@workspace/shared";
import { StatusBadge, type StatusTone } from "@workspace/ui/components/status-badge";
import { Button } from "@workspace/ui/components/button";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";
import { Card } from "@workspace/ui/components/card";
import { Check, ChevronLeft, ChevronRight, Copy, Hourglass, UserPlus } from "lucide-react";
import * as React from "react";
import { SIGNUP_REFERRALS_DASHBOARD_PREFETCH_KEY, SIGNUP_REFERRALS_REFEREES_URL_STATE, toSignupReferralRefereesQuery } from "@/contexts/referrals/url-state/signup-referrals";
import { BRAND_NAME } from "@workspace/tokens";

type RefereesPage = Envelope<SignupReferralRefereeItem[]>;

export interface SignupReferralPageViewProps {
	readonly initialDashboard?: PrefetchedQuery<Envelope<SignupReferralDashboard>> | undefined;
	readonly initialReferees?: PrefetchedQuery<RefereesPage> | undefined;
}

/** How long the "Copied" confirmation stays on the copy button. */
const COPIED_FEEDBACK_MS = 2_000;

/** ADR 035 labels for a referee's status. */
export const SIGNUP_REFERRAL_STATUS_LABELS: Readonly<Record<SignupReferralStatus, string>> = {
	not_redeemed: "Not redeemed",
	redeemed: "Redeemed",
};

/** What the code panel says for each code state (ADR 035, "Labels"). */
export const CODE_STATE_MESSAGES: Readonly<Record<SignupReferralCodeState, string>> = {
	active: `Share this code when friends create their ${BRAND_NAME} account.`,
	expired: "This code has expired and can no longer be used. A new code is issued within the hour.",
	unavailable: "Your code cannot be used while your account is inactive.",
	pending: "Your code is not ready yet.",
};

/** The badge beside a code that is shown but cannot be shared. */
const CODE_STATE_BADGES: Readonly<Partial<Record<SignupReferralCodeState, { readonly label: string; readonly tone: StatusTone }>>> = {
	expired: { label: "Code expired", tone: "muted" },
	unavailable: { label: "Code unavailable", tone: "danger" },
};

/** Redeemed is the referral's success; not redeemed is still waiting on the referee. */
const REFERRAL_STATUS_TONES: Readonly<Record<SignupReferralStatus, StatusTone>> = {
	not_redeemed: "warning",
	redeemed: "success",
};

function codeStateBadge(codeState: SignupReferralCodeState): React.ReactNode {
	const badge = CODE_STATE_BADGES[codeState];
	return badge === undefined ? null : <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>;
}

function referralStatusBadge(status: SignupReferralStatus): React.ReactNode {
	return <StatusBadge tone={REFERRAL_STATUS_TONES[status]}>{SIGNUP_REFERRAL_STATUS_LABELS[status]}</StatusBadge>;
}

export function SignupReferralPageView({ initialDashboard, initialReferees }: SignupReferralPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const [urlState, updateUrlState] = useUrlState(SIGNUP_REFERRALS_REFEREES_URL_STATE);
	const [copied, setCopied] = React.useState(false);

	const prefetchedDashboard = prefetchedDataFor(initialDashboard, SIGNUP_REFERRALS_DASHBOARD_PREFETCH_KEY);
	const dashboardQuery = api.auth.signupReferralsDashboard.useQuery(undefined, initialDataOption(prefetchedDashboard));
	const prefetchedReferees = prefetchedDataFor(initialReferees, SIGNUP_REFERRALS_REFEREES_URL_STATE.serialize(urlState));
	const refereesQuery = api.auth.signupReferralsReferees.useQuery(toSignupReferralRefereesQuery(urlState), initialDataOption(prefetchedReferees));

	const dashboard = dashboardQuery.data?.data;
	const referees: readonly SignupReferralRefereeItem[] = refereesQuery.data?.data ?? [];
	const hasNext = readPaginatedHasNext(refereesQuery.data?.meta);
	const nextCursor = readPaginatedNextCursor(refereesQuery.data?.meta);
	const hasPrevious = urlState.page > LIST_FIRST_PAGE;
	const totalReferees = refereesQuery.data === undefined ? "—" : String(readPaginatedTotal(refereesQuery.data.meta));

	const shareableCode: string | null = dashboard?.shareable === true ? dashboard.code : null;
	const handleCopy = React.useCallback((): void => {
		if (shareableCode === null) {
			return;
		}
		void navigator.clipboard.writeText(shareableCode).then((): void => {
			setCopied(true);
			window.setTimeout((): void => {
				setCopied(false);
			}, COPIED_FEEDBACK_MS);
		});
	}, [shareableCode]);

	const handleNext = React.useCallback((): void => {
		updateUrlState(listPagePatch(urlState, urlState.page + 1, nextCursor));
	}, [nextCursor, updateUrlState, urlState]);

	const handlePrevious = React.useCallback((): void => {
		if (urlState.page <= LIST_FIRST_PAGE) {
			return;
		}
		updateUrlState(listPagePatch(urlState, urlState.page - 1, null));
	}, [updateUrlState, urlState]);

	return (
		<div className="space-y-10">
			<WebPageHeader
				title="Referrals"
				description="Give friends your code when they sign up. You will see them here once they register, and again when they redeem their first reward."
			/>

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
				<Card className="relative gap-0 overflow-hidden border border-dashed border-primary/30 bg-gradient-to-br from-primary/8 via-background to-background p-6 ring-0 sm:p-8">
					<div className="pointer-events-none absolute -top-10 -right-8 text-[7rem] font-semibold tracking-tighter text-primary/10" aria-hidden="true">
						RH
					</div>
					{dashboard === undefined ? (
						<SkeletonRegion labels={REFERRAL_CODE_LOADING_LABELS} className="relative">
							<ReferralCodeBones />
						</SkeletonRegion>
					) : (
						<div className="relative space-y-5">
							<p className="max-w-md text-sm leading-relaxed text-muted-foreground">{CODE_STATE_MESSAGES[dashboard.codeState]}</p>
							<div className="flex flex-wrap items-end gap-4">
								<div className="space-y-1">
									<p className="text-xs text-muted-foreground">Your referral code</p>
									<p className="font-mono text-3xl font-semibold tracking-[0.35em] text-foreground sm:text-4xl">{dashboard.code ?? "········"}</p>
								</div>
								{codeStateBadge(dashboard.codeState)}
								{shareableCode !== null ? (
									<Button type="button" variant="secondary" size="sm" onClick={handleCopy} className="gap-2">
										{copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
										{copied ? "Copied" : "Copy code"}
									</Button>
								) : null}
							</div>
							{dashboard.expiresAt !== null ? (
								<p className="flex items-center gap-2 text-xs text-muted-foreground">
									<Hourglass className="size-3.5 shrink-0" aria-hidden="true" />
									{dashboard.codeState === "expired" ? "Expired" : "Valid until"} {formatEpochMs(dashboard.expiresAt, "dateTime", PLATFORM_DISPLAY_REGION)}
								</p>
							) : null}
						</div>
					)}
				</Card>

				<Card className="justify-between gap-4 p-6">
					<div className="space-y-1">
						<p className="text-sm font-medium text-foreground">People who used your code</p>
						<p className="text-3xl font-semibold text-foreground tabular-nums">{totalReferees}</p>
					</div>
					<p className="text-sm text-muted-foreground">A referral counts as successful after someone redeems any reward at checkout.</p>
				</Card>
			</div>

			<Card className="gap-0 p-0">
				<div className="border-b border-border px-6 py-4">
					<h2 className="text-base font-semibold text-foreground">Registered with your code</h2>
				</div>
				{refereesQuery.isLoading ? (
					<SkeletonRegion labels={REFEREES_LOADING_LABELS}>
						<RefereeRowsBones />
					</SkeletonRegion>
				) : referees.length === 0 ? (
					<Empty className="border bg-card">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<UserPlus className="size-8" aria-hidden="true" />
							</EmptyMedia>
							<EmptyTitle role="heading" aria-level={2}>
								No one has registered with your code yet.
							</EmptyTitle>
							<EmptyDescription>When they do, their name and status will show up here.</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<ul className="divide-y divide-border">
						{referees.map((referee) => (
							<li key={`${referee.fullName}-${String(referee.createdAt)}`} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
								<div>
									<p className="font-medium text-foreground">{referee.fullName}</p>
									<p className="text-xs text-muted-foreground">Joined {formatEpochMs(referee.createdAt, "dateTime", PLATFORM_DISPLAY_REGION)}</p>
								</div>
								{referralStatusBadge(referee.status)}
							</li>
						))}
					</ul>
				)}
				{referees.length > 0 ? (
					<div className="flex items-center justify-between border-t border-border px-6 py-3">
						<Button type="button" variant="ghost" size="sm" disabled={!hasPrevious} onClick={handlePrevious} className="gap-1">
							<ChevronLeft className="size-4" aria-hidden="true" />
							Previous
						</Button>
						<Button type="button" variant="ghost" size="sm" disabled={!hasNext} onClick={handleNext} className="gap-1">
							Next
							<ChevronRight className="size-4" aria-hidden="true" />
						</Button>
					</div>
				) : null}
			</Card>
		</div>
	);
}
