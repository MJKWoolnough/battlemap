import {StringSetting} from './settings_types.js';

type Lang = {

}

const defaultLanguage: Lang = {},
      languagePacks: Record<string, Lang> = {
	"en-GB": defaultLanguage,
	"en": defaultLanguage,
      };

export const languages: string[] = Object.keys(languagePacks),
language = new StringSetting("language", navigator.language);

export default languagePacks[language.value] ?? defaultLanguage;
