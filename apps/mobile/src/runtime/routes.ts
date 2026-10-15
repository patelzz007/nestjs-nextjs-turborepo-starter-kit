// Every route of the app, by name — screens never hand-type a path (rules/00, "No magic").

export const ROUTES = {
	onboarding: "/onboarding",
	signIn: "/sign-in",
	signUp: "/sign-up",
	forgotPassword: "/forgot-password",
	verifyDevice: "/verify-device",
	twoFactor: "/two-factor",
	enrollTwoFactor: "/enroll-two-factor",
	verifyEmail: "/verify-email",
	home: "/",
	analytics: "/analytics",
	search: "/search",
	profile: "/profile",
	/** One commit of a GitHub repository (`?owner=&repository=&sha=`), pushed from the Profile's commit history. */
	githubCommit: "/profile/commit",
	/** The admin's GitHub pull requests (ADR 052), opened from the drawer's GitHub section. */
	pullRequests: "/profile/pull-requests",
	/** One pull request (`?owner=&repository=&number=`). */
	pullRequest: "/profile/pull-request",
	/** A pull request's changed files and diffs (`?owner=&repository=&number=`). */
	pullRequestFiles: "/profile/pull-request-files",
	/** A pull request's commits (`?owner=&repository=&number=`). */
	pullRequestCommits: "/profile/pull-request-commits",
	/** One of a pull request's commits with its diff (`?owner=&repository=&number=&sha=`), read with the admin's own token. */
	pullRequestCommit: "/profile/pull-request-commit",
	/** Linking or removing the admin's own GitHub token. */
	githubAccount: "/profile/github-account",
	settings: "/settings",
	security: "/settings/security",
	devices: "/settings/devices",
	appearance: "/settings/appearance",
	appLock: "/settings/app-lock",
	twoFactorSetup: "/settings/two-factor",
} satisfies Record<string, `/${string}`>;

/** Any one of the app's routes. */
export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
