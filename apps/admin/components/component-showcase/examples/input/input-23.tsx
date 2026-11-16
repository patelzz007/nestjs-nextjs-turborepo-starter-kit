"use client";

import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { cn } from "@workspace/ui/lib/core/utils";
import { CheckIcon, EyeIcon, EyeOffIcon, XIcon } from "lucide-react";
import * as React from "react";
import { useCallback, useId, useState } from "react";

interface Requirement {
	readonly regex: RegExp;
	readonly text: string;
}

interface RequirementResult {
	readonly met: boolean;
	readonly text: string;
}

const REQUIREMENTS: readonly Requirement[] = [
	{ regex: /.{8,}/, text: "At least 8 characters" },
	{ regex: /[0-9]/, text: "At least 1 number" },
	{ regex: /[a-z]/, text: "At least 1 lowercase letter" },
	{ regex: /[A-Z]/, text: "At least 1 uppercase letter" },
	{ regex: /[!@#$%^&*(),.?":{}|<>]/, text: "At least 1 special character" },
];

/** One bar segment per requirement. */
const SEGMENT_IDS: readonly string[] = REQUIREMENTS.map((requirement: Requirement): string => requirement.text);
const MAX_SCORE = REQUIREMENTS.length;
const WEAK_MAX_SCORE = 2;
const MEDIUM_MAX_SCORE = 4;

function checkStrength(password: string): readonly RequirementResult[] {
	return REQUIREMENTS.map((requirement: Requirement): RequirementResult => ({ met: requirement.regex.test(password), text: requirement.text }));
}

/** Bar colour by score: 0 empty, 1 red, 2 orange, 3 amber, 4–5 green. */
const STRENGTH_COLORS: readonly string[] = ["bg-border", "bg-destructive", "bg-tone-orange", "bg-warning", "bg-success", "bg-success"];

function strengthColor(score: number): string {
	return STRENGTH_COLORS.at(score) ?? "bg-success";
}

function strengthText(score: number): string {
	if (score === 0) {
		return "Enter a password";
	}
	if (score <= WEAK_MAX_SCORE) {
		return "Weak security";
	}
	if (score <= MEDIUM_MAX_SCORE) {
		return "Medium security";
	}
	return "Strong security";
}

export function Input23Example(): React.JSX.Element {
	const id = useId();
	const [password, setPassword] = useState("");
	const [isVisible, setIsVisible] = useState<boolean>(false);

	const toggleVisibility = useCallback((): void => {
		setIsVisible((prevState: boolean): boolean => !prevState);
	}, []);
	const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setPassword(event.target.value);
	}, []);

	const strength = checkStrength(password);
	const strengthScore = strength.filter((requirement: RequirementResult): boolean => requirement.met).length;

	return (
		<div className="w-full max-w-xs">
			<Field>
				<FieldLabel htmlFor={id}>Secure Password</FieldLabel>
				<div className="relative">
					<Input
						aria-describedby={`${id}-description`}
						className="pe-9"
						id={id}
						onChange={handleChange}
						placeholder="Create a strong password"
						type={isVisible ? "text" : "password"}
						value={password}
					/>
					<button
						aria-controls={id}
						aria-label={isVisible ? "Hide password" : "Show password"}
						aria-pressed={isVisible}
						className="absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md text-muted-foreground/80 transition-[color,box-shadow] outline-none hover:text-foreground focus:z-10 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
						onClick={toggleVisibility}
						type="button">
						{isVisible ? <EyeOffIcon className="size-3.5" aria-hidden="true" /> : <EyeIcon className="size-3.5" aria-hidden="true" />}
					</button>
				</div>
			</Field>

			{/* Segmented Progress Bar */}
			<div aria-label="Password strength" aria-valuemax={MAX_SCORE} aria-valuemin={0} aria-valuenow={strengthScore} className="mt-3 mb-4 flex gap-1" role="progressbar">
				{SEGMENT_IDS.map((segmentId: string, position: number): React.JSX.Element => (
					<div
						key={segmentId}
						className={cn("h-1 flex-1 rounded-full transition-colors duration-500", position < strengthScore ? strengthColor(strengthScore) : "bg-border")}
					/>
				))}
			</div>

			<div className="mb-3 flex items-center justify-between">
				<p className="text-sm font-medium text-foreground" id={`${id}-description`}>
					{strengthText(strengthScore)}
				</p>
				<span className="text-xs text-muted-foreground">
					{String(strengthScore)}/{String(MAX_SCORE)} requirements met
				</span>
			</div>

			<ul aria-label="Password requirements" className="space-y-1.5">
				{strength.map((req: RequirementResult): React.JSX.Element => (
					<li className="flex items-center gap-1" key={req.text}>
						{req.met ? <CheckIcon className="size-3.5 text-success" aria-hidden="true" /> : <XIcon className="size-3.5 text-muted-foreground/60" aria-hidden="true" />}
						<span className={cn("text-xs transition-colors", req.met ? "text-success" : "text-muted-foreground")}>
							{req.text}
							<span className="sr-only">{req.met ? " - Requirement met" : " - Requirement not met"}</span>
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}
