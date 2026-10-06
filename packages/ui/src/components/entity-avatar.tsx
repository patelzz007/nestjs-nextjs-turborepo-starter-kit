"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { cn } from "@workspace/ui/lib/core/utils";
import { getUserInitials } from "@workspace/ui/lib/core/user-initials";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

/**
 * Square brand mark for a named entity (a shop, organization, team): its logo
 * when one is given, otherwise a monogram of the name on a tint picked
 * deterministically from the theme's chart palette — the same name always gets
 * the same colour, so an entity stays recognisable before it has a logo.
 */
const entityAvatarVariants = cva("shrink-0 overflow-hidden bg-background", {
	variants: {
		size: {
			sm: "size-8",
			md: "size-10",
			lg: "size-12",
			xl: "size-16",
		},
		shape: {
			rounded: "",
			circle: "rounded-full after:rounded-full",
		},
	},
	compoundVariants: [
		{ shape: "rounded", size: ["sm", "md"], className: "rounded-lg after:rounded-lg" },
		{ shape: "rounded", size: ["lg", "xl"], className: "rounded-xl after:rounded-xl" },
	],
	defaultVariants: {
		size: "md",
		shape: "rounded",
	},
});

/**
 * The monogram: foreground text on a chart-token tint, so every app theme
 * (light and dark) recolours it while the text keeps its contrast. Only the
 * four saturated chart slots are used — `chart-5` is each theme's neutral
 * (near-grey) slot, so a monogram tinted with it reads as "no colour".
 */
const entityAvatarMonogramVariants = cva("flex size-full items-center justify-center rounded-[inherit] font-semibold text-foreground uppercase", {
	variants: {
		size: {
			sm: "text-xs",
			md: "text-sm",
			lg: "text-base",
			xl: "text-xl",
		},
		tone: {
			"chart-1": "bg-chart-1/20",
			"chart-2": "bg-chart-2/20",
			"chart-3": "bg-chart-3/20",
			"chart-4": "bg-chart-4/20",
		},
	},
	defaultVariants: {
		size: "md",
		tone: "chart-1",
	},
});

export type EntityAvatarTone = NonNullable<VariantProps<typeof entityAvatarMonogramVariants>["tone"]>;

const ENTITY_AVATAR_TONES: readonly [EntityAvatarTone, EntityAvatarTone, EntityAvatarTone, EntityAvatarTone] = ["chart-1", "chart-2", "chart-3", "chart-4"];

/** Classic 31-multiplier string hash (as in Java's `String#hashCode`) — stable across runs and platforms. */
const NAME_HASH_MULTIPLIER = 31;

function hashName(name: string): number {
	let hash = 0;
	for (const character of name.trim().toLocaleLowerCase()) {
		// `>>> 0` keeps the running hash an unsigned 32-bit integer.
		hash = (hash * NAME_HASH_MULTIPLIER + (character.codePointAt(0) ?? 0)) >>> 0;
	}
	return hash;
}

/** The monogram tint for a name — deterministic, case- and surrounding-whitespace-insensitive. */
export function getEntityAvatarTone(name: string): EntityAvatarTone {
	// The modulo keeps the index in range, so the fallback is never reached.
	return ENTITY_AVATAR_TONES[hashName(name) % ENTITY_AVATAR_TONES.length] ?? ENTITY_AVATAR_TONES[0];
}

export interface EntityAvatarProps extends Omit<React.ComponentPropsWithoutRef<"span">, "children">, VariantProps<typeof entityAvatarVariants> {
	/** The entity's display name — drives the monogram, its tint and the default accessible name. */
	readonly name: string;
	/** Logo URL; `null`/omitted (or an image that fails to load) shows the monogram. */
	readonly src?: string | null | undefined;
	/**
	 * Accessible name, `<img alt>` semantics: defaults to `name`. Pass `""` when
	 * the name is already rendered as adjacent text — the mark is then
	 * decorative and hidden from assistive technology, so it isn't read twice.
	 */
	readonly alt?: string | undefined;
}

/**
 * Logo-or-monogram mark for a named entity. Data-agnostic: the caller decides
 * what the entity is and where `src` comes from. Logos load lazily, in place,
 * `object-contain` on a neutral surface (never cropped); until a logo has
 * loaded — or if it fails — the monogram is shown.
 */
const EntityAvatar = React.forwardRef<HTMLSpanElement, EntityAvatarProps>(function EntityAvatar({ name, src, alt, size, shape, className, ...props }, ref): React.JSX.Element {
	const accessibleName = alt ?? name;
	const isDecorative = accessibleName.length === 0;
	const hasImage = src !== null && src !== undefined && src.length > 0;
	const tone = getEntityAvatarTone(name);

	return (
		<Avatar ref={ref} data-slot="entity-avatar" aria-hidden={isDecorative ? true : undefined} className={cn(entityAvatarVariants({ size, shape }), className)} {...props}>
			{hasImage ? (
				<AvatarImage
					keepMounted
					src={src}
					alt={accessibleName}
					loading="lazy"
					decoding="async"
					className="absolute inset-0 rounded-[inherit] object-contain p-1 data-error:hidden data-loading:opacity-0"
				/>
			) : null}
			<AvatarFallback data-tone={tone} className={entityAvatarMonogramVariants({ size, tone })}>
				<span aria-hidden="true">{getUserInitials(name)}</span>
				{isDecorative ? null : <span className="sr-only">{accessibleName}</span>}
			</AvatarFallback>
		</Avatar>
	);
});
EntityAvatar.displayName = "EntityAvatar";

export { EntityAvatar, entityAvatarVariants };
