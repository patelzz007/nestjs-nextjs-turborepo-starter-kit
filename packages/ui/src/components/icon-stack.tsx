// Ported from ReUI (https://reui.io/r/base-vega/icon-stack.json): a layered
// isometric illustration with an icon (its children) printed on the front
// layer — for empty states and feature callouts. `IconStack`, its props and
// `data-slot` attributes match ReUI, with these deliberate deviations:
// - The root forwards its ref.
// - The layer offsets live in one table instead of inline literals, and the
//   shadow blur uses the `blur-xs` token instead of an arbitrary `blur-[4px]`.
// - The content position custom properties are typed, so no style cast.
// Decorative: the svg is hidden from assistive technology; the caller's
// surrounding copy carries the meaning.
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

/** The two custom properties that place the content on the front layer — overridable through `style`. */
type IconStackStyle = React.CSSProperties & Readonly<Record<"--icon-stack-content-x" | "--icon-stack-content-y", string>>;

const ICON_STACK_DEFAULT_STYLE: IconStackStyle = {
	"--icon-stack-content-x": "71%",
	"--icon-stack-content-y": "58%",
};

interface IconStackLayerSpec {
	/** Opacity of the layer, back to front. */
	readonly opacity: string;
	/** Offset from the back layer, in viewBox units. */
	readonly x: number;
	readonly y: number;
	/** The front layer draws a slightly stronger edge. */
	readonly active: boolean;
}

/** Back to front: each layer steps up and to the right along the isometric axis. */
const ICON_STACK_LAYERS: readonly IconStackLayerSpec[] = [
	{ opacity: "0.4", x: 0, y: 0, active: false },
	{ opacity: "0.6", x: 13.65, y: 6.04, active: false },
	{ opacity: "0.8", x: 27.32, y: 12.08, active: true },
];

const LAYER_EDGE_PATH =
	"M42.2538 2.046C41.4408 1.6325 40.3965 1.6677 39.2612 2.2424L7.9616 18.1934C5.3895 19.5039 3.301 23.1064 3.301 26.2322V64.3226C3.301 66.0677 3.9458 67.2943 4.962 67.8199L1.8363 66.229C0.8201 65.7104 0.1753 64.4771 0.1753 62.732V24.6412C0.1753 21.5085 2.2638 17.913 4.8359 16.6024L36.1355 0.6515C37.2778 0.0698 38.322 0.0416 39.128 0.4551L42.2538 2.046Z";
const LAYER_FACE_PATH =
	"M42.2545 2.0456C43.2707 2.5643 43.9155 3.7979 43.9155 5.543V43.6337C43.9155 46.7665 41.827 50.3616 39.2549 51.6722L7.9554 67.6235C6.813 68.2052 5.7687 68.2331 4.9628 67.8196C3.9465 67.301 3.3018 66.0673 3.3018 64.3222V26.2318C3.3018 23.0991 5.3903 19.5036 7.9624 18.193L39.2619 2.2421C40.4043 1.6604 41.4486 1.6321 42.2545 2.0456Z";

function IconStackLayer({ opacity, x, y, active }: IconStackLayerSpec): React.JSX.Element {
	const strokeOpacity = active ? "0.3" : "0.2";
	return (
		<g opacity={opacity} transform={`translate(${String(x)} ${String(y)})`}>
			<path
				data-slot="icon-stack-layer"
				d={LAYER_EDGE_PATH}
				stroke="currentColor"
				strokeOpacity={strokeOpacity}
				strokeWidth="0.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				data-slot="icon-stack-layer"
				d={LAYER_FACE_PATH}
				stroke="currentColor"
				strokeOpacity={strokeOpacity}
				strokeWidth="0.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</g>
	);
}

type IconStackProps = React.ComponentProps<"div">;

const IconStack = React.forwardRef<HTMLDivElement, IconStackProps>(function IconStack({ className, children, style, ...props }, ref): React.JSX.Element {
	const mergedStyle = React.useMemo((): IconStackStyle => ({ ...ICON_STACK_DEFAULT_STYLE, ...style }), [style]);
	return (
		<div
			ref={ref}
			data-slot="icon-stack"
			className={cn("relative h-20 w-18 text-foreground **:data-[slot=icon-stack-layer]:fill-background", className)}
			style={mergedStyle}
			{...props}>
			<svg aria-hidden="true" viewBox="0 0 72 81" fill="none" className="h-full w-full overflow-visible">
				<ellipse cx="36" cy="76" rx="30" ry="7" fill="currentColor" fillOpacity="0.055" className="blur-xs" />
				{ICON_STACK_LAYERS.map((layer): React.JSX.Element => (
					<IconStackLayer key={layer.opacity} {...layer} />
				))}
			</svg>
			{children === undefined || children === null ? null : (
				<div
					data-slot="icon-stack-content"
					className="pointer-events-none absolute top-(--icon-stack-content-y) left-(--icon-stack-content-x) flex -translate-x-1/2 -translate-y-1/2 scale-x-90 -skew-y-26 items-center justify-center text-muted-foreground">
					{children}
				</div>
			)}
		</div>
	);
});

export { IconStack, type IconStackProps };
