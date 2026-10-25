"use client";

import { NetworkQualityIndicator } from "@workspace/ui/components/network-quality-indicator";
import type { JSX } from "react";

import { useNetworkQuality } from "./use-network-quality";

/**
 * The connection indicator of the admin, web and merchant shells (their sidebar's status row): the shared
 * `NetworkQualityIndicator` fed by this browser's measurement of the API (`useNetworkQuality`).
 */
export function NetworkQualityStatus(): JSX.Element {
	const { reading, testing, testAgain } = useNetworkQuality();
	return <NetworkQualityIndicator reading={reading} testing={testing} onTestAgain={testAgain} />;
}
