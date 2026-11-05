// What the app header calls each signed-in screen — one entry per route of the
// (app) group, in the screens' own words: the title, and the one line under it
// saying what the page is for. The header resolves both from the path the
// moment it changes, so the new heading moves in step with the page instead of
// a frame after it. A screen whose title depends on its params (two-factor:
// turn on, or new backup codes; a commit's SHA) resolves it from them.

import { GithubCommitShaSchema, GithubPullRequestNumberSchema, GithubRepositoryNameSchema } from "@workspace/shared";
import { z } from "zod";

import { ROUTES, type AppRoute } from "../../runtime/routes";
import { TwoFactorEnrollmentModeSchema, twoFactorEnrollmentTitleOf } from "../../contexts/identity";
import { commitScreenTitle, pullRequestScreenTitle } from "../../contexts/integrations-github";
import { APP_TABS, type AppTab } from "./app-tabs";
import type { HeadingKey, NavigationLabels, ScreenHeading } from "./navigation-labels";

export type { ScreenHeading } from "./navigation-labels";

/** The current route's search params, as Expo Router reports them (untrusted: parsed per screen). */
export type ScreenParams = Readonly<Record<string, string | string[] | undefined>>;

/** A screen's heading, from the navigation's labels (in the language on screen) and, for some, its params. */
type ScreenHeadingOf = (labels: NavigationLabels, params: ScreenParams) => ScreenHeading;

/** A screen with a fixed heading, translated (navigation-labels.ts). */
function translated(key: HeadingKey): ScreenHeadingOf {
	return (labels: NavigationLabels): ScreenHeading => labels.headings[key];
}

/** A screen whose title is resolved from its params by its own context (English until that context is translated). */
function paramEntry(title: (params: ScreenParams) => string, subtitle: string): ScreenHeadingOf {
	return (_labels: NavigationLabels, params: ScreenParams): ScreenHeading => ({ title: title(params), subtitle });
}

/** `?mode=` of the two-factor screen; anything else is the default, turning it on. */
const TwoFactorTitleParamsSchema = z.object({ mode: TwoFactorEnrollmentModeSchema.catch("setup") }).catch({ mode: "setup" });

/** GitHub's short form of a commit SHA, shown in the title ("Commit a1b2c3d"). */
const SHORT_SHA_LENGTH = 7;

/** `?sha=` of the commit screen; anything that is not a full SHA leaves the title plain. */
const CommitTitleParamsSchema = z.object({ sha: GithubCommitShaSchema.nullable().catch(null) }).catch({ sha: null });

/** `?repository=&number=` of the pull-request screen; a link that names none leaves the title plain. */
const PullRequestTitleParamsSchema = z
	.object({ repository: GithubRepositoryNameSchema.nullable().catch(null), number: GithubPullRequestNumberSchema.nullable().catch(null) })
	.catch({ repository: null, number: null });

/** "Commit 4f2a9c1" — the Profile's commits and a pull request's alike; plainly "Commit" when the link carries no SHA. */
function commitTitle(params: ScreenParams): string {
	return commitScreenTitle(CommitTitleParamsSchema.parse(params).sha?.slice(0, SHORT_SHA_LENGTH) ?? null);
}

function pullRequestTitle(params: ScreenParams): string {
	const parsed = PullRequestTitleParamsSchema.parse(params);
	return pullRequestScreenTitle(parsed.repository, parsed.number);
}

const SUB_SCREENS: ReadonlyMap<AppRoute, ScreenHeadingOf> = new Map<AppRoute, ScreenHeadingOf>([
	[ROUTES.security, translated("security")],
	[ROUTES.devices, translated("devices")],
	[ROUTES.appearance, translated("appearance")],
	[ROUTES.appLock, translated("appLock")],
	[ROUTES.language, translated("language")],
	[ROUTES.components, translated("components")],
	[ROUTES.till, translated("till")],
	[ROUTES.notifications, translated("notifications")],
	[ROUTES.notificationSettings, translated("notificationSettings")],
	[ROUTES.pdfViewer, translated("pdfViewer")],
	[
		ROUTES.twoFactorSetup,
		paramEntry((params: ScreenParams): string => twoFactorEnrollmentTitleOf(TwoFactorTitleParamsSchema.parse(params).mode), "A second step when you sign in"),
	],
	[ROUTES.githubCommit, paramEntry(commitTitle, "What changed in this commit")],
	[ROUTES.pullRequests, translated("pullRequests")],
	[ROUTES.pullRequest, paramEntry(pullRequestTitle, "Its description, checks and reviews")],
	[ROUTES.pullRequestFiles, translated("pullRequestFiles")],
	[ROUTES.pullRequestCommits, translated("pullRequestCommits")],
	[ROUTES.pullRequestCommit, paramEntry(commitTitle, "What changed in this commit")],
	[ROUTES.githubAccount, translated("githubAccount")],
	[ROUTES.servers, translated("servers")],
	[ROUTES.server, translated("server")],
]);

const SCREENS: ReadonlyMap<string, ScreenHeadingOf> = new Map<string, ScreenHeadingOf>([
	...APP_TABS.map((tab: AppTab): [string, ScreenHeadingOf] => [tab.route, translated(tab.name)]),
	...SUB_SCREENS,
]);

const NO_HEADING: ScreenHeading = { title: "", subtitle: "" };

/** The heading of the screen at `pathname`, in `labels`' language; empty for a path the app does not have. */
export function screenHeadingOf(pathname: string, params: ScreenParams, labels: NavigationLabels): ScreenHeading {
	return SCREENS.get(pathname)?.(labels, params) ?? NO_HEADING;
}
