"use client";

import * as React from "react";
import { AtSignIcon, CalendarClockIcon, HashIcon, SquareCheckIcon, TypeIcon, UserIcon, UsersIcon } from "lucide-react";
import { useState } from "react";
import { Cascader, CascaderContent, CascaderEmpty, CascaderList, CascaderPanel, CascaderStatus, CascaderTrigger } from "@workspace/ui/components/cascader/cascader";
import { CascaderItems } from "@workspace/ui/components/cascader/cascader-item";
import { CascaderBreadcrumb, CascaderInput, CascaderNav, CascaderValue } from "@workspace/ui/components/cascader/cascader-nav";
import type { CascaderNode } from "@workspace/ui/components/cascader/cascader-types";

import { Button } from "@workspace/ui/components/button";

/** The trigger collapses longer paths to their last segments. */
const TRIGGER_MAX_SEGMENTS = 3;

const textIcon = <TypeIcon className="size-4" />;
const hashIcon = <HashIcon className="size-4" />;
const usersIcon = <UsersIcon className="size-4" />;
const mailIcon = <AtSignIcon className="size-4" />;
const checkIcon = <SquareCheckIcon className="size-4" />;
const clockIcon = <CalendarClockIcon className="size-4" />;
const userIcon = <UserIcon className="size-4" />;

const attributes: CascaderNode[] = [
	{ value: "record-id", label: "Record ID", icon: hashIcon },
	{
		value: "person",
		label: "Person",
		icon: usersIcon,
		count: 24,
		children: [
			{ value: "person.name", label: "Name", icon: textIcon },
			{
				value: "person.email",
				label: "Email addresses",
				icon: mailIcon,
				keywords: ["mail"],
			},
			{ value: "person.title", label: "Job title", icon: textIcon },
			{
				value: "person.company",
				label: "Company",
				icon: usersIcon,
				count: 8,
				children: [
					{
						value: "person.company.name",
						label: "Company name",
						icon: textIcon,
					},
					{ value: "person.company.domain", label: "Domain", icon: textIcon },
					{
						value: "person.company.employees",
						label: "Employees",
						icon: hashIcon,
					},
				],
			},
		],
	},
	{
		value: "email",
		label: "Primary email address",
		icon: mailIcon,
		keywords: ["mail"],
	},
	{ value: "user-id", label: "User ID", icon: textIcon },
	{
		value: "workspaces",
		label: "Workspaces",
		icon: usersIcon,
		count: 9,
		children: [
			{ value: "workspaces.name", label: "Name", icon: textIcon },
			{ value: "workspaces.plan", label: "Plan", icon: textIcon },
			{ value: "workspaces.seats", label: "Seats", icon: hashIcon },
		],
	},
	{
		value: "next-task",
		label: "Next due task",
		icon: checkIcon,
		count: 1,
		children: [{ value: "next-task.due", label: "Due date", icon: clockIcon }],
	},
	{ value: "created-at", label: "Created at", icon: clockIcon },
	{ value: "created-by", label: "Created by", icon: userIcon },
];

export function Cascader1Example(): React.JSX.Element {
	const [value, setValue] = useState("");

	return (
		<div className="flex w-full justify-center p-4">
			<Cascader items={attributes} value={value} onValueChange={setValue}>
				<CascaderTrigger aria-label="Attribute" render={<Button variant="outline" className="w-72 justify-between gap-2 font-normal" />}>
					<CascaderValue placeholder="Select an attribute" maxSegments={TRIGGER_MAX_SEGMENTS} />
				</CascaderTrigger>

				<CascaderContent className="w-80">
					<CascaderPanel>
						<CascaderNav>
							<CascaderInput />
						</CascaderNav>
						<CascaderBreadcrumb />
						<CascaderEmpty />
						<CascaderList>
							<CascaderItems />
						</CascaderList>
						<CascaderStatus />
					</CascaderPanel>
				</CascaderContent>
			</Cascader>
		</div>
	);
}
