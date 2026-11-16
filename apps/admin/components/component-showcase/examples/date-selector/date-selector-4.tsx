"use client";

import * as React from "react";
import { CalendarIcon, ChevronDownIcon } from "lucide-react";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { useCallback, useState } from "react";
import { z } from "zod";
import { DateSelector, formatDateValue, type DateSelectorValue } from "@workspace/ui/components/date-selector";

import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";

// Language-specific translations
type DateSelectorLabelsOverride = UiKitLabelsOverride<"dateSelector">;

/** Each non-English pack overrides the English copy the app's `UiKitLabelsProvider` supplies. */
const translations: Readonly<Record<"es" | "fr" | "de", DateSelectorLabelsOverride>> = {
	es: {
		selectDate: "Seleccionar fecha",
		apply: "Aplicar",
		cancel: "Cancelar",
		clear: "Limpiar",
		today: "Hoy",
		filterTypes: {
			is: "es",
			before: "antes de",
			after: "después de",
			between: "entre",
		},
		periodTypes: {
			day: "Día",
			month: "Mes",
			quarter: "Trimestre",
			halfYear: "Semestre",
			year: "Año",
		},
		months: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"],
		monthsShort: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
		quarters: ["T1", "T2", "T3", "T4"],
		halfYears: ["S1", "S2"],
		weekdays: ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
		weekdaysShort: ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"],
		placeholder: "Seleccionar fecha...",
		rangePlaceholder: "Seleccionar rango de fechas...",
	},
	fr: {
		selectDate: "Sélectionner une date",
		apply: "Appliquer",
		cancel: "Annuler",
		clear: "Effacer",
		today: "Aujourd'hui",
		filterTypes: {
			is: "est",
			before: "avant",
			after: "après",
			between: "entre",
		},
		periodTypes: {
			day: "Jour",
			month: "Mois",
			quarter: "Trimestre",
			halfYear: "Semestre",
			year: "Année",
		},
		months: ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"],
		monthsShort: ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"],
		quarters: ["T1", "T2", "T3", "T4"],
		halfYears: ["S1", "S2"],
		weekdays: ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"],
		weekdaysShort: ["Di", "Lu", "Ma", "Me", "Je", "Ve", "Sa"],
		placeholder: "Sélectionner une date...",
		rangePlaceholder: "Sélectionner une plage de dates...",
	},
	de: {
		selectDate: "Datum auswählen",
		apply: "Anwenden",
		cancel: "Abbrechen",
		clear: "Löschen",
		today: "Heute",
		filterTypes: {
			is: "ist",
			before: "vor",
			after: "nach",
			between: "zwischen",
		},
		periodTypes: {
			day: "Tag",
			month: "Monat",
			quarter: "Quartal",
			halfYear: "Halbjahr",
			year: "Jahr",
		},
		months: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
		monthsShort: ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
		quarters: ["Q1", "Q2", "Q3", "Q4"],
		halfYears: ["H1", "H2"],
		weekdays: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
		weekdaysShort: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
		placeholder: "Datum auswählen...",
		rangePlaceholder: "Datumsbereich auswählen...",
	},
};

// Language metadata
const LanguageSchema = z.enum(["en", "es", "fr", "de"]);
type LanguageCode = z.infer<typeof LanguageSchema>;
type WeekStart = NonNullable<React.ComponentProps<typeof DateSelector>["weekStartsOn"]>;

interface LanguageMeta {
	readonly label: string;
	readonly flag: string;
	readonly dateFormat: string;
	readonly weekStartsOn: WeekStart;
	/** The selector copy laid over the English pack (none for English itself). */
	readonly labels: DateSelectorLabelsOverride | undefined;
	readonly ui: { readonly label: string; readonly hint: string; readonly placeholder: string };
}

