import {StringSetting} from './settings_types.js';

const defaultLanguage: Record<string, string> = {
      },
      overDefault = (pack: Record<string, string>) => {
	for (const s in defaultLanguage) {
		if (!pack[s]) {
			pack[s] = defaultLanguage[s];
		}
		return pack;
	}
      },
      languagePacks: Record<string, Record<string, string>> = {
	"en-GB": defaultLanguage,
	"en": defaultLanguage,
      };

export const languages: string[] = Object.keys(languagePacks),
language = new StringSetting("language", navigator.language);

export default Object.freeze(languagePacks[language.value] ?? defaultLanguage);
