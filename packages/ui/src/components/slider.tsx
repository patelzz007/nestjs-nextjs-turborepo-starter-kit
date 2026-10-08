import { isArrayValue } from "@workspace/shared";
import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { resolveFieldState } from "@workspace/ui/lib/form/field-state";
import { sliderVariants } from "@workspace/ui/lib/form/field-variants";
import { cn } from "@workspace/ui/lib/core/utils";
import type { VariantProps } from "class-variance-authority";
import * as React from "react";

/** Default bounds of the track. */
const DEFAULT_MIN = 0;
const DEFAULT_MAX = 100;
/** With no value at all the slider renders a range (two thumbs); a scalar value renders one. */
const RANGE_THUMB_COUNT = 2;
const SINGLE_THUMB_COUNT = 1;

/** One thumb per value: arrays render `length` thumbs, a scalar renders one, nothing renders a range. */
function resolveThumbCount(value: SliderPrimitive.Root.Props["value"], defaultValue: SliderPrimitive.Root.Props["defaultValue"]): number {
	const source = value ?? defaultValue;
	if (isArrayValue(source)) {
		return source.length;
	}
	return source === undefined ? RANGE_THUMB_COUNT : SINGLE_THUMB_COUNT;
}

type SliderProps = SliderPrimitive.Root.Props &
	VariantProps<typeof sliderVariants> & {
		readonly loading?: boolean;
	};

const Slider = React.forwardRef<HTMLDivElement, SliderProps>(function Slider(
	{ className, defaultValue, value, min = DEFAULT_MIN, max = DEFAULT_MAX, variant, size, loading = false, disabled, "aria-invalid": ariaInvalid, ...props },
	ref,
): React.JSX.Element {
	const thumbCount = resolveThumbCount(value, defaultValue);
	const state = resolveFieldState({ disabled, loading, ariaInvalid });

	return (
		<SliderPrimitive.Root
			ref={ref}
			className={cn(sliderVariants({ variant, size, state }), className)}
			data-slot="slider"
			defaultValue={defaultValue}
			value={value}
			min={min}
			max={max}
			disabled={disabled}
			aria-invalid={ariaInvalid}
			data-loading={loading ? "" : undefined}
			thumbAlignment="edge"
			{...props}>
			<SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col">
				<SliderPrimitive.Track
					data-slot="slider-track"
					className="relative grow overflow-hidden rounded-full bg-muted select-none data-horizontal:h-1.5 data-horizontal:w-full data-vertical:h-full data-vertical:w-1.5">
					<SliderPrimitive.Indicator data-slot="slider-range" className="bg-primary select-none data-horizontal:h-full data-vertical:w-full" />
				</SliderPrimitive.Track>
				{Array.from({ length: thumbCount }, (_, index) => (
					<SliderPrimitive.Thumb
						data-slot="slider-thumb"
						key={index}
						className="block size-4 shrink-0 rounded-full border border-primary bg-background shadow-sm ring-ring/50 transition-[color,box-shadow] select-none hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
					/>
				))}
			</SliderPrimitive.Control>
		</SliderPrimitive.Root>
	);
});

export { Slider, sliderVariants };