const languageMetadata: Readonly<Record<LanguageCode, LanguageMeta>> = {
	en: {
		label: "English",
		flag: "🇺🇸",
		dateFormat: "MM/dd/yyyy",
		weekStartsOn: 0,
		labels: undefined,
		ui: {
			label: "Due date",
			hint: "Try: 2025, Q4, 05/10/2025",
			placeholder: "Select a date",
		},
	},
	es: {
		label: "Español",
		flag: "🇪🇸",
		dateFormat: "dd/MM/yyyy",
		weekStartsOn: 1,
		labels: translations.es,
		ui: {
			label: "Fecha de vencimiento",
			hint: "Prueba: 2025, T4, 05/10/2025",
			placeholder: "Seleccionar una fecha",
		},
	},
	fr: {
		label: "Français",
		flag: "🇫🇷",
		dateFormat: "dd/MM/yyyy",
		weekStartsOn: 1,
		labels: translations.fr,
		ui: {
			label: "Date d'échéance",
			hint: "Essayez: 2025, T4, 05/10/2025",
			placeholder: "Sélectionner une date",
		},
	},
	de: {
		label: "Deutsch",
		flag: "🇩🇪",
		dateFormat: "dd.MM.yyyy",
		weekStartsOn: 1,
		labels: translations.de,
		ui: {
			label: "Fälligkeitsdatum",
			hint: "Versuchen Sie: 2025, Q4, 05.10.2025",
			placeholder: "Datum auswählen",
		},
	},
};

// Language options for the selector
const languageOptions: readonly { readonly value: LanguageCode; readonly label: string; readonly flag: string }[] = LanguageSchema.options.map((value: LanguageCode) => ({
	value,
	label: languageMetadata[value].label,
	flag: languageMetadata[value].flag,
}));

export function DateSelector4Example(): React.JSX.Element {
	const [value, setValue] = useState<DateSelectorValue | undefined>();
	const [open, setOpen] = useState(false);
	const [internalValue, setInternalValue] = useState<DateSelectorValue | undefined>(value);
	const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>("fr");

	const currentMeta = languageMetadata[currentLanguage];
	// The resolved copy for the chosen language: what the selector itself shows, and what the trigger formats with.
	const currentI18n = useUiKitLabels("dateSelector", currentMeta.labels);

	const formattedValue = value ? formatDateValue(value, currentI18n, currentMeta.dateFormat) : "";
	const displayText = formattedValue === "" ? currentMeta.ui.placeholder : formattedValue;

	/** Opening starts the draft from the applied value; closing just closes. */
	const handleOpenChange = useCallback(
		(nextOpen: boolean): void => {
			if (nextOpen) {
				setInternalValue(value);
			}
			setOpen(nextOpen);
		},
		[value],
	);

	const handleApply = useCallback((): void => {
		setValue(internalValue);
		setOpen(false);
	}, [internalValue]);

	const handleCancel = useCallback((): void => {
		setInternalValue(value);
		setOpen(false);
	}, [value]);

	const handleLanguageClick = useCallback((event: React.MouseEvent<HTMLElement>): void => {
		const parsed = LanguageSchema.safeParse(event.currentTarget.dataset.language);
		if (parsed.success) {
			setCurrentLanguage(parsed.data);
		}
	}, []);

	return (
		<div className="flex h-full w-full grow flex-col items-stretch gap-4">
			<div className="flex w-full justify-end">
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button variant="outline" size="sm" className="flex items-center gap-2">
								<span>{currentMeta.flag}</span>
								<span>{currentMeta.label}</span>
								<ChevronDownIcon />
							</Button>
						}
					/>
					<DropdownMenuContent align="start">
						{languageOptions.map((lang) => (
							<DropdownMenuItem key={lang.value} data-language={lang.value} onClick={handleLanguageClick} className="flex items-center gap-2">
								<span>{lang.flag}</span>
								<span>{lang.label}</span>
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			<div className="flex grow items-center justify-center">
				<Dialog open={open} onOpenChange={handleOpenChange}>
					<DialogTrigger
						render={
							<Button variant="outline" className="w-56 justify-start">
								<CalendarIcon />
								{displayText}
							</Button>
						}
					/>
					<DialogContent className="sm:max-w-lg" showCloseButton={false}>
						<DialogHeader>
							<DialogTitle>{currentMeta.ui.label}</DialogTitle>
						</DialogHeader>
						<DateSelector
							value={internalValue}
							onChange={setInternalValue}
							showInput
							i18n={currentMeta.labels}
							dayDateFormat={currentMeta.dateFormat}
							weekStartsOn={currentMeta.weekStartsOn}
						/>
						<DialogFooter>
							<DialogClose
								render={
									<Button variant="outline" onClick={handleCancel}>
										{currentI18n.cancel}
									</Button>
								}
							/>
							<Button onClick={handleApply}>{currentI18n.apply}</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		</div>
	);
}
