"use client";

import { Autocomplete, AutocompleteContent, AutocompleteInput, AutocompleteItem, AutocompleteList, AutocompleteStatus } from "@workspace/ui/components/autocomplete";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { LoaderCircleIcon } from "lucide-react";
import * as React from "react";

import { containsQuery, initialsOf } from "@/components/component-gallery/examples/autocomplete/autocomplete-sample-data";

interface Developer {
	readonly id: string;
	readonly name: string;
	readonly role: string;
	readonly location: string;
	readonly skills: readonly string[];
}

/** How long the simulated directory search takes to answer (ms). */
const SEARCH_LATENCY_MS = 400;

/** Typing this query makes the simulated search fail, to show the error status. */
const FAILING_QUERY = "error";

const NO_DEVELOPERS: readonly Developer[] = [];

const DEVELOPERS: readonly Developer[] = [
	{ id: "alex-chen", name: "Alex Chen", role: "Senior Full-Stack Developer", location: "San Francisco, CA", skills: ["React", "Node.js", "TypeScript", "AWS", "Docker"] },
	{ id: "sarah-johnson", name: "Sarah Johnson", role: "Frontend Architect", location: "New York, NY", skills: ["Vue.js", "JavaScript", "CSS", "Webpack", "Figma"] },
	{ id: "michael-rodriguez", name: "Michael Rodriguez", role: "Backend Engineer", location: "Austin, TX", skills: ["Python", "Django", "PostgreSQL", "Redis", "Kubernetes"] },
	{ id: "emily-wang", name: "Emily Wang", role: "DevOps Engineer", location: "Seattle, WA", skills: ["AWS", "Terraform", "Jenkins", "Docker", "Linux"] },
	{ id: "david-kim", name: "David Kim", role: "Mobile Developer", location: "Los Angeles, CA", skills: ["React Native", "Swift", "Kotlin", "Firebase", "GraphQL"] },
	{ id: "lisa-thompson", name: "Lisa Thompson", role: "Data Engineer", location: "Boston, MA", skills: ["Python", "Spark", "Airflow", "Snowflake", "dbt"] },
	{
		id: "james-wilson",
		name: "James Wilson",
		role: "Cloud Solutions Architect",
		location: "Chicago, IL",
		skills: ["AWS", "Azure", "Terraform", "Kubernetes", "Microservices"],
	},
	{ id: "maria-garcia", name: "Maria Garcia", role: "UI/UX Developer", location: "Miami, FL", skills: ["React", "Figma", "CSS-in-JS", "Storybook", "Accessibility"] },
	{ id: "robert-taylor", name: "Robert Taylor", role: "Machine Learning Engineer", location: "Denver, CO", skills: ["Python", "TensorFlow", "PyTorch", "MLOps", "Docker"] },
	{
		id: "jennifer-lee",
		name: "Jennifer Lee",
		role: "Blockchain Developer",
		location: "San Diego, CA",
		skills: ["Solidity", "Web3.js", "Ethereum", "Smart Contracts", "Rust"],
	},
	{
		id: "christopher-brown",
		name: "Christopher Brown",
		role: "Security Engineer",
		location: "Portland, OR",
		skills: ["Cybersecurity", "Penetration Testing", "OWASP", "SIEM", "Python"],
	},
	{ id: "amanda-davis", name: "Amanda Davis", role: "Game Developer", location: "Orlando, FL", skills: ["Unity", "C#", "Unreal Engine", "3D Modeling", "VR/AR"] },
	{ id: "kevin-zhang", name: "Kevin Zhang", role: "AI Research Engineer", location: "Palo Alto, CA", skills: ["Python", "PyTorch", "Transformers", "NLP", "Computer Vision"] },
	{ id: "rachel-green", name: "Rachel Green", role: "QA Automation Engineer", location: "Phoenix, AZ", skills: ["Selenium", "Cypress", "Jest", "Python", "Test Automation"] },
	{
		id: "daniel-martinez",
		name: "Daniel Martinez",
		role: "System Administrator",
		location: "Dallas, TX",
		skills: ["Linux", "Windows Server", "Active Directory", "PowerShell", "VMware"],
	},
	{
		id: "sophie-anderson",
		name: "Sophie Anderson",
		role: "Product Manager",
		location: "San Jose, CA",
		skills: ["Product Strategy", "Agile", "Analytics", "User Research", "Figma"],
	},
	{
		id: "mark-thompson",
		name: "Mark Thompson",
		role: "Database Administrator",
		location: "Atlanta, GA",
		skills: ["PostgreSQL", "MySQL", "MongoDB", "Redis", "Performance Tuning"],
	},
	{
		id: "jessica-white",
		name: "Jessica White",
		role: "Technical Writer",
		location: "Raleigh, NC",
		skills: ["Technical Writing", "Markdown", "API Documentation", "Git", "Confluence"],
	},
	{
		id: "andrew-clark",
		name: "Andrew Clark",
		role: "Site Reliability Engineer",
		location: "Nashville, TN",
		skills: ["Monitoring", "Incident Response", "Python", "Terraform", "Kubernetes"],
	},
	{ id: "nicole-taylor", name: "Nicole Taylor", role: "Frontend Developer", location: "Minneapolis, MN", skills: ["Angular", "TypeScript", "RxJS", "SCSS", "Jest"] },
	{ id: "ryan-murphy", name: "Ryan Murphy", role: "Backend Developer", location: "Kansas City, MO", skills: ["Java", "Spring Boot", "Microservices", "MongoDB", "Docker"] },
	{
		id: "stephanie-lewis",
		name: "Stephanie Lewis",
		role: "Full-Stack Developer",
		location: "Salt Lake City, UT",
		skills: ["React", "Node.js", "GraphQL", "PostgreSQL", "AWS"],
	},
	{ id: "brandon-wright", name: "Brandon Wright", role: "Cloud Engineer", location: "Las Vegas, NV", skills: ["AWS", "Terraform", "Docker", "Kubernetes", "Python"] },
	{ id: "ashley-hall", name: "Ashley Hall", role: "DevOps Engineer", location: "Columbus, OH", skills: ["CI/CD", "Jenkins", "GitLab", "Docker", "AWS"] },
	{ id: "tyler-young", name: "Tyler Young", role: "Mobile App Developer", location: "Tampa, FL", skills: ["Flutter", "Dart", "Firebase", "REST APIs", "Git"] },
];

