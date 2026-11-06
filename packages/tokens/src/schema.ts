// ============================================
// schema.ts — the zod contract of the design token source (ADR 030)
// ============================================
// Every token type in this package is inferred from a schema here, so the data
// and its runtime validation can never drift. Records keyed by a `z.enum` are
// EXHAUSTIVE in zod 4: a theme object that misses a role is a TypeScript error
// in the data module and a parse error in the generator.
//
// Names are CSS custom-property names without the leading `--`.

import { z } from "zod";

/** The largest hue angle `oklch()` takes, in degrees. */
const HUE_MAX_DEGREES = 360;

/** A CSS identifier as this package writes one: lowercase words joined by hyphens (`color-card`, `shadow-2xs`). */
const CSS_IDENTIFIER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** A six-digit lowercase hex colour (`#f1f4f9`). */
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/u;

const UnitIntervalSchema = z.number().min(0).max(1);

// ─── Colour literals ──────────────────────────────────────────────────────

export const OklchColorSchema = z.strictObject({
	kind: z.literal("oklch"),
	lightness: UnitIntervalSchema,
	chroma: z.number().nonnegative(),
	hue: z.number().min(0).max(HUE_MAX_DEGREES),
	alpha: UnitIntervalSchema.optional(),
});
export type OklchColor = z.infer<typeof OklchColorSchema>;

export const HexColorSchema = z.strictObject({
	kind: z.literal("hex"),
	value: z.string().regex(HEX_COLOR_PATTERN),
});
export type HexColor = z.infer<typeof HexColorSchema>;

export const ColorKeywordSchema = z.strictObject({
	kind: z.literal("keyword"),
	value: z.enum(["transparent"]),
});
export type ColorKeyword = z.infer<typeof ColorKeywordSchema>;

/** A colour written out in full — what a palette step holds and what every reference finally resolves to. */
export const ColorLiteralSchema = z.discriminatedUnion("kind", [OklchColorSchema, HexColorSchema, ColorKeywordSchema]);
export type ColorLiteral = z.infer<typeof ColorLiteralSchema>;

/** A palette step: an `oklch()` or hex colour (never a keyword). */
export const PrimitiveColorSchema = z.discriminatedUnion("kind", [OklchColorSchema, HexColorSchema]);
export type PrimitiveColor = z.infer<typeof PrimitiveColorSchema>;

// ─── Palette (primitives) ─────────────────────────────────────────────────

