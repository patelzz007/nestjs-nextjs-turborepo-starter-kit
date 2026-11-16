"use client";

import * as React from "react";
import { useState } from "react";
import { Cascader, CascaderContent, CascaderEmpty, CascaderList, CascaderPanel, CascaderStatus, CascaderTrigger } from "@workspace/ui/components/cascader/cascader";
import { CascaderItems } from "@workspace/ui/components/cascader/cascader-item";
import { CascaderBreadcrumb, CascaderInput, CascaderNav, CascaderValue } from "@workspace/ui/components/cascader/cascader-nav";
import type { CascaderNode } from "@workspace/ui/components/cascader/cascader-types";

import { Button } from "@workspace/ui/components/button";
import { Field, FieldDescription, FieldLabel } from "@workspace/ui/components/field";

// Two "Chargers" rows on purpose: a storefront taxonomy repeats names across
// departments, and only the trail under each hit tells them apart.
const catalog: CascaderNode[] = [
	{
		value: "electronics",
		label: "Electronics",
		children: [
			{
				value: "audio",
				label: "Audio",
				children: [
					{ value: "headphones", label: "Headphones" },
					{ value: "earbuds", label: "Earbuds" },
					{ value: "speakers", label: "Speakers" },
					{ value: "speaker-stands", label: "Speaker stands" },
					{ value: "microphones", label: "Microphones" },
					{ value: "turntables", label: "Turntables" },
				],
			},
			{
				value: "phones",
				label: "Phones & tablets",
				children: [
					{ value: "smartphones", label: "Smartphones" },
					{ value: "tablets", label: "Tablets" },
					{ value: "phone-cases", label: "Phone cases" },
					{ value: "phone-chargers", label: "Chargers" },
					{ value: "screen-protectors", label: "Screen protectors" },
				],
			},
			{
				value: "computers",
				label: "Computers",
				children: [
					{ value: "laptops", label: "Laptops" },
					{ value: "monitors", label: "Monitors" },
					{ value: "monitor-stands", label: "Monitor stands" },
					{ value: "keyboards", label: "Keyboards" },
					{ value: "laptop-sleeves", label: "Laptop sleeves" },
				],
			},
			{
				value: "cameras",
				label: "Cameras",
				children: [
					{ value: "mirrorless", label: "Mirrorless cameras" },
					{ value: "lenses", label: "Lenses" },
					{ value: "tripods", label: "Tripods" },
					{ value: "camera-chargers", label: "Chargers" },
				],
			},
		],
	},
	{
		value: "home",
		label: "Home & kitchen",
		children: [
			{
				value: "kitchen",
				label: "Kitchen",
				children: [
					{ value: "cookware", label: "Cookware" },
					{ value: "knives", label: "Knives" },
					{ value: "small-appliances", label: "Small appliances" },
					{ value: "food-storage", label: "Food storage" },
				],
			},
			{
				value: "furniture",
				label: "Furniture",
				children: [
					{ value: "desks", label: "Desks" },
					{ value: "office-chairs", label: "Office chairs" },
					{ value: "bookcases", label: "Bookcases" },
					{ value: "tv-stands", label: "TV stands" },
				],
			},
			{
				value: "lighting",
				label: "Lighting",
				children: [
					{ value: "desk-lamps", label: "Desk lamps" },
					{ value: "floor-lamps", label: "Floor lamps" },
					{ value: "smart-bulbs", label: "Smart bulbs" },
				],
			},
		],
	},
	{
		value: "sports",
		label: "Sports & outdoors",
		children: [
			{
				value: "cycling",
				label: "Cycling",
				children: [
					{ value: "bikes", label: "Bikes" },
					{ value: "helmets", label: "Helmets" },
					{ value: "bike-lights", label: "Bike lights" },
					{ value: "phone-mounts", label: "Phone mounts" },
				],
			},
			{
				value: "camping",
				label: "Camping",
				children: [
					{ value: "tents", label: "Tents" },
					{ value: "sleeping-bags", label: "Sleeping bags" },
					{ value: "headlamps", label: "Headlamps" },
					{ value: "camp-stoves", label: "Camp stoves" },
				],
			},
			{
				value: "fitness",
				label: "Fitness",
				children: [
					{ value: "yoga-mats", label: "Yoga mats" },
					{ value: "dumbbells", label: "Dumbbells" },
					{ value: "fitness-trackers", label: "Fitness trackers" },
				],
			},
		],
	},
	{
		value: "travel",
		label: "Travel",
		children: [
			{
				value: "luggage",
				label: "Luggage",
				children: [
					{ value: "carry-on", label: "Carry-on suitcases" },
					{ value: "checked", label: "Checked suitcases" },
					{ value: "duffel-bags", label: "Duffel bags" },
				],
			},
			{
				value: "travel-accessories",
				label: "Travel accessories",
				children: [
					{ value: "packing-cubes", label: "Packing cubes" },
					{ value: "travel-adapters", label: "Travel adapters" },
					{ value: "neck-pillows", label: "Neck pillows" },
				],
			},
		],
	},
	{
		value: "office",
		label: "Office supplies",
		children: [
			{ value: "notebooks", label: "Notebooks" },
			{ value: "pens", label: "Pens" },
			{ value: "desk-organizers", label: "Desk organizers" },
			{ value: "whiteboards", label: "Whiteboards" },
		],
	},
	{
		value: "toys",
		label: "Toys & games",
		children: [
			{ value: "board-games", label: "Board games" },
			{ value: "puzzles", label: "Puzzles" },
			{ value: "building-sets", label: "Building sets" },
			{ value: "stem-kits", label: "STEM kits" },
		],
	},
];

/**
 * Global search from inside a nested level. The product is already filed under
 * Headphones, so the panel reopens on Audio (`revealSelected` is on by
 * default). `"deep"` would search only Audio and below; `"global"` searches the
 * whole catalog from here, so "stand" also finds Monitor stands and TV stands.
 * A branch hit opens where it lives, not under Audio, and clearing the query
 * returns to Audio.
 */
export function Cascader21Example(): React.JSX.Element {
	const [value, setValue] = useState("headphones");

	return (
		<div className="flex w-full justify-center p-4">
			<Field className="w-full max-w-xs">
				<FieldLabel htmlFor="category-trigger">Category</FieldLabel>
				<Cascader items={catalog} value={value} onValueChange={setValue} searchScope="global">
					<CascaderTrigger id="category-trigger" render={<Button variant="outline" className="w-full justify-between font-normal" />}>
						<CascaderValue placeholder="Select a category" />
					</CascaderTrigger>

					<CascaderContent className="w-(--anchor-width)">
						<CascaderPanel>
							<CascaderNav>
								<CascaderInput placeholder="Search all categories..." />
							</CascaderNav>
							<CascaderBreadcrumb />
							<CascaderEmpty />
							<CascaderList>
								<CascaderItems />
							</CascaderList>
							<CascaderStatus />
						</CascaderPanel>
					</CascaderContent>
				</Cascader>
				<FieldDescription>Where shoppers find this product in the store.</FieldDescription>
			</Field>
		</div>
	);
}
