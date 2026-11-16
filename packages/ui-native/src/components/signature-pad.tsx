// A surface for a handwritten signature (the web kit's `SignaturePad`): a
// finger or a stylus draws strokes, kept as points scaled to the pad (0–1),
// so a signature draws the same at any size and exports cleanly. Controlled:
// `strokes` in, `onChange(next)` out when a stroke ends. The ink is a theme
// token (`inkClassName`, an `accent-*` utility) at `strokeWidth`; a pad that
// is `disabled` (or `readOnly`, a signed record) takes no ink.
//
// `useSignatureHistory` keeps the strokes with undo, redo and clear for a
// toolbar; `signatureToSvg` writes them as an SVG document to save or
// upload, and `isSignatureEmpty` says whether anything was drawn. The pad
// says what it holds to screen readers ("Signature, 3 strokes"); signing
// itself needs a hand, so a form should offer another way (typing a name).

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { type GestureResponderEvent, type LayoutChangeEvent, Text, View, type ViewInstance } from "react-native";
import Svg, { Path } from "react-native-svg";
import { withUniwind } from "uniwind";

import { cn } from "../lib/cn";

export const signaturePadVariants = cva("w-full overflow-hidden border border-dashed", {
	variants: {
		size: { sm: "h-24 rounded-lg", md: "rounded-card h-40", lg: "rounded-card h-56" },
		state: { default: "border-input bg-card", disabled: "border-input bg-muted opacity-60", error: "border-destructive bg-card" },
	},
	defaultVariants: { size: "md", state: "default" },
});

export type SignaturePadSize = NonNullable<VariantProps<typeof signaturePadVariants>["size"]>;

/** A point of a stroke, as a fraction of the pad's width and height. */
export interface SignaturePoint {
	readonly x: number;
	readonly y: number;
}

/** One stroke: the points a finger passed through, in order. */
export type SignatureStroke = readonly SignaturePoint[];

const DEFAULT_STROKE_WIDTH = 2.5;
const DECIMALS = 4;

/** Whether nothing has been drawn. */
export function isSignatureEmpty(strokes: readonly SignatureStroke[]): boolean {
	return strokes.every((stroke: SignatureStroke): boolean => stroke.length === 0);
}

function round(value: number): number {
	return Number(value.toFixed(DECIMALS));
}

/** One stroke as an SVG path on a `width` × `height` box: a dot for a single point, else a line through every point. */
export function strokePath(stroke: SignatureStroke, width: number, height: number): string {
	const [first, ...rest] = stroke;
	if (first === undefined) {
		return "";
	}
	const start = `M${String(round(first.x * width))} ${String(round(first.y * height))}`;
	if (rest.length === 0) {
		return `${start} l0.01 0`;
	}
	return `${start} ${rest.map((point: SignaturePoint): string => `L${String(round(point.x * width))} ${String(round(point.y * height))}`).join(" ")}`;
}

/** What `signatureToSvg` draws with. */
export interface SignatureSvgOptions {
	readonly width: number;
	readonly height: number;
	/** The ink, as any SVG colour ("#111827"). */
	readonly color: string;
	readonly strokeWidth?: number | undefined;
}

/** The strokes as a standalone SVG document. */
export function signatureToSvg(strokes: readonly SignatureStroke[], { width, height, color, strokeWidth = DEFAULT_STROKE_WIDTH }: SignatureSvgOptions): string {
	const paths = strokes
		.filter((stroke: SignatureStroke): boolean => stroke.length > 0)
		.map((stroke: SignatureStroke): string => `<path d="${strokePath(stroke, width, height)}"/>`)
		.join("");
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}" viewBox="0 0 ${String(width)} ${String(height)}"><g fill="none" stroke="${color}" stroke-width="${String(strokeWidth)}" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
}

/** The strokes with their history: what a toolbar's undo, redo and clear act on. */
export interface SignatureHistory {
	readonly strokes: readonly SignatureStroke[];
	/** The pad's `onChange`: a new state, which forgets anything undone. */
	readonly onChange: (strokes: readonly SignatureStroke[]) => void;
	readonly undo: () => void;
	readonly redo: () => void;
	readonly clear: () => void;
	readonly canUndo: boolean;
	readonly canRedo: boolean;
}

interface HistoryState {
	readonly past: readonly (readonly SignatureStroke[])[];
	readonly present: readonly SignatureStroke[];
	readonly future: readonly (readonly SignatureStroke[])[];
}

/** Keeps a pad's strokes with undo and redo (clearing can be undone too). */
export function useSignatureHistory(initial: readonly SignatureStroke[] = []): SignatureHistory {
	const [history, setHistory] = React.useState<HistoryState>({ past: [], present: initial, future: [] });
	const onChange = React.useCallback((strokes: readonly SignatureStroke[]): void => {
		setHistory((current: HistoryState): HistoryState => ({ past: [...current.past, current.present], present: strokes, future: [] }));
	}, []);
	const undo = React.useCallback((): void => {
		setHistory((current: HistoryState): HistoryState => {
			const previous = current.past.at(-1);
			return previous === undefined ? current : { past: current.past.slice(0, -1), present: previous, future: [current.present, ...current.future] };
		});
	}, []);
	const redo = React.useCallback((): void => {
		setHistory((current: HistoryState): HistoryState => {
			const [next, ...rest] = current.future;
			return next === undefined ? current : { past: [...current.past, current.present], present: next, future: rest };
		});
	}, []);
	const clear = React.useCallback((): void => {
		setHistory((current: HistoryState): HistoryState => (isSignatureEmpty(current.present) ? current : { past: [...current.past, current.present], present: [], future: [] }));
	}, []);
	return { strokes: history.present, onChange, undo, redo, clear, canUndo: history.past.length > 0, canRedo: history.future.length > 0 };
}

