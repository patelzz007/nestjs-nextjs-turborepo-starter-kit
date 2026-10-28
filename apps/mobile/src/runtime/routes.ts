// Every route of the app, by name — screens never hand-type a path (rules/00, "No magic").

export const ROUTES = {
	/** The configuration problem screen (the app cannot reach its API as configured). */
	configError: "/config-error",
	/** This build is too old for the API: update from the store. */
	updateRequired: "/update-required",
	/** The app lock, over a signed-in session. */
	lock: "/lock",
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
	/** The platform's servers (ADR 068), opened from the drawer's Operations section. */
	servers: "/settings/servers",
	/** One server's history and spec (`?serverId=`). */
	server: "/settings/server",
	settings: "/settings",
	security: "/settings/security",
	devices: "/settings/devices",
	appearance: "/settings/appearance",
	appLock: "/settings/app-lock",
	twoFactorSetup: "/settings/two-factor",
	/** The UI kit's live gallery (@workspace/ui-native), opened from the drawer's Developer section. */
	components: "/settings/components",
	/** This phone as a POS till: pair it, then scan and redeem customers' reward QR codes (features/till). */
	till: "/settings/till",
	/** Read a PDF: one the person picks, or `?url=&name=` pushed by another screen (features/pdf-viewer, ADR 056). */
	pdfViewer: "/settings/pdf-viewer",
} satisfies Record<string, `/${string}`>;

/** Any one of the app's routes. */
export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
