import * as React from "react";
import { Frame, FramePanel } from "@workspace/ui/components/frame";

import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@workspace/ui/components/avatar";

export function Avatar21Example(): React.JSX.Element {
	return (
		<Frame>
			<FramePanel className="flex items-center gap-2 p-2!">
				<AvatarGroup>
					<Avatar className="size-7">
						<AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
						<AvatarFallback>CH</AvatarFallback>
					</Avatar>
					<Avatar className="size-7">
						<AvatarImage src="https://github.com/maxleiter.png" alt="@maxleiter" />
						<AvatarFallback>CH</AvatarFallback>
					</Avatar>
					<Avatar className="size-7">
						<AvatarImage src="https://github.com/evilrabbit.png" alt="@evilrabbit" />
						<AvatarFallback>CH</AvatarFallback>
					</Avatar>
					<Avatar className="size-7">
						<AvatarImage src="https://github.com/leerob.png" alt="@leerob" />
						<AvatarFallback>CH</AvatarFallback>
					</Avatar>
				</AvatarGroup>

				<p className="me-1.5 text-xs text-muted-foreground">
					Joined by <span className="font-semibold text-foreground">500+</span> developers.
				</p>
			</FramePanel>
		</Frame>
	);
}
