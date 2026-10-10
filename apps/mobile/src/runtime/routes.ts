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
	search: "/search",
	profile: "/profile",
	settings: "/settings",
	security: "/settings/security",
	devices: "/settings/devices",
	appearance: "/settings/appearance",
	appLock: "/settings/app-lock",
	twoFactorSetup: "/settings/two-factor",
} satisfies Record<string, `/${string}`>;

/** Any one of the app's routes. */
export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