export const NeutralStepSchema = z.enum(["0", "25", "40", "50", "100", "200", "300", "400", "500", "600", "700", "800", "900"]);
export const InkStepSchema = z.enum(["50", "100", "200", "300", "400", "500", "600", "650", "700", "750", "800", "850", "900", "950"]);
/** The accent scales (brand, blue, green): a 50–950 ramp plus the 960 / 975 deep sidebar tones of the dark theme. */
export const AccentStepSchema = z.enum(["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950", "960", "975"]);
export const WarmStepSchema = z.enum(["300", "500", "700"]);
/** Nord (nordtheme.com): its sixteen named colours, `nord0`–`nord15` — Polar Night 0–3, Snow Storm 4–6, Frost 7–10, Aurora 11–15. */
export const NordStepSchema = z.enum(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"]);
/**
 * The pure greys (zero chroma) of the mobile app's own visual system (ADR 079), named by lightness: 10 the
 * lightest surface, 975 the deepest dark chrome.
 */
export const GrayStepSchema = z.enum(["10", "25", "50", "100", "200", "300", "400", "500", "600", "700", "900"]);
/**
 * The mobile Nord theme's editor slate (ADR 079): a cool blue-grey from the owner's reference — 950 the
 * deepest chrome, 900 the page, 800 surfaces, 750 raised, 700 hairlines, 600 control edges; 25 and 200 the
 * sharper text and secondary text the theme reads in, 50 / 100 / 300 the reference's own; and its
 * steel-blue accent (`accent`) with the soft tint under it.
 */
export const DuskStepSchema = z.enum(["25", "50", "100", "200", "300", "600", "700", "750", "800", "900", "950", "accent", "accent-soft", "accent-link"]);

/** The mobile dark theme\'s graphite: neutral greys leaning faintly cool (ADR 079). */
export const GraphiteStepSchema = z.enum(["25", "400", "700", "750", "800", "850", "950", "975"]);
/** The Nord accents the `nord` theme fills with, boosted (`vivid`): numbered after the Nord colour each one comes from. */
export const VividStepSchema = z.enum(["8", "9", "14"]);

/** The step names each palette scale defines, in scale order. */
export const PALETTE_STEP_SCHEMAS = {
	neutral: NeutralStepSchema,
	ink: InkStepSchema,
	brand: AccentStepSchema,
	warm: WarmStepSchema,
	blue: AccentStepSchema,
	green: AccentStepSchema,
	nord: NordStepSchema,
	vivid: VividStepSchema,
	gray: GrayStepSchema,
	dusk: DuskStepSchema,
	graphite: GraphiteStepSchema,
};

export const PaletteSchema = z.strictObject({
	neutral: z.record(PALETTE_STEP_SCHEMAS.neutral, PrimitiveColorSchema),
	ink: z.record(PALETTE_STEP_SCHEMAS.ink, PrimitiveColorSchema),
	brand: z.record(PALETTE_STEP_SCHEMAS.brand, PrimitiveColorSchema),
	warm: z.record(PALETTE_STEP_SCHEMAS.warm, PrimitiveColorSchema),
	blue: z.record(PALETTE_STEP_SCHEMAS.blue, PrimitiveColorSchema),
	green: z.record(PALETTE_STEP_SCHEMAS.green, PrimitiveColorSchema),
	nord: z.record(PALETTE_STEP_SCHEMAS.nord, PrimitiveColorSchema),
	vivid: z.record(PALETTE_STEP_SCHEMAS.vivid, PrimitiveColorSchema),
	gray: z.record(PALETTE_STEP_SCHEMAS.gray, PrimitiveColorSchema),
	dusk: z.record(PALETTE_STEP_SCHEMAS.dusk, PrimitiveColorSchema),
	graphite: z.record(PALETTE_STEP_SCHEMAS.graphite, PrimitiveColorSchema),
});
export type Palette = z.infer<typeof PaletteSchema>;

/** The palette scales, in the order they are written out. */
export const PaletteScaleSchema = PaletteSchema.keyof();
export type PaletteScale = z.infer<typeof PaletteScaleSchema>;

/** Every step name any scale defines. */
export const PaletteStepNameSchema = z.union([
	NeutralStepSchema,
	InkStepSchema,
	AccentStepSchema,
	WarmStepSchema,
	NordStepSchema,
	GrayStepSchema,
	DuskStepSchema,
	GraphiteStepSchema,
]);
export type PaletteStepName = z.infer<typeof PaletteStepNameSchema>;

/** The steps one scale defines (`PaletteStep<"warm">` is `"300" | "500" | "700"`). */
export type PaletteStep<TScale extends PaletteScale> = keyof Palette[TScale] & PaletteStepName;

/** A semantic token pointing at a palette step — written `var(--palette-<scale>-<step>)` on the web. */
export const PaletteReferenceSchema = z
	.strictObject({
		kind: z.literal("palette"),
		scale: PaletteScaleSchema,
		step: PaletteStepNameSchema,
	})
	.refine(({ scale, step }) => PALETTE_STEP_SCHEMAS[scale].safeParse(step).success, { message: "The palette scale has no such step" });
export type PaletteReference = z.infer<typeof PaletteReferenceSchema>;

// ─── Semantic colours ─────────────────────────────────────────────────────

/** `nord` is a dark theme (Nord's Polar Night surfaces): the web applies it as its own class, and the `dark:` variant covers it too. */
export const ThemeNameSchema = z.enum(["light", "dark", "nord"]);
export type ThemeName = z.infer<typeof ThemeNameSchema>;

/**
 * The dark themes only the phone has (the palettes page, ADR 079). They exist in mobile.css alone: the web's
 * theme menus read THEME_NAMES, so they never list them. Each builds on the shared dark theme.
 */
export const MobileOnlyThemeNameSchema = z.enum(["current-dark", "harbour", "mocha"]);
export type MobileOnlyThemeName = z.infer<typeof MobileOnlyThemeNameSchema>;

/** Every theme the phone offers: the shared ones, then its own. */
export const MobileThemeNameSchema = z.enum([...ThemeNameSchema.options, ...MobileOnlyThemeNameSchema.options]);
export type MobileThemeName = z.infer<typeof MobileThemeNameSchema>;

/** Every colour role that changes with the theme. Both themes are typed from this ONE list. */
export const ThemeRoleSchema = z.enum([
	"background",
	"foreground",
	"card",
	"card-foreground",
	"popover",
	"popover-foreground",
	"topbar",
	"shell-frame",
	"shell-panel",
	"sheet",
	"primary",
	"primary-foreground",
	"secondary",
	"secondary-foreground",
	"muted",
	"muted-foreground",
	"accent",
	"accent-foreground",
	"destructive",
	"success",
	"warning",
	"info",
	"focus",
	"destructive-soft",
	"success-soft",
	"warning-soft",
	"info-soft",
	"tone-green",
	"tone-green-soft",
	"tone-blue",
	"tone-blue-soft",
	"tone-yellow",
	"tone-yellow-soft",
	"tone-red",
	"tone-red-soft",
	"tone-orange",
	"tone-orange-soft",
	"tone-teal",
	"tone-teal-soft",
	"tone-violet",
	"tone-violet-soft",
	"tier-bronze",
	"tier-bronze-soft",
	"tier-silver",
	"tier-silver-soft",
	"tier-gold",
	"tier-gold-soft",
	"tier-platinum",
	"tier-platinum-soft",
	"reward",
	"reward-soft",
	"reward-solid",
	"reward-solid-foreground",
	"border",
	"input",
	"ring",
	"chart-1",
	"chart-2",
	"chart-3",
	"chart-4",
	"chart-5",
	"sidebar",
	"sidebar-foreground",
	"sidebar-primary",
	"sidebar-primary-foreground",
	"sidebar-accent",
	"sidebar-accent-foreground",
	"sidebar-border",
	"sidebar-ring",
	"sidebar-active",
	"sidebar-active-foreground",
	"sidebar-active-border",
	"search-mark-bg",
	"search-mark-fg",
	"shadow-ambient",
	"shadow-key",
	"edge-highlight",
	/* The auth screens' brand panel (its text, `auth-panel-foreground`, is shared). Themed so Nord can give it Polar Night. */
	"auth-panel",
	"auth-panel-muted",
	"auth-brand-from",
	"auth-brand-to",
	/* Link text (an inline link, a ghost button's label) — its own role so an app can fill buttons with one colour and colour links with another. */
	"link",
]);
export type ThemeRole = z.infer<typeof ThemeRoleSchema>;

/** Colour tokens declared once for every theme (they may still alias a themed role, e.g. `invert` → `foreground`). */
export const SharedColorNameSchema = z.enum([
	"auth-panel-foreground",
	"splash",
	"splash-foreground",
	"print-foreground",
	"print-border",
	"print-header-bg",
	"print-row-alt",
	"qr-background",
	"qr-foreground",
	"document-match",
	"document-match-active",
	"success-foreground",
	"warning-foreground",
	"info-foreground",
	"focus-foreground",
	"destructive-foreground",
	"invert",
	"invert-foreground",
	"status-foreground",
	"scrim",
	"scrim-foreground",
]);
export type SharedColorName = z.infer<typeof SharedColorNameSchema>;

export const ColorTokenNameSchema = z.union([ThemeRoleSchema, SharedColorNameSchema]);
export type ColorTokenName = z.infer<typeof ColorTokenNameSchema>;

/** A colour token aliasing another colour token — written `var(--<name>)`. */
export const ColorReferenceSchema = z.strictObject({
	kind: z.literal("token"),
	name: ColorTokenNameSchema,
});
export type ColorReference = z.infer<typeof ColorReferenceSchema>;

export const ColorValueSchema = z.discriminatedUnion("kind", [OklchColorSchema, HexColorSchema, ColorKeywordSchema, PaletteReferenceSchema, ColorReferenceSchema]);
export type ColorValue = z.infer<typeof ColorValueSchema>;

/** One theme: a value for EVERY themed role (exhaustive). */
export const ThemeSchema = z.record(ThemeRoleSchema, ColorValueSchema);
export type Theme = z.infer<typeof ThemeSchema>;

/** Every theme (exhaustive), each defining every role. */
export const ThemesSchema = z.record(ThemeNameSchema, ThemeSchema);
export type Themes = z.infer<typeof ThemesSchema>;

export const SharedColorsSchema = z.record(SharedColorNameSchema, ColorValueSchema);
export type SharedColors = z.infer<typeof SharedColorsSchema>;

// ─── Non-colour values ────────────────────────────────────────────────────

export const LengthUnitSchema = z.enum(["rem", "px"]);
export type LengthUnit = z.infer<typeof LengthUnitSchema>;

export const LengthSchema = z.strictObject({
	kind: z.literal("length"),
	value: z.number(),
	unit: LengthUnitSchema,
});
export type Length = z.infer<typeof LengthSchema>;

/** A stacking layer (`z-index`). */
export const StackLevelSchema = z.strictObject({
	kind: z.literal("stack-level"),
	value: z.number().int().nonnegative(),
});
export type StackLevel = z.infer<typeof StackLevelSchema>;

/** A `cubic-bezier()` easing curve; the x control points must stay within 0–1. */
export const CubicBezierSchema = z.strictObject({
	kind: z.literal("cubic-bezier"),
	x1: UnitIntervalSchema,
	y1: z.number(),
	x2: UnitIntervalSchema,
	y2: z.number(),
});
export type CubicBezier = z.infer<typeof CubicBezierSchema>;

/** Font-family variables each app's font loader defines at runtime (packages/ui/src/fonts). Tokens may alias them; they are never generated here. */
export const FontVariableSchema = z.enum(["font-sans", "font-heading"]);
export type FontVariable = z.infer<typeof FontVariableSchema>;

export const FontReferenceSchema = z.strictObject({
	kind: z.literal("font"),
	name: FontVariableSchema,
});
export type FontReference = z.infer<typeof FontReferenceSchema>;

// ─── Radius ───────────────────────────────────────────────────────────────

export const RadiusNameSchema = z.enum(["radius"]);
export type RadiusName = z.infer<typeof RadiusNameSchema>;

export const RadiusSchema = z.record(RadiusNameSchema, LengthSchema);
export type Radius = z.infer<typeof RadiusSchema>;

/** Tailwind's radius steps (`rounded-sm` … `rounded-4xl`). */
export const RadiusStepSchema = z.enum(["sm", "md", "lg", "xl", "2xl", "3xl", "4xl"]);
export type RadiusStep = z.infer<typeof RadiusStepSchema>;

/** Each radius step as a multiple of the base `--radius`. */
export const RadiusScaleSchema = z.record(RadiusStepSchema, z.number().positive());
export type RadiusScale = z.infer<typeof RadiusScaleSchema>;

// ─── Typography ───────────────────────────────────────────────────────────

export const FontRoleSchema = z.enum(["font-button", "font-sidebar"]);
export type FontRole = z.infer<typeof FontRoleSchema>;

export const TextSizeNameSchema = z.enum([
	"text-sidebar-caption",
	"text-sidebar-section",
	"text-badge-xs",
	"text-badge-sm",
	"text-kbd",
	"text-overline",
	"text-micro",
	"text-chip",
	"text-toast-countdown",
	"text-calendar-caption",
]);
export type TextSizeName = z.infer<typeof TextSizeNameSchema>;

export const TypographySchema = z.strictObject({
	fonts: z.record(FontRoleSchema, FontReferenceSchema),
	sizes: z.record(TextSizeNameSchema, LengthSchema),
});
export type Typography = z.infer<typeof TypographySchema>;

// ─── Layout (web chrome) ──────────────────────────────────────────────────

export const StackLevelNameSchema = z.enum(["z-overlay", "z-popover", "z-toast", "z-sidebar", "z-sidebar-rail", "z-sticky"]);
export type StackLevelName = z.infer<typeof StackLevelNameSchema>;

export const SizeNameSchema = z.enum([
	"sidebar-width",
	"sidebar-width-mobile",
	"sidebar-width-icon",
	"max-width-8xl",
	"max-width-9xl",
	"max-width-10xl",
	"panel-content-max-width",
	"input-group-kbd-nudge",
	"chart-indicator-dashed-width",
	"switch-height",
	"switch-width",
	"switch-height-sm",
	"switch-width-sm",
	"switch-thumb-size",
	"switch-thumb-size-sm",
	"switch-thumb-inset",
	"switch-thumb-travel",
	"switch-thumb-travel-sm",
]);
export type SizeName = z.infer<typeof SizeNameSchema>;

/** A size aliasing another size — written `var(--<name>)`. */
export const SizeReferenceSchema = z.strictObject({
	kind: z.literal("token"),
	name: SizeNameSchema,
});
export type SizeReference = z.infer<typeof SizeReferenceSchema>;

export const SizeValueSchema = z.discriminatedUnion("kind", [LengthSchema, SizeReferenceSchema]);
export type SizeValue = z.infer<typeof SizeValueSchema>;

export const LayoutSchema = z.strictObject({
	stackLevels: z.record(StackLevelNameSchema, StackLevelSchema),
	sizes: z.record(SizeNameSchema, SizeValueSchema),
});
export type Layout = z.infer<typeof LayoutSchema>;

// ─── Motion ───────────────────────────────────────────────────────────────

export const EasingNameSchema = z.enum(["ease-overlay-emphasized", "ease-drawer-backdrop", "ease-drawer-content", "ease-emphasized-enter", "ease-emphasized-exit"]);
export type EasingName = z.infer<typeof EasingNameSchema>;

export const MotionSchema = z.record(EasingNameSchema, CubicBezierSchema);
export type Motion = z.infer<typeof MotionSchema>;

// ─── Tailwind theme mapping (`@theme inline`) ─────────────────────────────

export const CssIdentifierSchema = z.string().regex(CSS_IDENTIFIER_PATTERN);

/** A Tailwind theme variable that exposes a layout or typography token as a utility (`--z-index-toast: var(--z-toast)`). */
export const TailwindAliasSchema = z.strictObject({
	name: CssIdentifierSchema,
	token: z.union([StackLevelNameSchema, SizeNameSchema, FontRoleSchema]),
});
export type TailwindAlias = z.infer<typeof TailwindAliasSchema>;

/** One `box-shadow` layer; offsets, blur and spread are in px, the colour is a colour token. */
export const ShadowLayerSchema = z.strictObject({
	isInset: z.boolean(),
	offsetX: z.number(),
	offsetY: z.number(),
	blur: z.number().nonnegative(),
	spread: z.number(),
	color: ColorReferenceSchema,
});
export type ShadowLayer = z.infer<typeof ShadowLayerSchema>;

export const ShadowSchema = z.strictObject({
	name: CssIdentifierSchema,
	layers: z.array(ShadowLayerSchema).min(1).readonly(),
});
export type Shadow = z.infer<typeof ShadowSchema>;

export const TailwindThemeSchema = z.strictObject({
	/** Layout and typography tokens exposed as utilities. */
	aliases: z.array(TailwindAliasSchema).readonly(),
	/** Colour tokens exposed as `--color-<name>` (`bg-card`, `text-muted-foreground`, …). */
	colors: z.array(ColorTokenNameSchema).readonly(),
	/** The `shadow-*` / `inset-shadow-*` scale. */
	shadows: z.array(ShadowSchema).readonly(),
	/** The `rounded-*` scale, as multiples of `--radius`. */
	radiusScale: RadiusScaleSchema,
	/** Font families exposed as `font-<name>` utilities. */
	fonts: z.array(FontVariableSchema).readonly(),
});
export type TailwindTheme = z.infer<typeof TailwindThemeSchema>;

// ─── The whole source ─────────────────────────────────────────────────────

/**
 * The roles an app may re-map to carry its own brand — the same list as packages/ui `APP_BRAND_TOKENS`
 * (actions, focus, the active nav item, the sidebar, charts, the search highlight, the auth panel).
 * Page and card surfaces, borders and text are shared by every app and never re-mapped.
 */
export const AppBrandRoleSchema = z.enum([
	"primary",
	"primary-foreground",
	"ring",
	"sidebar",
	"sidebar-accent",
	"sidebar-border",
	"sidebar-primary",
	"sidebar-primary-foreground",
	"sidebar-ring",
	"sidebar-active",
	"sidebar-active-foreground",
	"sidebar-active-border",
	"search-mark-bg",
	"search-mark-fg",
	"chart-1",
	"chart-2",
	"chart-3",
	"chart-4",
	"chart-5",
	"auth-panel",
	"auth-panel-muted",
	"auth-brand-from",
	"auth-brand-to",
	"link",
]);
export type AppBrandRole = z.infer<typeof AppBrandRoleSchema>;

/** Per theme, an app's re-maps of its brand roles (any theme, any subset of the roles). */
export const AppThemeOverridesSchema = z.partialRecord(ThemeNameSchema, z.partialRecord(AppBrandRoleSchema, ColorValueSchema));
export type AppThemeOverrides = z.infer<typeof AppThemeOverridesSchema>;

/**
 * The Expo app's own visual system (ADR 079): unlike a web app, which re-maps only its brand roles, the
 * mobile app is a separate design language and may re-map ANY themed role — surfaces, borders and text
 * included — per theme. Applied to mobile.css only; the web apps never see these values.
 */
export const MobileThemeOverridesSchema = z.partialRecord(MobileThemeNameSchema, z.partialRecord(ThemeRoleSchema, ColorValueSchema));
export type MobileThemeOverrides = z.infer<typeof MobileThemeOverridesSchema>;

/**
 * The admin panel's own re-maps of any themed role, per theme: since 2026-11-05 its dark theme is the phone's graphite
 * (GRAPHITE_DARK_THEME), surfaces and text included, not only its brand roles. Written into web.css under
 * `.admin-app`, so the web app and the merchant portal keep the shared themes.
 */
export const AdminThemeOverridesSchema = z.partialRecord(ThemeNameSchema, z.partialRecord(ThemeRoleSchema, ColorValueSchema));
export type AdminThemeOverrides = z.infer<typeof AdminThemeOverridesSchema>;

/**
 * Colours that belong to one mobile component and to no theme role, so a change to the shared roles
 * can never move them (ADR 079): the floating tab bar's pill, edge, selected capsule, the capsule's icon
 * and label and the unselected icons; and the chip an original (full-colour) brand logo sits on.
 */
export const MobileComponentColorNameSchema = z.enum([
	"tab-bar",
	"tab-bar-border",
	"tab-bar-active",
	"tab-bar-active-foreground",
	"tab-bar-icon",
	"control-ring",
	"logo-tile",
]);
export type MobileComponentColorName = z.infer<typeof MobileComponentColorNameSchema>;

/** Every component colour, in every theme (no partial theme: each theme must say what its tab bar is). */
export const MobileComponentColorsSchema = z.record(MobileThemeNameSchema, z.record(MobileComponentColorNameSchema, ColorValueSchema));
export type MobileComponentColors = z.infer<typeof MobileComponentColorsSchema>;

export const TokenSourceSchema = z.strictObject({
	palette: PaletteSchema,
	themes: ThemesSchema,
	sharedColors: SharedColorsSchema,
	radius: RadiusSchema,
	typography: TypographySchema,
	layout: LayoutSchema,
	motion: MotionSchema,
	tailwindTheme: TailwindThemeSchema,
	/** The Expo app's own re-maps of any themed role, applied to mobile.css only (the web apps keep theirs in `app/<name>-theme.css`). */
	mobileThemeOverrides: MobileThemeOverridesSchema,
	/** The Expo app's component colours (the floating tab bar), mobile.css only. */
	mobileComponentColors: MobileComponentColorsSchema,
	/** The admin panel's re-maps of any themed role, web.css under `.admin-app` only. */
	adminThemeOverrides: AdminThemeOverridesSchema,
});
export type TokenSource = z.infer<typeof TokenSourceSchema>;

// ─── Generator output ─────────────────────────────────────────────────────

/** The files the generator writes into `generated/`. */
export const GeneratedFileNameSchema = z.enum([
	"palette.css",
	"web.css",
	"mobile.css",
	"favicon.svg",
	"favicon.ico",
	"apple-touch-icon.png",
	"favicon-blue.svg",
	"favicon-blue.ico",
	"apple-touch-icon-blue.png",
	"favicon-green.svg",
	"favicon-green.ico",
	"apple-touch-icon-green.png",
	"app-icon.png",
	"splash-icon.png",
	"launch-colors.json",
]);
export type GeneratedFileName = z.infer<typeof GeneratedFileNameSchema>;
