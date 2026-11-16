import LanguagesIcon from "lucide-react-native/icons/languages";
import { DateSelectorField, type DateSelectorLabels } from "@workspace/ui-native/components/date-selector";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import type { WeekStart } from "@workspace/ui-native/lib/calendar";
import type { DateSelectorDayFormat, DateSelectorValue } from "@workspace/ui-native/lib/date-selector";
import * as React from "react";
import { View } from "react-native";
import { z } from "zod";

import { SAMPLE_TODAY } from "../example-support";

/** The years the selector offers. */
const MIN_YEAR = 2020;
const MAX_YEAR = 2030;
const LanguageSchema = z.enum(["en", "es", "fr", "de"]);
type Language = z.output<typeof LanguageSchema>;

interface LanguageSetup {
	readonly locale: string;
	readonly dayFormat: DateSelectorDayFormat;
	readonly weekStartsOn: WeekStart;
	readonly label: string;
	readonly labels: Partial<DateSelectorLabels>;
}

const SETUPS: Readonly<Record<Language, LanguageSetup>> = {
	en: { locale: "en-US", dayFormat: "MM/dd/yyyy", weekStartsOn: 0, label: "Due date", labels: {} },
	es: {
		locale: "es-ES",
		dayFormat: "dd/MM/yyyy",
		weekStartsOn: 1,
		label: "Fecha límite",
		labels: {
			selectDate: "Elegir fecha",
			apply: "Aplicar",
			cancel: "Cancelar",
			clear: "Borrar",
			today: "Hoy",
			filterTypes: { is: "Es", before: "Antes", after: "Después", between: "Entre" },
			periodTypes: { day: "Día", month: "Mes", quarter: "Trimestre", "half-year": "Semestre", year: "Año" },
			monthsShort: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"],
			placeholder: "Escribe una fecha, T1 2026 o 2026",
		},
	},
	fr: {
		locale: "fr-FR",
		dayFormat: "dd/MM/yyyy",
		weekStartsOn: 1,
		label: "Échéance",
		labels: {
			selectDate: "Choisir une date",
			apply: "Appliquer",
			cancel: "Annuler",
			clear: "Effacer",
			today: "Aujourd’hui",
			filterTypes: { is: "Le", before: "Avant", after: "Après", between: "Entre" },
			periodTypes: { day: "Jour", month: "Mois", quarter: "Trimestre", "half-year": "Semestre", year: "Année" },
			monthsShort: ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."],
			placeholder: "Saisissez une date, T1 2026 ou 2026",
		},
	},
	de: {
		locale: "de-DE",
		dayFormat: "dd.MM.yyyy",
		weekStartsOn: 1,
		label: "Fälligkeitsdatum",
		labels: {
			selectDate: "Datum wählen",
			apply: "Übernehmen",
			cancel: "Abbrechen",
			clear: "Leeren",
			today: "Heute",
			filterTypes: { is: "Am", before: "Vor", after: "Nach", between: "Zwischen" },
			periodTypes: { day: "Tag", month: "Monat", quarter: "Quartal", "half-year": "Halbjahr", year: "Jahr" },
			monthsShort: ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."],
			placeholder: "Datum, Q1 2026 oder 2026 eingeben",
		},
	},
};

const NAMES: Readonly<Record<Language, string>> = { en: "English", es: "Español", fr: "Français", de: "Deutsch" };
const LANGUAGES: readonly Language[] = LanguageSchema.options;
const INITIAL: DateSelectorValue = { period: "day", operator: "is", startDate: SAMPLE_TODAY };

export function DateSelector4Example(): React.JSX.Element {
	const [language, setLanguage] = React.useState<Language>("en");
	const [value, setValue] = React.useState<DateSelectorValue>(INITIAL);
	const setup = SETUPS[language];
	const choose = React.useCallback((code: string): void => {
		const parsed = LanguageSchema.safeParse(code);
		if (parsed.success) {
			setLanguage(parsed.data);
		}
	}, []);
	const items = React.useMemo(
		(): readonly DropdownMenuItemData<Language>[] =>
			LANGUAGES.map((code: Language): DropdownMenuItemData<Language> => ({ value: code, label: NAMES[code], kind: "radio", checked: code === language })),
		[language],
	);
	return (
		<View className="gap-3">
			<DropdownMenu label={NAMES[language]} icon={LanguagesIcon} items={items} onSelect={choose} variant="outline" className="self-start" />
			<DateSelectorField
				label={setup.label}
				today={SAMPLE_TODAY}
				minYear={MIN_YEAR}
				maxYear={MAX_YEAR}
				locale={setup.locale}
				dayFormat={setup.dayFormat}
				weekStartsOn={setup.weekStartsOn}
				labels={setup.labels}
				value={value}
				onChange={setValue}
			/>
		</View>
	);
}
