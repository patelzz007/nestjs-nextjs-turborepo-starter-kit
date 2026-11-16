"use client";

import type * as React from "react";
import { CircleCheckIcon, CircleDashedIcon, PackageCheckIcon, PlaneIcon, PlaneTakeoffIcon, ScanLineIcon, SendIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@workspace/ui/components/badge";
import { Stepper, StepperContent, StepperItem, StepperNav, StepperPanel, StepperSeparator, StepperTitle, StepperTrigger } from "@workspace/ui/components/stepper";
import { cn } from "@workspace/ui/lib/core/utils";

import { Button } from "@workspace/ui/components/button";

/** The step the example opens on. */
const INITIAL_STEP = 4;
/** How far one Previous / Next click moves. */
const STEP_INCREMENT = 1;
const FIRST_STEP = 1;
/** The roving tab stop the last trigger keeps once every step is done. */
const TAB_STOP = 0;

const steps = [
	{
		title: "Order Placed",
		summary: "Payment confirmed and the order sent to the warehouse.",
		icon: <PackageCheckIcon className="size-4" aria-hidden="true" />,
	},
	{
		title: "Processing",
		summary: "Items picked, packed and labelled at the Rotterdam hub.",
		icon: <CircleDashedIcon className="size-4" aria-hidden="true" />,
	},
	{
		title: "Dispatched",
		summary: "Handed to the carrier as 2 parcels under one waybill.",
		icon: <SendIcon className="size-4" aria-hidden="true" />,
	},
	{
		title: "In Transit",
		summary: "Flying from Amsterdam to New York, landing in about 6 hours.",
		icon: <PlaneTakeoffIcon className="size-4" aria-hidden="true" />,
	},
	{
		title: "Customs",
		summary: "Import clearance at JFK, usually done within a day.",
		icon: <ScanLineIcon className="size-4" aria-hidden="true" />,
	},
	{
		title: "Delivered",
		summary: "Expected at your door on Mar 7 before 18:00.",
		icon: <CircleCheckIcon className="size-4" aria-hidden="true" />,
	},
];

// 2x4px pill ticks on a 5.5px SVG tile, the design's pitch. mask-repeat:
// space keeps every tick whole and starts and ends each run 1.75px in, so two
// runs that meet keep the 3.5px gap.
const ticks =
	"bg-ring/40 mask-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220,0,5.5,4%22%3E%3Crect%20x=%221.75%22%20width=%222%22%20height=%224%22%20rx=%221%22/%3E%3C/svg%3E')] mask-size-[0.34375rem_100%] mask-repeat-space";

// A done step paints solid. The per-style radius outranks a plain class and
// would pinch every joint, so ! squares it.
const bar = `${ticks} m-0 rounded-none! group-data-[orientation=horizontal]/stepper-nav:h-1 data-[state=completed]:bg-success data-[state=completed]:mask-none`;

export function Stepper38Example(): React.JSX.Element {
	const [current, setCurrent] = useState<number>(INITIAL_STEP);
	const prevRef = useRef<HTMLButtonElement>(null);
	const nextRef = useRef<HTMLButtonElement>(null);
	// One past the last step marks every step complete. No tab is selected
	// then, so the last one keeps the tablist's tab stop.
	const allDone = current > steps.length;

	// Past the collapsed width (many steps in a small box) the row scrolls, so
	// the current step comes back into view when it changes or the row resizes,
	// and a tab comes into view when focus lands on it (the browser leaves a
	// half-hidden one where it is). Only the row scrolls, never the page.
	const rowRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const row = rowRef.current;
		if (!row) return;
		const reveal = (tab: Element | null): void => {
			if (!tab) return;
			const box = row.getBoundingClientRect();
			const { left, right } = tab.getBoundingClientRect();
			if (left < box.left || right > box.right) {
				row.scrollLeft += (left + right - box.left - box.right) / 2;
			}
		};
		const onFocus = (event: FocusEvent): void => {
			reveal(event.target instanceof Element ? event.target.closest('[role="tab"]') : null);
		};
		const observer = new ResizeObserver((): void => {
			reveal(row.querySelector('[aria-selected="true"]'));
		});
		observer.observe(row);
		row.addEventListener("focusin", onFocus);
		return (): void => {
			observer.disconnect();
			row.removeEventListener("focusin", onFocus);
		};
	}, [current]);

	const goTo = useCallback((step: number): void => {
		setCurrent(step);
		// The pressed button disables itself at either end, so focus moves to
		// its partner.
		if (step === FIRST_STEP) nextRef.current?.focus();
		if (step > steps.length) prevRef.current?.focus();
	}, []);

	const goToPreviousStep = useCallback((): void => {
		goTo(current - STEP_INCREMENT);
	}, [current, goTo]);

	const goToNextStep = useCallback((): void => {
		goTo(current + STEP_INCREMENT);
	}, [current, goTo]);

	return (
		<Stepper value={current} onValueChange={setCurrent} className="max-w-200" aria-label="Shipment tracking">
			{/* Under 42rem every label drops to its icon, so the icons hold still
          as the plane moves and the panel names the current step; past that
          the row scrolls instead of crushing them. The padding
          keeps the focus ring and the hit areas inside the scroll box. */}
			<div ref={rowRef} className="@container relative -mx-1 overflow-x-auto px-1 pb-1">
				<StepperNav className="min-w-max">
					{steps.map((item, index) => {
						const step = index + 1;

						// Every step but the last grows by the same amount, which places
						// the labels exactly as justify-between would. The bar row holds
						// the bar over the label, then the run to the next label.
						return (
							<StepperItem key={item.title} step={step} className="grid grid-cols-[auto_1fr] grid-rows-[1.25rem_auto] not-last:flex-auto">
								{/* The plane centers on the current label. The ticks after
                    it start under its edge, so the first one sits flush, and
                    the last label's run reaches its end, as drawn. On the last
                    step it lands at the end of the track instead, with no run
                    left after it. */}
								{step === current ? (
									<span aria-hidden="true" className={cn("grid items-center", step === steps.length ? "grid-cols-[1fr_auto]" : "grid-cols-[1fr_auto_1fr]")}>
										<span className="h-1 bg-success group-first/step:rounded-s-full" />
										<Badge variant="success" className="px-0.75">
											{/* lucide draws it flying up and to the right, so it
                          turns 45 degrees to follow the bar, mirrored in
                          RTL. */}
											<PlaneIcon className="size-3.5 rotate-45 rtl:-scale-x-100 rtl:-rotate-45" />
										</Badge>
										{step < steps.length ? <span className={`${ticks} -ms-[0.109375rem] h-1`} /> : null}
									</span>
								) : (
									<StepperSeparator className={`${bar} group-first/step:rounded-s-full! group-last/step:-me-[0.109375rem]`} />
								)}
								{step < steps.length ? <StepperSeparator className={bar} /> : null}

								{/* mt-2 under the 20px plane row leaves the drawn 16px from
                    bar to label, and after: gives the label a 24px hit area.
                    Folded to its icon, every trigger takes the plane's 22px
                    and centers in it, so no column grows under the plane. */}
								<StepperTrigger
									tabIndex={allDone && step === steps.length ? TAB_STOP : undefined}
									className="relative col-start-1 row-start-2 mt-2 gap-1.5 after:absolute after:-inset-1 data-[state=inactive]:text-ring @max-2xl:min-w-5.5 @max-2xl:justify-center">
									{item.icon}
									<StepperTitle className="whitespace-nowrap data-[state=inactive]:text-muted-foreground @max-2xl:sr-only">{item.title}</StepperTitle>
									{/* Done and current labels look alike and only the bar
                      tells them apart, so the tab name says it. */}
									{step < current ? <span className="sr-only">, done</span> : null}
								</StepperTrigger>
							</StepperItem>
						);
					})}
				</StepperNav>
			</div>

			<StepperPanel className="mt-6 text-center">
				{steps.map((item, index) => (
					<StepperContent key={item.title} value={index + 1}>
						<p className="text-sm font-medium">{item.title}</p>
						<p className="text-sm text-muted-foreground">{item.summary}</p>
					</StepperContent>
				))}
				<StepperContent value={steps.length + 1}>
					<p className="text-sm font-medium">Delivered</p>
					<p className="text-sm text-muted-foreground">Both parcels arrived and the order is complete.</p>
				</StepperContent>
				<div className="mt-3 flex justify-center gap-2">
					<Button ref={prevRef} variant="outline" size="sm" disabled={current === FIRST_STEP} onClick={goToPreviousStep}>
						Previous
					</Button>
					<Button ref={nextRef} variant="outline" size="sm" disabled={allDone} onClick={goToNextStep}>
						Next
					</Button>
				</div>
			</StepperPanel>
		</Stepper>
	);
}
