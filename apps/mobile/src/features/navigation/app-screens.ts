// What the app header calls each signed-in screen — one entry per route of the
// (app) group, in the screens' own words. The header resolves the title from
// the path the moment it changes, so the new title moves in step with the
// page instead of a frame after it. A screen whose title depends on its params
// (two-factor: turn on, or new backup codes) resolves it from them.

import { z } from "zod";

import { ROUTES, type AppRoute } from "../../runtime/routes";
import { DEVICES_COPY } from "../devices/labels";
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

const SUB_SCREEN_TITLES: ReadonlyMap<AppRoute, ScreenTitle> = new Map<AppRoute, ScreenTitle>([
	[ROUTES.security, fixed("Security")],
	[ROUTES.devices, fixed(DEVICES_COPY.title)],
	[ROUTES.appearance, fixed("Appearance")],
	[ROUTES.appLock, fixed("App lock")],
	[ROUTES.twoFactorSetup, (params: ScreenParams): string => twoFactorEnrollmentTitleOf(TwoFactorTitleParamsSchema.parse(params).mode)],
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
