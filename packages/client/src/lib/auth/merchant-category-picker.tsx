"use client";

import { type MerchantBusinessCategory, MERCHANT_BUSINESS_CATEGORY_LABELS, MerchantBusinessCategorySchema } from "@workspace/shared";
import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";

function CheckIcon({ className }: { readonly className?: string }): React.JSX.Element {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
			<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
		</svg>
	);
}

const CATEGORY_OPTIONS: readonly MerchantBusinessCategory[] = MerchantBusinessCategorySchema.options;

const CATEGORY_HINTS: Record<MerchantBusinessCategory, string> = {
	cafe: "Coffee, bakery, or tea house",
	restaurant: "Dine-in or quick service",
	retail: "Shop, boutique, or market",
	wellness: "Spa, gym, or clinic",
	entertainment: "Events, cinema, or leisure",
	food: "Food hall or specialty grocer",
	beverage: "Juice bar, bar, or brewery",
};

export interface MerchantCategoryPickerProps {
	readonly value: MerchantBusinessCategory;
	readonly onChange: (value: MerchantBusinessCategory) => void;
	readonly disabled?: boolean;
}

export const MerchantCategoryPicker = React.memo(function MerchantCategoryPicker({ value, onChange, disabled = false }: MerchantCategoryPickerProps): React.JSX.Element {
	const handleSelect = React.useCallback(
		(next: MerchantBusinessCategory): void => {
			if (!disabled) {
				onChange(next);
			}
		},
		[disabled, onChange],
	);

	const createSelectHandler = React.useCallback(
		(option: MerchantBusinessCategory): (() => void) => {
			return (): void => {
				handleSelect(option);
			};
		},
		[handleSelect],
	);

	return (
		<div role="radiogroup" aria-label="Business category" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
			{CATEGORY_OPTIONS.map((option) => {
				const selected = option === value;
				return (
					<button
						key={option}
						type="button"
						role="radio"
						aria-checked={selected}
						disabled={disabled}
						onClick={createSelectHandler(option)}
						className={cn(
							"group relative flex min-h-11 w-full items-start gap-3 rounded-xl border px-3 py-3 text-start transition-[border-color,background-color,box-shadow] duration-200 motion-reduce:transition-none",
							selected ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30" : "border-border bg-card hover:border-primary/40 hover:bg-muted/40",
							disabled && "pointer-events-none opacity-60",
						)}>
						<span
							className={cn(
								"mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
								selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40 bg-background text-transparent",
							)}
							aria-hidden="true">
							<CheckIcon className="size-3" />
						</span>
						<span className="min-w-0 flex-1">
							<span className="block text-sm font-medium text-foreground">{MERCHANT_BUSINESS_CATEGORY_LABELS[option]}</span>
							<span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{CATEGORY_HINTS[option]}</span>
						</span>
					</button>
				);
			})}
		</div>
	);
});

MerchantCategoryPicker.displayName = "MerchantCategoryPicker";
