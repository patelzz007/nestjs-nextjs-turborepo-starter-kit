import * as React from "react";
import { cn } from "@workspace/ui/lib/core/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

interface StackedAvatar {
	readonly src: string;
	readonly fallback: string;
	readonly name: string;
	/**
	 * Where the avatar sits in the stack: overlapped 8px per position at rest,
	 * fanned out 6px per position while the group is hovered. Literal classes
	 * per position, so Tailwind can see every one of them.
	 */
	readonly offsetClassName: string;
}

const avatars: readonly StackedAvatar[] = [
	{
		src: "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=96&h=96&dpr=2&q=80",
		fallback: "DK",
		name: "David Kim",
		offsetClassName: "translate-x-0",
	},
	{
		src: "https://github.com/maxleiter.png",
		fallback: "ML",
		name: "Max Leiter",
		offsetClassName: "-translate-x-2 group-hover/avatars:translate-x-1.5",
	},
	{
		src: "https://images.unsplash.com/photo-1543299750-19d1d6297053?w=96&h=96&dpr=2&q=80",
		fallback: "ER",
		name: "James Brown",
		offsetClassName: "-translate-x-4 group-hover/avatars:translate-x-3",
	},
	{
		src: "https://github.com/pranathip.png",
		fallback: "JW",
		name: "Jenny Wilson",
		offsetClassName: "-translate-x-6 group-hover/avatars:translate-x-4.5",
	},
];

/** Each avatar's stacking order: earlier avatars sit on top. */
const STACK_STYLES: ReadonlyMap<string, React.CSSProperties> = new Map(
	avatars.map((avatar: StackedAvatar, position: number): [string, React.CSSProperties] => [avatar.name, { zIndex: avatars.length - position }]),
);

export function Avatar24Example(): React.JSX.Element {
	return (
		<div className="group/avatars flex items-center px-2 py-4">
			{avatars.map((avatar: StackedAvatar): React.JSX.Element => (
				<div
					key={avatar.name}
					style={STACK_STYLES.get(avatar.name)}
					className={cn("group/avatar-item transition-all duration-300 ease-in-out will-change-transform", avatar.offsetClassName)}>
					<Tooltip>
						<TooltipTrigger
							render={
								<Avatar className={cn("origin-center ring-2 ring-background transition-transform duration-300 ease-in-out", "group-hover/avatar-item:scale-110")}>
									<AvatarImage src={avatar.src} alt={avatar.name} />
									<AvatarFallback className="text-xs">{avatar.fallback}</AvatarFallback>
								</Avatar>
							}
						/>
						<TooltipContent sideOffset={10}>{avatar.name}</TooltipContent>
					</Tooltip>
				</div>
			))}
		</div>
	);
}
