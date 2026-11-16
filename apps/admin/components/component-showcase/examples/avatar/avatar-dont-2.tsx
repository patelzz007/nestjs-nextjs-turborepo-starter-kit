import * as React from "react";
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@workspace/ui/components/avatar";

const PHOTO = "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80";

const PEOPLE: readonly string[] = ["AL", "AT", "GH", "KJ", "LT", "MH", "TB", "BL", "DR", "EW", "JS", "SC"];

export function AvatarDont2Example(): React.JSX.Element {
	return (
		<AvatarGroup className="w-48 overflow-hidden">
			{PEOPLE.map((initials: string): React.JSX.Element => (
				<Avatar key={initials}>
					<AvatarImage src={PHOTO} alt="" />
					<AvatarFallback>{initials}</AvatarFallback>
				</Avatar>
			))}
		</AvatarGroup>
	);
}
