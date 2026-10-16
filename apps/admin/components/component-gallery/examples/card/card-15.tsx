import * as React from "react";
import { ArrowDownIcon, ArrowUpIcon, MoreHorizontalIcon, PinIcon, SettingsIcon, Share2Icon, TrashIcon, TriangleAlertIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { Separator } from "@workspace/ui/components/separator";

/** The sample KPI the card shows. */
interface RevenueMetric {
	readonly title: string;
	readonly value: string;
	/** Change against last month, in percent. */
	readonly delta: number;
	readonly positive: boolean;
	readonly lastMonth: string;
}

const METRIC: RevenueMetric = { title: "Revenue", value: "$12.4k", delta: 12.5, positive: true, lastMonth: "$11.0k" };

export function Card15Example(): React.JSX.Element {
	const { title, value, delta, positive, lastMonth } = METRIC;

	return (
		<Card className="w-full max-w-xs">
			<CardContent className="flex flex-col gap-5">
				<div className="flex items-center justify-between gap-3">
					<h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
					<DropdownMenu>
						<DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="-me-1.5" aria-label="More options" />}>
							<MoreHorizontalIcon aria-hidden="true" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-48">
							<DropdownMenuGroup>
								<DropdownMenuItem>
									<SettingsIcon aria-hidden="true" />
									Settings
								</DropdownMenuItem>
								<DropdownMenuItem>
									<TriangleAlertIcon aria-hidden="true" />
									Add Alert
								</DropdownMenuItem>
								<DropdownMenuItem>
									<PinIcon aria-hidden="true" />
									Pin to Dashboard
								</DropdownMenuItem>
								<DropdownMenuItem>
									<Share2Icon aria-hidden="true" />
									Share
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem variant="destructive">
									<TrashIcon aria-hidden="true" />
									Remove
								</DropdownMenuItem>
							</DropdownMenuGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
				<div className="space-y-2.5">
					<div className="flex items-center gap-2.5">
						<span className="text-2xl font-medium tracking-tight text-foreground tabular-nums">{value}</span>
						<Badge variant={positive ? "success-light" : "destructive-light"}>
							{positive ? <ArrowUpIcon aria-hidden="true" /> : <ArrowDownIcon aria-hidden="true" />}
							{delta}%
						</Badge>
					</div>
					<Separator />
					<div className="text-xs text-muted-foreground">
						Vs last month: <span className="font-medium text-foreground tabular-nums">{lastMonth}</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
