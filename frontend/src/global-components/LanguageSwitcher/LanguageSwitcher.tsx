import { useId } from 'react';
import { useTranslation } from 'react-i18next';

// Lists the languages configured in app/i18n.ts, each named in its own language.
export function LanguageSwitcher() {
	const { t, i18n } = useTranslation();
	const id = useId();
	const languages = (i18n.options.supportedLngs || []).filter(
		(language) => language !== 'cimode',
	);

	return (
		<div className="flex shrink-0 items-center">
			<label htmlFor={id} className="sr-only">
				{t('language.label')}
			</label>
			<select
				id={id}
				className="select select-sm w-auto"
				value={i18n.resolvedLanguage}
				onChange={(event) => void i18n.changeLanguage(event.target.value)}
			>
				{languages.map((language) => (
					<option key={language} value={language} lang={language}>
						{new Intl.DisplayNames([language], { type: 'language' }).of(language)}
					</option>
				))}
			</select>
		</div>
	);
}
