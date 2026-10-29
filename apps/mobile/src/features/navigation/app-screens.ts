// What the app header calls each signed-in screen — one entry per route of the
// (app) group, in the screens' own words: the title, and the one line under it
// saying what the page is for. The header resolves both from the path the
// moment it changes, so the new heading moves in step with the page instead of
// a frame after it. A screen whose title depends on its params (two-factor:
// turn on, or new backup codes; a commit's SHA) resolves it from them.

import { GithubCommitShaSchema, GithubPullRequestNumberSchema, GithubRepositoryNameSchema } from "@workspace/shared";
import { z } from "zod";

import { ROUTES, type AppRoute } from "../../runtime/routes";
import { DEVICES_COPY, TwoFactorEnrollmentModeSchema, twoFactorEnrollmentTitleOf } from "../../contexts/identity";
import { PDF_VIEWER_TITLE } from "../pdf-viewer/labels";
import { TILL_TITLE } from "../../contexts/pos";
import { SERVER_TITLE, SERVERS_TITLE } from "../../contexts/operations";
import { COMMITS_TITLE, commitScreenTitle, FILES_CHANGED_TITLE, GITHUB_ACCOUNT_TITLE, PULL_REQUESTS_TITLE, pullRequestScreenTitle } from "../../contexts/integrations-github";
import { APP_TABS, type AppTab } from "./app-tabs";

/** The current route's search params, as Expo Router reports them (untrusted: parsed per screen). */
export type ScreenParams = Readonly<Record<string, string | string[] | undefined>>;

/** What the header shows for a screen: its title, and one line under it saying what the page is for. */
export interface ScreenHeading {
	readonly title: string;
	readonly subtitle: string;
}

/** Every title is resolved from the params, even a fixed one: one shape, no runtime type checks. */
type ScreenTitle = (params: ScreenParams) => string;

/** A screen's title (fixed or from its params) and its subtitle. */
interface ScreenEntry {
	readonly title: ScreenTitle;
	readonly subtitle: string;
}

function fixed(title: string): ScreenTitle {
	return (): string => title;
}

/** A screen with a fixed title. */
function entry(title: string, subtitle: string): ScreenEntry {
	return { title: fixed(title), subtitle };
}

/** A screen whose title is resolved from its params. */
function paramEntry(title: ScreenTitle, subtitle: string): ScreenEntry {
	return { title, subtitle };
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

/** Each tab's subtitle; the tab's title comes from APP_TABS. */
const TAB_SUBTITLES: Readonly<Record<AppTab["name"], string>> = {
	index: "Your account at a glance",
	analytics: "Your activity over time",
	search: "Find anything in the app",
	profile: "Your personal details",
	settings: "Manage your preferences and account",
};

const SUB_SCREENS: ReadonlyMap<AppRoute, ScreenEntry> = new Map<AppRoute, ScreenEntry>([
	[ROUTES.security, entry("Security", "Your password and sign-in")],
	[ROUTES.devices, entry(DEVICES_COPY.title, "Where your account is signed in")],
	[ROUTES.appearance, entry("Appearance", "Choose how the app looks")],
	[ROUTES.appLock, entry("App lock", "Lock the app when you leave it")],
	[ROUTES.components, entry("Components", "The UI kit, live")],
	[ROUTES.till, entry(TILL_TITLE, "Scan and redeem customers' rewards")],
	[ROUTES.pdfViewer, entry(PDF_VIEWER_TITLE, "Read a document")],
	[
		ROUTES.twoFactorSetup,
		paramEntry((params: ScreenParams): string => twoFactorEnrollmentTitleOf(TwoFactorTitleParamsSchema.parse(params).mode), "A second step when you sign in"),
	],
	[ROUTES.githubCommit, paramEntry(commitTitle, "What changed in this commit")],
	[ROUTES.pullRequests, entry(PULL_REQUESTS_TITLE, "Your open and recent pull requests")],
	[ROUTES.pullRequest, paramEntry(pullRequestTitle, "Its description, checks and reviews")],
	[ROUTES.pullRequestFiles, entry(FILES_CHANGED_TITLE, "Every changed file, with its diff")],
	[ROUTES.pullRequestCommits, entry(COMMITS_TITLE, "The pull request's commits")],
	[ROUTES.pullRequestCommit, paramEntry(commitTitle, "What changed in this commit")],
	[ROUTES.githubAccount, entry(GITHUB_ACCOUNT_TITLE, "The token the app reads GitHub with")],
	[ROUTES.servers, entry(SERVERS_TITLE, "Every machine the platform runs on")],
	[ROUTES.server, entry(SERVER_TITLE, "Its history and its spec")],
]);

const SCREENS: ReadonlyMap<string, ScreenEntry> = new Map<string, ScreenEntry>([
	...APP_TABS.map((tab: AppTab): [string, ScreenEntry] => [tab.route, entry(tab.title, TAB_SUBTITLES[tab.name])]),
	...SUB_SCREENS,
]);

const NO_HEADING: ScreenHeading = { title: "", subtitle: "" };

/** The heading of the screen at `pathname`; empty for a path the app does not have. */
export function screenHeadingOf(pathname: string, params: ScreenParams): ScreenHeading {
	const screen = SCREENS.get(pathname);
	return screen === undefined ? NO_HEADING : { title: screen.title(params), subtitle: screen.subtitle };
}
