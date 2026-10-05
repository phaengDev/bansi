import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { translations, type TKey } from '../i18n/translations';
import { laoDict, laoTextToKey } from '../i18n/lao-dict';

export type LangCode = 'la' | 'en' | 'cn';

interface LanguageContextValue {
    lang: LangCode;
    setLang: (lang: LangCode) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
    lang: 'la',
    setLang: () => {},
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [lang, setLangState] = useState<LangCode>(() => {
        return (localStorage.getItem('lang') as LangCode) || 'la';
    });

    // <html lang> ໃຫ້ກົງກັບພາສາທີ່ເລືອກ (ໃຊ້ຕອນພິມ ແລະ ອ່ານໜ້າຈໍ)
    useEffect(() => {
        document.documentElement.lang = lang === 'la' ? 'lo' : lang === 'cn' ? 'zh' : 'en';
    }, [lang]);

    const setLang = (code: LangCode) => {
        localStorage.setItem('lang', code);
        setLangState(code);
    };

    return (
        <LanguageContext.Provider value={{ lang, setLang }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);

const hasOwn = <T extends object>(obj: T, key: PropertyKey): key is keyof T =>
    Object.prototype.hasOwnProperty.call(obj, key);

const getLaoDictEntry = (key: string) => {
    if (hasOwn(laoDict, key)) return laoDict[key];

    const dictKey = laoTextToKey[key];
    if (dictKey) return laoDict[dictKey];

    const normalized = key
        .replace(/^[=\s]+|[=\s]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (normalized && normalized !== key) {
        const normalizedKey = laoTextToKey[normalized];
        if (normalizedKey) return laoDict[normalizedKey];
    }

    const withoutTrailingPunctuation = normalized.replace(/[：:]+$/g, '').trim();
    if (withoutTrailingPunctuation && withoutTrailingPunctuation !== normalized) {
        const strippedKey = laoTextToKey[withoutTrailingPunctuation];
        if (strippedKey) return laoDict[strippedKey];
    }

    return undefined;
};

/** ອ່ານພາສາປັດຈຸບັນຈາກ localStorage — ໃຊ້ໄດ້ທຸກໄຟລ໌ໂດຍບໍ່ຕ້ອງ inject hook */
export const lang = (): LangCode =>
    (localStorage.getItem('lang') as LangCode) || 'la';

export const translateText = (key: TKey | string, langCode: LangCode = lang()): string => {
    const textKey = key as string;

    // key path format: "namespace.key"
    if (textKey.includes('.') && !/[ກ-ໝ]/.test(textKey)) {
        const [ns, k] = textKey.split('.') as [keyof typeof translations.la, string];
        const langTranslations = translations[langCode] as Partial<Record<keyof typeof translations.la, Record<string, string>>>;
        const val = langTranslations[ns]?.[k];
        if (val) return val;
    }

    // English dict key or legacy raw Lao string
    const entry = getLaoDictEntry(textKey);
    if (entry) return entry[langCode] ?? textKey;

    const dayMatch = textKey.trim().match(/^(\d+)\s*ວັນ$/);
    if (dayMatch) {
        if (langCode === 'en') return `${dayMatch[1]} days`;
        if (langCode === 'cn') return `${dayMatch[1]} 天`;
    }

    if (textKey.includes('ບໍ່ມີຂໍ້ມູນ')) {
        return laoDict.noData[langCode] ?? textKey;
    }

    return textKey;
};

/**
 * hook translate UI text — ຮັບ 3 ຮູບແບບ:
 *   1. key path:    t('login.phone')       → ຈາກ translations.ts
 *   2. dict key:    t('home')              → ຈາກ lao-dict.ts
 *   3. Lao string:  t('ໜ້າຫຼັກ')           → legacy fallback
 * ຖ້າບໍ່ພົບໃນ dict → return string ເດີມ
 */
export const useT = () => {
    const { lang } = useLanguage();
    return useCallback((key: TKey | string): string => {
        return translateText(key, lang);
    }, [lang]);
};

const translateNode = (node: React.ReactNode, t: (key: TKey | string) => string): React.ReactNode => {
    if (typeof node === 'string') {
        const leading = node.match(/^\s*/)?.[0] ?? '';
        const trailing = node.match(/\s*$/)?.[0] ?? '';
        const text = node.trim();
        return text ? `${leading}${t(text)}${trailing}` : node;
    }

    if (Array.isArray(node)) {
        return node.map((child, index) => (
            <React.Fragment key={index}>{translateNode(child, t)}</React.Fragment>
        ));
    }

    return node;
};

export const TText: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const t = useT();
    return <>{translateNode(children, t)}</>;
};

/** ດຶງ field ຕາມພາສາ (non-reactive) */
export const getLangField = (
    obj: Record<string, unknown> | null | undefined,
    field: string,
    langCode?: LangCode
): string => {
    if (!obj) return '';
    const code = langCode ?? lang();
    const preferred = obj[`${field}_${code}`] as string | undefined;
    if (preferred) return preferred;
    for (const c of ['la', 'en', 'cn'] as LangCode[]) {
        const val = obj[`${field}_${c}`] as string | undefined;
        if (val) return val;
    }
    return (obj[field] as string) ?? '';
};

/**
 * hook reactive ສຳລັບ switch field ຈາກ database
 *   const lf = useLangField();
 *   {lf(row, 'type_name')}  →  row.type_name_la / _en / _cn
 */
export const useLangField = () => {
    const { lang: code } = useLanguage();
    return (obj: Record<string, unknown> | null | undefined, field: string): string => {
        if (!obj) return '';
        const preferred = obj[`${field}_${code}`] as string | undefined;
        if (preferred) return preferred;
        for (const c of ['la', 'en', 'cn'] as LangCode[]) {
            const val = obj[`${field}_${c}`] as string | undefined;
            if (val) return val;
        }
        return (obj[field] as string) ?? '';
    };
};