/** The settled answer for one query: the matches, or a failure. */
type SearchOutcome = { readonly query: string; readonly status: "found"; readonly developers: readonly Developer[] } | { readonly query: string; readonly status: "failed" };

/** The simulated directory search (sample data only — no network call). */
function searchDevelopers(query: string): SearchOutcome {
	if (query === FAILING_QUERY) {
		return { query, status: "failed" };
	}
	const developers = DEVELOPERS.filter(
		(developer: Developer): boolean =>
			containsQuery(developer.name, query) ||
			containsQuery(developer.role, query) ||
			containsQuery(developer.location, query) ||
			developer.skills.some((skill: string): boolean => containsQuery(skill, query)),
	);
	return { query, status: "found", developers };
}

function developerName(developer: Developer): string {
	return developer.name;
}

function renderDeveloper(developer: Developer): React.JSX.Element {
	return (
		<AutocompleteItem key={developer.id} value={developer} className="rounded-lg">
			<div className="flex items-center gap-2.5 truncate">
				<Avatar className="size-9">
					<AvatarFallback>{initialsOf(developer.name)}</AvatarFallback>
				</Avatar>
				<div className="min-w-0 flex-1">
					<div className="truncate font-medium">{developer.name}</div>
					<div className="truncate text-sm text-muted-foreground">
						{developer.role} • {developer.location}
					</div>
				</div>
			</div>
		</AutocompleteItem>
	);
}

function resultCountLabel(count: number): string {
	return count === 1 ? "1 developer found" : `${String(count)} developers found`;
}

export function Autocomplete9Example(): React.JSX.Element {
	const [searchValue, setSearchValue] = React.useState("");
	const [outcome, setOutcome] = React.useState<SearchOutcome | null>(null);

	// Answer each query after a short delay; a newer query cancels the pending one.
	React.useEffect((): (() => void) | undefined => {
		if (searchValue === "") {
			return undefined;
		}
		const timeoutId = window.setTimeout((): void => {
			setOutcome(searchDevelopers(searchValue));
		}, SEARCH_LATENCY_MS);
		return (): void => {
			window.clearTimeout(timeoutId);
		};
	}, [searchValue]);

	// Only an answer to the current query counts; anything older means a search is in flight.
	const settled = outcome?.query === searchValue ? outcome : null;
	const developers = settled?.status === "found" ? settled.developers : NO_DEVELOPERS;

	let status: React.ReactNode;
	if (settled === null) {
		status = (
			<div className="flex items-center gap-2">
				<LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
				Searching developers...
			</div>
		);
	} else if (settled.status === "failed") {
		status = "Failed to fetch developers. Please try again.";
	} else if (developers.length === 0) {
		status = `No developers found for "${searchValue}"`;
	} else {
		status = resultCountLabel(developers.length);
	}

	return (
		<div className="w-full max-w-xs">
			<Autocomplete items={developers} value={searchValue} onValueChange={setSearchValue} itemToStringValue={developerName} filter={null}>
				<AutocompleteInput placeholder="e.g. John Smith, React, San Francisco" showTrigger showClear />
				{searchValue === "" ? null : (
					<AutocompleteContent>
						<AutocompleteStatus>{status}</AutocompleteStatus>
						<AutocompleteList>{renderDeveloper}</AutocompleteList>
					</AutocompleteContent>
				)}
			</Autocomplete>
		</div>
	);
}
