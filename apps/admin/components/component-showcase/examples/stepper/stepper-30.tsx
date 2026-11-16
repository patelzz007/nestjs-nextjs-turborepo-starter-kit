"use client";

import type * as React from "react";
import { FlagIcon, FuelIcon, MoonIcon, PackagePlusIcon, SunIcon, TruckIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@workspace/ui/components/badge";
import { IconTile } from "@workspace/ui/components/icon-tile";
import { Stepper, StepperContent, StepperIndicator, StepperItem, StepperNav, StepperPanel, StepperSeparator, StepperTrigger } from "@workspace/ui/components/stepper";
import { cn } from "@workspace/ui/lib/core/utils";

import { Button } from "@workspace/ui/components/button";

/** The step the example opens on. */
const INITIAL_STEP = 6;
/** How far one Previous / Next click moves. */
const STEP_INCREMENT = 1;
const FIRST_STEP = 1;
/** The roving tab stop the last trigger keeps once every step is done. */
const TAB_STOP = 0;

interface Stop {
	readonly title: string;
	readonly place: string;
	readonly km: string;
	readonly note: string;
	readonly icon: React.ReactNode;
	readonly rest?: string;
}

const moon = <MoonIcon />;

const sun = <SunIcon />;

const stops: Stop[] = [
	{
		title: "Pickup",
		place: "Memphis, TN",
		km: "0",
		note: "24 pallets loaded and sealed, westbound on I-40.",
		icon: <PackagePlusIcon />,
	},
	{
		title: "Overnight rest",
		place: "Amarillo, TX",
		km: "1,155",
		note: "8 hours in the sleeper berth before the next shift.",
		icon: moon,
		rest: "8H",
	},
	{
		title: "Back on the road",
		place: "Amarillo, TX",
		km: "1,155",
		note: "A fresh 11-hour driving window, 1,735 km to go.",
		icon: sun,
	},
	{
		title: "Fuel stop",
		place: "Gallup, NM",
		km: "1,840",
		note: "Refueled with 410 L of diesel and checked the tires.",
		icon: <FuelIcon />,
	},
	{
		title: "Overnight rest",
		place: "Kingman, AZ",
		km: "2,375",
		note: "8 hours in the sleeper berth, 515 km from delivery.",
		icon: moon,
		rest: "8H",
	},
	{
		title: "Back on the road",
		place: "Kingman, AZ",
		km: "2,375",
		note: "On I-40 to Barstow, then I-15 into Los Angeles.",
		icon: sun,
	},
	{
		title: "Delivery",
		place: "Los Angeles, CA",
		km: "2,890",
		note: "Signed for at dock 4 by the receiving clerk.",
		icon: <FlagIcon />,
	},
];

// A gradient cut into 2x6px pill bars by a 6px SVG mask tile, spaced edge to
// edge by mask-repeat: space so no bar is ever clipped. The -2px margins land
// the first and last bar flush with the 4px margins around the leg.
function Leg({ rest, live }: { readonly rest?: string | undefined; readonly live: boolean }): React.JSX.Element {
	return (
		<div className="relative mx-1 flex min-w-3 flex-1 items-center self-stretch">
			<StepperSeparator className="-mx-0.5 bg-transparent bg-linear-to-r from-input/80 to-input/80 mask-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220,0,6,6%22%3E%3Crect%20x=%222%22%20width=%222%22%20height=%226%22%20rx=%221%22/%3E%3C/svg%3E')] mask-size-[0.375rem_100%] mask-repeat-space group-data-[orientation=horizontal]/stepper-nav:h-1.5 data-[state=active]:from-success/24 data-[state=active]:to-success/80 rtl:bg-linear-to-l" />

			{rest ? (
				<Badge variant="invert" className="pointer-events-none absolute inset-0 m-auto @max-xl:hidden" aria-hidden="true">
					{rest}
				</Badge>
			) : null}

			{/* 6px above the ticks as in Figma. Over a rest leg it rides 4px
          higher so it clears the 8H badge by 3px instead of touching it. */}
			{live ? (
				<Badge variant="success" className={cn("pointer-events-none absolute inset-x-0 mx-auto", rest ? "-top-4.5" : "-top-3.5")} aria-hidden="true">
					<TruckIcon className="rtl:-scale-x-100" />
				</Badge>
			) : null}
		</div>
	);
}

export function Stepper30Example(): React.JSX.Element {
	const [current, setCurrent] = useState<number>(INITIAL_STEP);
	const prevRef = useRef<HTMLButtonElement>(null);
	const nextRef = useRef<HTMLButtonElement>(null);
	// One past the last step marks every step complete. No tab is selected
	// then, so the last one keeps the tablist's tab stop.
	const allDone = current > stops.length;

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
		// The pressed button disables itself at either end, so focus moves to its partner.
		if (step === FIRST_STEP) nextRef.current?.focus();
		if (step > stops.length) prevRef.current?.focus();
	}, []);

	const goToPreviousStep = useCallback((): void => {
		goTo(current - STEP_INCREMENT);
	}, [current, goTo]);

	const goToNextStep = useCallback((): void => {
		goTo(current + STEP_INCREMENT);
	}, [current, goTo]);

	return (
		<Stepper value={current} onValueChange={setCurrent} className="w-full max-w-200" aria-label="Freight route">
			{/* Under 36rem the rest stops give up their fixed width and 8H badge
          and every leg shrinks to 12px; past that the route scrolls instead of
          crushing them. The top padding is the room the truck badge rides in
          at its highest (over a rest leg); the rest keeps the focus ring
          inside the scroll box. */}
			<div ref={rowRef} className="@container relative -mx-1 overflow-x-auto px-1 pt-4.5 pb-1">
				<StepperNav className="min-w-max">
					{stops.map((stop, index) => {
						const step = index + 1;
						const last = step === stops.length;
						const active = step === current;

						// Each stop owns the leg that follows it, so the active stop's
						// leg is the live one. Rest stops keep a fixed 32px leg.
						return (
							<StepperItem key={`${stop.title} ${stop.place}`} step={step} className={cn(stop.rest && "@xl:w-17.5 @xl:not-last:flex-none")}>
								<StepperTrigger tabIndex={allDone && step === stops.length ? TAB_STOP : undefined} aria-label={`${stop.title}, ${stop.place}`}>
									{/* The 30px ring stays transparent and the 24px tile inside
                      it carries the icon. With no leg left to light up, the
                      destination itself turns green once it is reached. */}
									<StepperIndicator className="size-7.5 border border-input/50 bg-transparent data-[state=active]:bg-transparent data-[state=completed]:bg-transparent">
										<IconTile
											variant="solid"
											size="xs"
											radius="full"
											className={cn("bg-input text-foreground [--icon-tile-icon-size:--spacing(3)]", last && step <= current && "bg-success text-success-foreground")}
											aria-hidden="true">
											{stop.icon}
										</IconTile>
									</StepperIndicator>
								</StepperTrigger>

								{!last ? <Leg rest={stop.rest} live={active} /> : null}
							</StepperItem>
						);
					})}
				</StepperNav>
			</div>

			<StepperPanel className="mt-5 text-center">
				{stops.map((stop, index) => (
					<StepperContent key={`${stop.title} ${stop.place}`} value={index + 1}>
						<p className="flex items-center justify-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground">
							{stop.place}
							<span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-muted-foreground/40" />
							km {stop.km}
						</p>
						<p className="text-sm font-medium">{stop.title}</p>
						<p className="text-sm text-muted-foreground">{stop.note}</p>
					</StepperContent>
				))}
				<StepperContent value={stops.length + 1}>
					<p className="text-xs text-muted-foreground">All {stops.length} stops done</p>
					<p className="text-sm font-medium">Trip complete</p>
					<p className="text-sm text-muted-foreground">The load is signed for and the trip is closed.</p>
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
