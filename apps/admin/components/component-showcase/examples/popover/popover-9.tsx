"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { Badge } from "@workspace/ui/components/badge";
import { format, formatDistanceToNow } from "date-fns";

import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";

/** The clocks re-render once a second. */
const CLOCK_TICK_MS = 1000;
/** The sample deploy happened two hours before "now". */
const LAST_DEPLOY_AGO_MS = 2 * 60 * 60 * 1000;

export function Popover9Example(): React.JSX.Element {
	const [now, setNow] = useState(new Date());

	useEffect((): (() => void) => {
		const timer = setInterval((): void => {
			setNow(new Date());
		}, CLOCK_TICK_MS);
		return (): void => {
			clearInterval(timer);
		};
	}, []);

	// Static reference time for the "last deployed" example
	const referenceTime = new Date(now.getTime() - LAST_DEPLOY_AGO_MS);

	return (
		<div className="flex min-h-[100px] items-center justify-center">
			<p className="text-sm text-muted-foreground">
				Last deployed{" "}
				<Popover>
					<PopoverTrigger render={<button className="cursor-default text-foreground underline decoration-dashed decoration-1 underline-offset-4 outline-hidden" />}>
						{formatDistanceToNow(referenceTime, { addSuffix: true })}
					</PopoverTrigger>
					<PopoverContent className="w-auto max-w-86 gap-0 p-0" align="start">
						<p className="border-b px-2 py-1 font-medium text-foreground">{formatDistanceToNow(referenceTime, { addSuffix: true })}</p>
						<div className="px-2 py-1.5">
							<table>
								<tbody>
									<tr>
										<td className="pr-4 pb-1.5">
											<Badge variant="outline">UTC</Badge>
										</td>
										<td className="pr-6 pb-1.5">{format(referenceTime, "MMM d, yyyy")}</td>
										<td className="pb-1.5 text-muted-foreground">{format(referenceTime, "hh:mm:ss a")}</td>
									</tr>
									<tr>
										<td className="pr-4">
											<span className="rounded bg-muted px-1.5 py-0.5 font-medium">
												{Intl.DateTimeFormat().resolvedOptions().timeZone.split("/").pop()?.replace("_", " ") ?? "Local"}
											</span>
										</td>
										<td className="pr-6">{format(now, "MMM d, yyyy")}</td>
										<td className="w-28 text-muted-foreground">{format(now, "hh:mm:ss a")}</td>
									</tr>
								</tbody>
							</table>
						</div>
					</PopoverContent>
				</Popover>{" "}
				by CI/CD pipeline.
			</p>
		</div>
	);
}
