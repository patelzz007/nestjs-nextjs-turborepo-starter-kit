"use client";

import * as React from "react";
import { CalendarClockIcon, CalendarIcon, SquareCheckIcon, UsersIcon } from "lucide-react";
import { useState } from "react";

import { Card, CardContent } from "@workspace/ui/components/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";

export function Tabs9Example(): React.JSX.Element {
	const [period, setPeriod] = useState("monthly");

	return (
		<div className="mx-auto flex w-full max-w-xs flex-col items-center gap-6">
			<Tabs value={period} onValueChange={setPeriod}>
				<TabsList className="w-full">
					<TabsTrigger value="daily" className="gap-1.5">
						<CalendarIcon className="size-3.5" />
						Daily
					</TabsTrigger>
					<TabsTrigger value="weekly" className="gap-1.5">
						<SquareCheckIcon className="size-4" />
						Weekly
					</TabsTrigger>
					<TabsTrigger value="monthly" className="gap-1.5">
						<UsersIcon className="size-4" />
						Monthly
					</TabsTrigger>
					<TabsTrigger value="yearly" className="gap-1.5">
						<CalendarClockIcon className="size-3.5" />
						Yearly
					</TabsTrigger>
				</TabsList>
				<TabsContent value="daily">
					<Card>
						<CardContent className="text-center">
							<p className="text-3xl font-bold">1,284</p>
							<p className="mt-1 text-sm text-muted-foreground">Visitors today</p>
						</CardContent>
					</Card>
				</TabsContent>
				<TabsContent value="weekly">
					<Card>
						<CardContent className="text-center">
							<p className="text-3xl font-bold">8,942</p>
							<p className="mt-1 text-sm text-muted-foreground">Visitors this week</p>
						</CardContent>
					</Card>
				</TabsContent>
				<TabsContent value="monthly">
					<Card>
						<CardContent className="text-center">
							<p className="text-3xl font-bold">32,156</p>
							<p className="mt-1 text-sm text-muted-foreground">Visitors this month</p>
						</CardContent>
					</Card>
				</TabsContent>
				<TabsContent value="yearly">
					<Card>
						<CardContent className="text-center">
							<p className="text-3xl font-bold">384,721</p>
							<p className="mt-1 text-sm text-muted-foreground">Visitors this year</p>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