interface InkProps {
	readonly strokes: readonly SignatureStroke[];
	readonly width: number;
	readonly height: number;
	readonly strokeWidth: number;
	/** Filled in by Uniwind from `colorClassName`. */
	readonly color?: string | undefined;
}

function Ink({ strokes, width, height, strokeWidth, color }: InkProps): React.JSX.Element {
	return (
		<Svg width={width} height={height}>
			{strokes.map((stroke: SignatureStroke, index: number): React.JSX.Element => (
				<Path
					key={`stroke-${String(index)}`}
					d={strokePath(stroke, width, height)}
					fill="none"
					{...(color === undefined ? {} : { stroke: color })}
					strokeWidth={strokeWidth}
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			))}
		</Svg>
	);
}

/** Maps `colorClassName` (an `accent-*` token utility) onto the ink's colour. */
const ThemedInk = withUniwind(Ink);

/** The pad's default copy; generic and overridable. */
export interface SignaturePadLabels {
	readonly placeholder: string;
	/** What screen readers hear, given the number of strokes. */
	readonly description: (strokeCount: number) => string;
}

export const DEFAULT_SIGNATURE_PAD_LABELS: SignaturePadLabels = {
	placeholder: "Sign here",
	description: (strokeCount: number): string => (strokeCount === 0 ? "Signature, empty" : `Signature, ${String(strokeCount)} ${strokeCount === 1 ? "stroke" : "strokes"}`),
};

export interface SignaturePadProps {
	readonly strokes: readonly SignatureStroke[];
	readonly onChange: (strokes: readonly SignatureStroke[]) => void;
	/** The ink's colour, an `accent-*` token utility. Default `accent-foreground`. */
	readonly inkClassName?: string | undefined;
	readonly strokeWidth?: number | undefined;
	readonly size?: SignaturePadSize | undefined;
	readonly disabled?: boolean | undefined;
	/** Shows the signature but takes no ink (a signed record). */
	readonly readOnly?: boolean | undefined;
	readonly invalid?: boolean | undefined;
	/** A stroke has started or ended (to stop a screen from scrolling while signing). */
	readonly onDrawingChange?: ((drawing: boolean) => void) | undefined;
	readonly labels?: Partial<SignaturePadLabels> | undefined;
	/** Extra classes for the pad, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const SignaturePad = React.memo(
	React.forwardRef<ViewInstance, SignaturePadProps>(function SignaturePad(
		{
			strokes,
			onChange,
			inkClassName = "accent-foreground",
			strokeWidth = DEFAULT_STROKE_WIDTH,
			size = "md",
			disabled = false,
			readOnly = false,
			invalid = false,
			onDrawingChange,
			labels,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const names = React.useMemo((): SignaturePadLabels => ({ ...DEFAULT_SIGNATURE_PAD_LABELS, ...labels }), [labels]);
		const [box, setBox] = React.useState<{ readonly width: number; readonly height: number }>({ width: 0, height: 0 });
		const [current, setCurrent] = React.useState<SignatureStroke | null>(null);
		const inks = !disabled && !readOnly;
		const onLayout = React.useCallback((event: LayoutChangeEvent): void => {
			setBox({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height });
		}, []);
		const pointOf = React.useCallback(
			(event: GestureResponderEvent): SignaturePoint => ({
				x: Math.min(1, Math.max(0, event.nativeEvent.locationX / Math.max(1, box.width))),
				y: Math.min(1, Math.max(0, event.nativeEvent.locationY / Math.max(1, box.height))),
			}),
			[box],
		);
		const canDraw = React.useCallback((): boolean => inks, [inks]);
		const keep = React.useCallback((): boolean => false, []);
		const start = React.useCallback(
			(event: GestureResponderEvent): void => {
				if (!inks) {
					return;
				}
				setCurrent([pointOf(event)]);
				onDrawingChange?.(true);
			},
			[inks, onDrawingChange, pointOf],
		);
		const move = React.useCallback(
			(event: GestureResponderEvent): void => {
				const point = pointOf(event);
				setCurrent((stroke: SignatureStroke | null): SignatureStroke | null => (stroke === null ? null : [...stroke, point]));
			},
			[pointOf],
		);
		const end = React.useCallback((): void => {
			if (current === null) {
				return;
			}
			onChange([...strokes, current]);
			setCurrent(null);
			onDrawingChange?.(false);
		}, [current, onChange, onDrawingChange, strokes]);
		const shown = current === null ? strokes : [...strokes, current];
		return (
			<View
				ref={ref}
				testID={testID}
				accessible
				accessibilityRole="image"
				accessibilityLabel={names.description(strokes.length)}
				onLayout={onLayout}
				onStartShouldSetResponder={canDraw}
				onMoveShouldSetResponder={canDraw}
				onResponderTerminationRequest={keep}
				onResponderGrant={start}
				onResponderMove={move}
				onResponderRelease={end}
				onResponderTerminate={end}
				className={cn(signaturePadVariants({ size, state: disabled ? "disabled" : invalid ? "error" : "default" }), className)}>
				{isSignatureEmpty(shown) ? (
					<View pointerEvents="none" className="absolute inset-0 items-center justify-center">
						<Text className="text-body font-sans text-muted-foreground">{names.placeholder}</Text>
					</View>
				) : null}
				{box.width > 0 ? <ThemedInk strokes={shown} width={box.width} height={box.height} strokeWidth={strokeWidth} colorClassName={inkClassName} /> : null}
			</View>
		);
	}),
);
