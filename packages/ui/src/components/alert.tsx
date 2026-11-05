// Ported from ReUI (https://reui.io/r/base-vega/alert.json). Parts, variants
// and `data-slot` attributes match ReUI, so its docs and examples apply, with
// these deliberate deviations:
// - Every part forwards its ref.
// - A `size` variant (`sm` | `default`) for compact banners.
// - `role` defaults to `alert` but is a normal prop: pass `status` for a polite,
//   non-interrupting message, or `none` when an ancestor is the live region.
// - The look is NOT ReUI's (restyle approved by the product owner, 2026-11):
//   ReUI tints the whole card with the status colour, which made every app
//   alert a faint coloured box with no icon (no app passes one) and gave four
//   variants that read alike. The "Tile" design keeps the card neutral
//   (`bg-card`, `border-border`, 12px radius) and puts the ONLY colour in a
//   32px icon tile, so the status reads at a glance and text contrast stays
//   the card's own. `invert` keeps the inverted surface.
// - Each variant has a default icon (info / success / warning / destructive,
//   `Info` for `default` and `invert`). A caller's leading element — its own
//   `<svg>` icon or other media such as an `Avatar` — replaces it. Detection is
//   done in React (`hasLeadingMedia` below), not with CSS `:has()`, so the
//   default icon is never rendered at all rather than rendered and hidden; it
//   relies on the parts being direct children, which the grid layout already
//   requires.
// - A description without a title is the message, so it uses the foreground
//   colour instead of the muted one, and it takes the title's top offset.
//
// Tile colour math: `--alert-tone` is the variant's semantic token, and the
// tile ("ink") is that tone mixed 62% with the surface's text colour, so it is
// dark enough for the glyph (the surface colour) to clear 3:1 in the light,
// dark and Nord themes. The mix MUST be `in oklab`: in oklch the hue is
// interpolated too, which turns amber maroon (light) or green (dark).
//
// Stateless by design: showing, hiding and dismissing an alert is the parent's
// job (render it conditionally; put a dismiss `Button` in `AlertAction`).
import { cn } from "@workspace/ui/lib/core/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { CircleCheck, Info, OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import * as React from "react";

// Neutral card shared by every variant except `invert`. `--alert-contrast` is the
// colour the tone is mixed toward, `--alert-glyph` the icon colour on the tile;
// both are the surface's own text/background so the tile follows the theme.
const NEUTRAL_SURFACE = "border-border bg-card text-card-foreground [--alert-contrast:var(--foreground)] [--alert-glyph:var(--card)]";

