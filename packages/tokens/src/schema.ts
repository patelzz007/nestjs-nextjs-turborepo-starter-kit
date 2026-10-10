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

/** The step names each palette scale defines, in scale order. */
export const PALETTE_STEP_SCHEMAS = {
	neutral: NeutralStepSchema,
	ink: InkStepSchema,
	brand: AccentStepSchema,
	warm: WarmStepSchema,
	blue: AccentStepSchema,
	green: AccentStepSchema,
};

export const PaletteSchema = z.strictObject({
	neutral: z.record(PALETTE_STEP_SCHEMAS.neutral, PrimitiveColorSchema),
	ink: z.record(PALETTE_STEP_SCHEMAS.ink, PrimitiveColorSchema),
	brand: z.record(PALETTE_STEP_SCHEMAS.brand, PrimitiveColorSchema),
	warm: z.record(PALETTE_STEP_SCHEMAS.warm, PrimitiveColorSchema),
	blue: z.record(PALETTE_STEP_SCHEMAS.blue, PrimitiveColorSchema),
	green: z.record(PALETTE_STEP_SCHEMAS.green, PrimitiveColorSchema),
});
export type Palette = z.infer<typeof PaletteSchema>;

/** The palette scales, in the order they are written out. */
export const PaletteScaleSchema = PaletteSchema.keyof();
export type PaletteScale = z.infer<typeof PaletteScaleSchema>;

/** Every step name any scale defines. */
export const PaletteStepNameSchema = z.union([NeutralStepSchema, InkStepSchema, AccentStepSchema, WarmStepSchema]);
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

export const ThemeNameSchema = z.enum(["light", "dark"]);
export type ThemeName = z.infer<typeof ThemeNameSchema>;

/** Every colour role that changes with the theme. Both themes are typed from this ONE list. */
export const ThemeRoleSchema = z.enum([
	"background",
	"foreground",
	"card",
	"card-foreground",
	"popover",
	"popover-foreground",
	"topbar",
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
]);
export type ThemeRole = z.infer<typeof ThemeRoleSchema>;

/** Colour tokens declared once for every theme (they may still alias a themed role, e.g. `invert` → `foreground`). */
export const SharedColorNameSchema = z.enum([
	"auth-panel",
	"auth-panel-muted",
	"auth-panel-foreground",
	"auth-brand-from",
	"auth-brand-to",
	"splash",
	"splash-foreground",
	"print-foreground",
	"print-border",
	"print-header-bg",
	"print-row-alt",
	"qr-background",
	"qr-foreground",
	"success-foreground",
	"warning-foreground",
	"info-foreground",
	"destructive-foreground",
	"invert",
	"invert-foreground",
	"status-foreground",
	"scrim",
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

export const TokenSourceSchema = z.strictObject({
	palette: PaletteSchema,
	themes: ThemesSchema,
	sharedColors: SharedColorsSchema,
	radius: RadiusSchema,
	typography: TypographySchema,
	layout: LayoutSchema,
	motion: MotionSchema,
	tailwindTheme: TailwindThemeSchema,
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
