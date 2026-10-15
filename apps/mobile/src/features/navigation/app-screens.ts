// What the app header calls each signed-in screen — one entry per route of the
// (app) group, in the screens' own words. The header resolves the title from
// the path the moment it changes, so the new title moves in step with the
// page instead of a frame after it. A screen whose title depends on its params
// (two-factor: turn on, or new backup codes) resolves it from them.

import { GithubCommitShaSchema, GithubPullRequestNumberSchema, GithubRepositoryNameSchema } from "@workspace/shared";
import { z } from "zod";

import { ROUTES, type AppRoute } from "../../runtime/routes";
import { DEVICES_COPY } from "../devices/labels";
import { commitScreenTitle } from "../github/labels";
import { COMMITS_TITLE, FILES_CHANGED_TITLE, GITHUB_ACCOUNT_TITLE, pullRequestScreenTitle, PULL_REQUESTS_TITLE } from "../github-pull-requests/labels";
import { twoFactorEnrollmentTitleOf } from "../two-factor/labels";
import { TwoFactorEnrollmentModeSchema } from "../two-factor/two-factor-enrollment";
import { APP_TABS, type AppTab } from "./app-tabs";

/** The current route's search params, as Expo Router reports them (untrusted: parsed per screen). */
export type ScreenParams = Readonly<Record<string, string | string[] | undefined>>;

/** Every title is resolved from the params, even a fixed one: one shape, no runtime type checks. */
type ScreenTitle = (params: ScreenParams) => string;

function fixed(title: string): ScreenTitle {
	return (): string => title;
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

const SUB_SCREEN_TITLES: ReadonlyMap<AppRoute, ScreenTitle> = new Map<AppRoute, ScreenTitle>([
	[ROUTES.security, fixed("Security")],
	[ROUTES.devices, fixed(DEVICES_COPY.title)],
	[ROUTES.appearance, fixed("Appearance")],
	[ROUTES.appLock, fixed("App lock")],
	[ROUTES.twoFactorSetup, (params: ScreenParams): string => twoFactorEnrollmentTitleOf(TwoFactorTitleParamsSchema.parse(params).mode)],
	[ROUTES.githubCommit, commitTitle],
	[ROUTES.pullRequests, fixed(PULL_REQUESTS_TITLE)],
	[ROUTES.pullRequest, pullRequestTitle],
	[ROUTES.pullRequestFiles, fixed(FILES_CHANGED_TITLE)],
	[ROUTES.pullRequestCommits, fixed(COMMITS_TITLE)],
	[ROUTES.pullRequestCommit, commitTitle],
	[ROUTES.githubAccount, fixed(GITHUB_ACCOUNT_TITLE)],
]);

const TITLES: ReadonlyMap<string, ScreenTitle> = new Map<string, ScreenTitle>([
	...APP_TABS.map((tab: AppTab): [string, ScreenTitle] => [tab.route, fixed(tab.title)]),
	...SUB_SCREEN_TITLES,
]);

/** The title of the screen at `pathname`; empty for a path the app does not have. */
export function screenTitleOf(pathname: string, params: ScreenParams): string {
	const title = TITLES.get(pathname);
	return title === undefined ? "" : title(params);
}
