"use client";

import type { PilotCity, RewardCategory } from "@workspace/shared";
import { Button } from "@workspace/ui/components/form/button";
import { Input } from "@workspace/ui/components/form/input";
import { cn } from "@workspace/ui/lib/utils";
import { MapPin, Search, X } from "lucide-react";
import * as React from "react";

const CITIES: readonly { readonly value: PilotCity; readonly label: string }[] = [
	{ value: "KUALA_LUMPUR", label: "Kuala Lumpur" },
	{ value: "MELAKA", label: "Melaka" },
];

export interface RewardHubFiltersProps {
	readonly searchDraft: string;
	readonly city: PilotCity | "ALL";
	readonly category: RewardCategory | "ALL";
	readonly categories: readonly RewardCategory[];
	readonly onSearchDraftChange: (value: string) => void;
	readonly onSearchSubmit: () => void;
	readonly onCityChange: (city: PilotCity | "ALL") => void;
	readonly onCategoryChange: (category: RewardCategory | "ALL") => void;
	readonly onClearFilters: () => void;
	readonly hasActiveFilters: boolean;
}

export function RewardHubFilters({
	searchDraft,
	city,
	category,
	categories,
	onSearchDraftChange,
	onSearchSubmit,
	onCityChange,
	onCategoryChange,
	onClearFilters,
	hasActiveFilters,
}: RewardHubFiltersProps): React.JSX.Element {
	const handleSubmit = React.useCallback(
		(event: React.FormEvent<HTMLFormElement>): void => {
			event.preventDefault();
			onSearchSubmit();
		},
		[onSearchSubmit],
	);

	const handleSearchChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onSearchDraftChange(event.target.value);
		},
		[onSearchDraftChange],
	);

	const handleCityAll = React.useCallback((): void => {
		onCityChange("ALL");
	}, [onCityChange]);

	const handleCategoryAll = React.useCallback((): void => {
		onCategoryChange("ALL");
	}, [onCategoryChange]);

	return (
		<div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-5">
			<form className="relative" onSubmit={handleSubmit}>
				<Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
				<Input
					id="reward-search"
					className="h-11 rounded-xl border-border bg-background pr-24 pl-10 text-base"
					placeholder="Search coffee, lunch, spa…"
					value={searchDraft}
					onChange={handleSearchChange}
					aria-label="Search rewards"
				/>
				<Button type="submit" className="absolute top-1/2 right-1.5 -translate-y-1/2">
					Search
				</Button>
			</form>

			<div className="space-y-3">
				<div className="flex flex-wrap items-center gap-2">
					<span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
						<MapPin className="size-3.5" aria-hidden="true" />
						City
					</span>
					<div className="flex flex-wrap gap-2">
						<FilterChip label="All cities" isActive={city === "ALL"} onClick={handleCityAll} />
						{CITIES.map((item) => (
							<CityChip key={item.value} city={item.value} label={item.label} activeCity={city} onSelect={onCityChange} />
						))}
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Category</span>
					<div className="flex flex-wrap gap-2">
						<FilterChip label="All" isActive={category === "ALL"} onClick={handleCategoryAll} />
						{categories.map((item) => (
							<CategoryChip key={item} category={item} activeCategory={category} onSelect={onCategoryChange} />
						))}
					</div>
				</div>
			</div>

			{hasActiveFilters ? (
				<div className="flex justify-end border-t border-border/80 pt-3">
					<Button type="button" variant="ghost" size="sm" onClick={onClearFilters} className="gap-1.5 text-muted-foreground">
						<X className="size-3.5" aria-hidden="true" />
						Clear filters
					</Button>
				</div>
			) : null}
		</div>
	);
}

interface FilterChipProps {
	readonly label: string;
	readonly isActive: boolean;
	readonly onClick: () => void;
}

function FilterChip({ label, isActive, onClick }: FilterChipProps): React.JSX.Element {
	return (
		<Button
			type="button"
			variant={isActive ? "default" : "outline"}
			onClick={onClick}
			className={cn("h-9 rounded-full px-4 text-sm capitalize", !isActive ? "bg-background" : undefined)}>
			{label}
		</Button>
	);
}

interface CityChipProps {
	readonly city: PilotCity;
	readonly label: string;
	readonly activeCity: PilotCity | "ALL";
	readonly onSelect: (city: PilotCity | "ALL") => void;
}

function CityChip({ city, label, activeCity, onSelect }: CityChipProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onSelect(city);
	}, [city, onSelect]);

	return <FilterChip label={label} isActive={activeCity === city} onClick={handleClick} />;
}

interface CategoryChipProps {
	readonly category: RewardCategory;
	readonly activeCategory: RewardCategory | "ALL";
	readonly onSelect: (category: RewardCategory | "ALL") => void;
}

function CategoryChip({ category, activeCategory, onSelect }: CategoryChipProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onSelect(category);
	}, [category, onSelect]);

	return <FilterChip label={category} isActive={activeCategory === category} onClick={handleClick} />;
}