const alertVariants = cva(
	[
		"relative grid w-full grid-cols-[var(--alert-tile)_minmax(0,1fr)] items-start gap-x-3 gap-y-0.5 rounded-xl border",
		// Ink = 62% tone in oklab toward the surface text colour (see header).
		"[--alert-ink:color-mix(in_oklab,var(--alert-tone)_62%,var(--alert-contrast))]",
		// The icon tile: the caller's `<svg>` or the default icon, both direct children. The glyph
		// size is fixed per `size`; the padding centres it in the tile.
		"[&>svg]:size-(--alert-tile) [&>svg]:shrink-0 [&>svg]:rounded-(--alert-tile-radius) [&>svg]:bg-(color:--alert-ink) [&>svg]:stroke-2 [&>svg]:p-[calc((var(--alert-tile)_-_var(--alert-glyph-size))_/_2)] [&>svg]:text-(color:--alert-glyph)",
		"has-[>[data-slot=alert-title]+[data-slot=alert-description]]:[&_[data-slot=alert-action]]:sm:row-end-3",
	],
	{
		variants: {
			variant: {
				default: cn(NEUTRAL_SURFACE, "[--alert-tone:var(--muted-foreground)]"),
				destructive: cn(NEUTRAL_SURFACE, "[--alert-tone:var(--destructive)]"),
				info: cn(NEUTRAL_SURFACE, "[--alert-tone:var(--info)]"),
				success: cn(NEUTRAL_SURFACE, "[--alert-tone:var(--success)]"),
				warning: cn(NEUTRAL_SURFACE, "[--alert-tone:var(--warning)]"),
				// The ink is mixed toward the inverted text colour and the glyph takes the inverted
				// surface, so the tile stays visible on the dark (light-theme) / light (dark-theme) card.
				invert:
					"border-invert bg-invert text-invert-foreground [--alert-contrast:var(--invert-foreground)] [--alert-glyph:var(--invert)] [--alert-tone:var(--muted-foreground)]",
			},
			// `--alert-body-offset` drops a one-line title (or a title-less description) onto the
			// tile's centre line: (tile height - line height) / 2, rounded to the measured mock.
			size: {
				sm: "px-3 py-2 text-xs [--alert-body-offset:--spacing(1)] [--alert-glyph-size:15px] [--alert-tile-radius:8px] [--alert-tile:--spacing(7)]",
				default: "px-3.5 py-3 text-sm [--alert-body-offset:5px] [--alert-glyph-size:17px] [--alert-tile-radius:9px] [--alert-tile:--spacing(8)]",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

type AlertVariant = NonNullable<VariantProps<typeof alertVariants>["variant"]>;

interface AlertProps extends React.ComponentProps<"div">, VariantProps<typeof alertVariants> {}

const DEFAULT_ICONS: Record<AlertVariant, LucideIcon> = {
	default: Info,
	destructive: OctagonAlert,
	info: Info,
	success: CircleCheck,
	warning: TriangleAlert,
	invert: Info,
};

interface AlertContextValue {
	readonly variant: AlertVariant;
	readonly hasTitle: boolean;
}

// Outside an `Alert` the parts render as if titled on the default surface.
const AlertContext = React.createContext<AlertContextValue>({ variant: "default", hasTitle: true });

const AlertTitle = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function AlertTitle({ className, ...props }, ref): React.JSX.Element {
	const { variant } = React.useContext(AlertContext);
	return (
		<div
			ref={ref}
			data-slot="alert-title"
			className={cn(
				"col-start-2 min-w-0 pt-(--alert-body-offset) font-semibold tracking-tight break-words",
				variant === "invert" ? "text-invert-foreground" : "text-foreground",
				className,
			)}
			{...props}
		/>
	);
});

function descriptionColor({ variant, hasTitle }: AlertContextValue): string {
	if (variant === "invert") {
		return hasTitle ? "text-invert-foreground/70" : "text-invert-foreground";
	}
	return hasTitle ? "text-muted-foreground" : "text-foreground";
}

const AlertDescription = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function AlertDescription({ className, ...props }, ref): React.JSX.Element {
	const context = React.useContext(AlertContext);
	return (
		<div
			ref={ref}
			data-slot="alert-description"
			className={cn(
				// Wide content (a code block, a long URL) scrolls or wraps inside the card instead of widening it: the
				// description may shrink below its widest child (`min-w-0`), and so may its own column — an implicit
				// `auto` track never shrinks below its widest child's minimum width, `minmax(0, 1fr)` does.
				"col-start-2 grid min-w-0 grid-cols-[minmax(0,1fr)] justify-items-start gap-1 leading-relaxed [&_p]:leading-relaxed",
				context.hasTitle ? undefined : "pt-(--alert-body-offset)",
				descriptionColor(context),
				className,
			)}
			{...props}
		/>
	);
});

const AlertAction = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function AlertAction({ className, ...props }, ref): React.JSX.Element {
	return (
		<div
			ref={ref}
			data-slot="alert-action"
			className={cn("flex gap-1.5 max-sm:col-start-2 max-sm:mt-2 max-sm:justify-start sm:col-start-3 sm:row-start-1 sm:justify-end sm:self-center", className)}
			{...props}
		/>
	);
});

function isAlertTextPart(type: React.ReactElement["type"]): boolean {
	return type === AlertTitle || type === AlertDescription || type === AlertAction;
}

// Any direct element child that is not a text part is the caller's leading media (an icon or an avatar).
function hasLeadingMedia(children: React.ReactNode): boolean {
	return React.Children.toArray(children).some((child) => React.isValidElement(child) && !isAlertTextPart(child.type));
}

function hasTitlePart(children: React.ReactNode): boolean {
	return React.Children.toArray(children).some((child) => React.isValidElement(child) && child.type === AlertTitle);
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert({ className, variant, size, role = "alert", children, ...props }, ref): React.JSX.Element {
	const resolvedVariant = variant ?? "default";
	const hasTitle = hasTitlePart(children);
	const context = React.useMemo((): AlertContextValue => ({ variant: resolvedVariant, hasTitle }), [resolvedVariant, hasTitle]);
	const DefaultIcon = DEFAULT_ICONS[resolvedVariant];
	return (
		<AlertContext.Provider value={context}>
			<div ref={ref} data-slot="alert" data-variant={resolvedVariant} role={role} className={cn(alertVariants({ variant, size }), className)} {...props}>
				{hasLeadingMedia(children) ? null : <DefaultIcon aria-hidden="true" data-slot="alert-icon" />}
				{children}
			</div>
		</AlertContext.Provider>
	);
});

export { Alert, AlertTitle, AlertDescription, AlertAction, alertVariants, type AlertProps, type AlertVariant };
