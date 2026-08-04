import { readFileSync } from "node:fs";

const content = readFileSync("docs/ui-components.md", "utf8");
const lines = content.split("\n");

// Parse sections: component sections start with "## Name — `...`" or "## Summary".
const components = [];
let current = null;

for (const line of lines) {
	if (line.startsWith("## ")) {
		if (current) components.push(current);
		current = { title: line.replace(/^## /, "").trim(), sub: null, improvements: 0, features: 0 };
	} else if (line.startsWith("### 🔧 Improvements")) {
		if (current) current.sub = "improvements";
	} else if (line.startsWith("### 🚀 New Features")) {
		if (current) current.sub = "features";
	} else if (/^\d+\.\s/.test(line)) {
		if (current?.sub === "improvements") current.improvements++;
		if (current?.sub === "features") current.features++;
	}
}
if (current) components.push(current);

let problems = 0;
for (const c of components) {
	const isComponent = c.title.includes("`components/"); // e.g. `components/toggle.tsx`
	if (!isComponent) {
		console.log(`SKIP (non-component): ${c.title}`);
		continue;
	}
	const ok = c.improvements === 20 && c.features === 20;
	if (!ok) {
		problems++;
		console.log(`PROBLEM: ${c.title} -> improvements=${c.improvements}, features=${c.features}`);
	}
}

const componentCount = components.filter((c) => c.title.includes("`components/")).length;
console.log(`Component sections: ${componentCount}`);
console.log(`Total improvements: ${components.reduce((a, c) => a + c.improvements, 0)}`);
console.log(`Total features: ${components.reduce((a, c) => a + c.features, 0)}`);
console.log(problems === 0 ? "ALL COMPONENT SECTIONS: 20 improvements + 20 features ✓" : `${problems} section(s) need fixing`);
