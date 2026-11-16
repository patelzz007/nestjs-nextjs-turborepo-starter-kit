// The environment the CLIs read. `.env.example` lists every variable with an empty value (`NAME=`), and a copied
// file keeps those lines until each is filled in. An empty value means "not set yet", never "set to nothing", so
// it is dropped here: an optional variable then counts as absent, and a required one gets its own clear message.

/** The variables that hold a value; any that are empty or only whitespace are left out. */
export function setVariables(environment: Readonly<Record<string, string | undefined>>): Readonly<Record<string, string>> {
	return Object.fromEntries(Object.entries(environment).flatMap(([name, value]): [string, string][] => (value === undefined || value.trim() === "" ? [] : [[name, value]])));
}
