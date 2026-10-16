import * as React from "react";
import { CircleCheckIcon, XIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Marker, MarkerContent, MarkerIcon } from "@workspace/ui/components/marker";
import { Spinner } from "@workspace/ui/components/spinner";

// Three states, one column: done, failed, and still running. The failure is
// coloured by a badge and never by a text colour on the row, so it survives
// every style and stays readable to anyone who cannot see the hue.
//
// The five rows are written out rather than mapped. Each state carries
// something different (a badge here, a spinner there), so a data driven version
// needs a switch in the row body and reads worse than the markup it replaces.
//
// The spinner sits inside the icon slot, which the primitive hides from
// assistive tech together with its subtree, so its own status role never
// reaches the accessibility tree. The row states its progress in text instead,
// and keeps role="status" for the app that swaps this line out at runtime.
export function Marker3Example(): React.JSX.Element {
	return (
		<Card className="mx-auto w-full max-w-sm">
			<CardHeader>
				<CardTitle>Agent run</CardTitle>
				<CardDescription>fix/rate-limit-window</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col gap-3">
					<Marker>
						<MarkerIcon>
							<CircleCheckIcon />
						</MarkerIcon>
						<MarkerContent>Read src/lib/rate-limit.ts</MarkerContent>
					</Marker>
					<Marker>
						<MarkerIcon>
							<CircleCheckIcon />
						</MarkerIcon>
						<MarkerContent>Reproduced the 429 on staging</MarkerContent>
					</Marker>
					<Marker>
						<MarkerIcon>
							<CircleCheckIcon />
						</MarkerIcon>
						<MarkerContent>Widened the window to 60s</MarkerContent>
					</Marker>
					<Marker>
						<MarkerIcon>
							<XIcon />
						</MarkerIcon>
						<MarkerContent>Type check failed in src/db/schema.ts</MarkerContent>
						<Badge variant="destructive-light">failed</Badge>
					</Marker>
					{/* The pulse rides on a plain span, not on the content slot, and it
              is core Tailwind rather than a utility that arrives with the CLI
              package, so an older toolchain still renders a readable line. */}
					<Marker role="status">
						<MarkerIcon>
							{/* size-full, because the spinner carries its own fixed size and
                  the icon slot's per style sizing skips any svg that already
                  has one, which would pin it to one style's scale. */}
							<Spinner className="size-full" />
						</MarkerIcon>
						<MarkerContent>
							<span className="sr-only">In progress: </span>
							<span className="animate-pulse">Re-running the test suite</span>
						</MarkerContent>
					</Marker>
				</div>
			</CardContent>
		</Card>
	);
}
