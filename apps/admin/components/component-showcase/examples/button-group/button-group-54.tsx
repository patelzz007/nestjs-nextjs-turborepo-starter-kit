"use client";

import type * as React from "react";
import { ChevronDownIcon, Code2Icon } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";

const services: readonly string[] = ["Email API", "Payments API", "Repository API"];
const environments: readonly string[] = ["Production", "Staging", "Development"];
const versions: readonly string[] = ["v2", "v1", "beta"];

const [DEFAULT_SERVICE = ""] = services;
const [DEFAULT_ENVIRONMENT = ""] = environments;
const [DEFAULT_VERSION = ""] = versions;

const SERVICE_TRIGGER = <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs font-normal" aria-label="Select API service" />;
const ENVIRONMENT_TRIGGER = <Button variant="outline" size="sm" className="h-7 gap-1 text-xs font-normal text-muted-foreground" aria-label="Select environment" />;
const VERSION_TRIGGER = <Button variant="outline" size="sm" className="h-7 gap-1 font-mono text-xs text-muted-foreground" aria-label="Select API version" />;

interface ChoiceMenuItemProps {
	readonly choice: string;
	readonly onChoose: (choice: string) => void;
	readonly children: React.ReactNode;
}

/** A menu row that reports its own choice, so the menu binds one stable handler. */
function ChoiceMenuItem({ choice, onChoose, children }: ChoiceMenuItemProps): React.JSX.Element {
	const handleClick = useCallback((): void => {
		onChoose(choice);
	}, [choice, onChoose]);

	return <DropdownMenuItem onClick={handleClick}>{children}</DropdownMenuItem>;
}

export function ButtonGroup54Example(): React.JSX.Element {
	const [service, setService] = useState<string>(DEFAULT_SERVICE);
	const [environment, setEnvironment] = useState<string>(DEFAULT_ENVIRONMENT);
	const [version, setVersion] = useState<string>(DEFAULT_VERSION);

	const handleService = useCallback((choice: string): void => {
		setService(choice);
	}, []);
	const handleEnvironment = useCallback((choice: string): void => {
		setEnvironment(choice);
	}, []);
	const handleVersion = useCallback((choice: string): void => {
		setVersion(choice);
	}, []);

	return (
		<ButtonGroup>
			<DropdownMenu>
				<DropdownMenuTrigger render={SERVICE_TRIGGER}>
					<Code2Icon className="size-3.5 opacity-60" aria-hidden="true" />
					{service}
					<ChevronDownIcon className="size-3 opacity-60" aria-hidden="true" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-40">
					<DropdownMenuGroup>
						{services.map((item) => (
							<ChoiceMenuItem key={item} choice={item} onChoose={handleService}>
								{item}
							</ChoiceMenuItem>
						))}
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>

			<DropdownMenu>
				<DropdownMenuTrigger render={ENVIRONMENT_TRIGGER}>
					{environment}
					<ChevronDownIcon className="size-3 opacity-60" aria-hidden="true" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-36">
					<DropdownMenuGroup>
						{environments.map((item) => (
							<ChoiceMenuItem key={item} choice={item} onChoose={handleEnvironment}>
								{item}
							</ChoiceMenuItem>
						))}
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>

			<DropdownMenu>
				<DropdownMenuTrigger render={VERSION_TRIGGER}>
					{version}
					<ChevronDownIcon className="size-3 opacity-60" aria-hidden="true" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-24">
					<DropdownMenuGroup>
						{versions.map((item) => (
							<ChoiceMenuItem key={item} choice={item} onChoose={handleVersion}>
								<span className="font-mono">{item}</span>
							</ChoiceMenuItem>
						))}
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</ButtonGroup>
	);
}
