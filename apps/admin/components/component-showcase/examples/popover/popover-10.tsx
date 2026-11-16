"use client";

import * as React from "react";
import { SettingsIcon } from "lucide-react";
import { isArrayValue } from "@workspace/shared";
import { useCallback, useState } from "react";

import { Button } from "@workspace/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { Slider } from "@workspace/ui/components/slider";
import { Switch } from "@workspace/ui/components/switch";

const DEFAULT_VOLUME = 75;
const VOLUME_MAX = 100;
const VOLUME_STEP = 1;
const INITIAL_VOLUME: readonly number[] = [DEFAULT_VOLUME];

export function Popover10Example(): React.JSX.Element {
	const [volume, setVolume] = useState<readonly number[]>(INITIAL_VOLUME);
	const [volumePercent = DEFAULT_VOLUME] = volume;

	const handleVolumeChange = useCallback((next: number | readonly number[]): void => {
		setVolume(isArrayValue(next) ? next : [next]);
	}, []);

	return (
		<div className="flex min-h-[100px] items-center justify-center">
			<Popover>
				<PopoverTrigger render={<Button variant="outline" size="icon" />}>
					<SettingsIcon aria-hidden="true" />
				</PopoverTrigger>
				<PopoverContent className="w-72 gap-0 p-0" align="end">
					<div className="border-b p-3">
						<h4 className="m-0 font-medium">Quick Settings</h4>
						<p className="text-muted-foreground">Adjust your preferences.</p>
					</div>
					<div className="space-y-3 p-3 pb-4">
						<div className="flex items-center justify-between">
							<label htmlFor="qs-dark">Dark Mode</label>
							<Switch id="qs-dark" />
						</div>
						<div className="flex items-center justify-between">
							<label htmlFor="qs-notif">Notifications</label>
							<Switch id="qs-notif" defaultChecked />
						</div>
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<label htmlFor="qs-volume">Volume</label>
								<span className="text-muted-foreground">{String(volumePercent)}%</span>
							</div>
							<Slider id="qs-volume" value={volume} onValueChange={handleVolumeChange} max={VOLUME_MAX} step={VOLUME_STEP} />
						</div>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}
