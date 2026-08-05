"use client";

import * as React from "react";

import data from "@/data/dashboard-data.json";

import { ChartAreaInteractive } from "@/components/dashboard/chart-area-interactive";
import { DataTable } from "@/components/dashboard/data-table";
import { SectionCards } from "@/components/dashboard/section-cards";

export default function Page(): React.JSX.Element {
	return (
		<div className="@container/main flex flex-1 flex-col gap-2">
			<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
				<SectionCards />
				<div className="px-4 lg:px-6">
					<ChartAreaInteractive />
				</div>
				<DataTable data={data} />
			</div>
		</div>
	);
}
