import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import { CONFIG, isTokenExpired } from '../../utils/configApi';
import { type LangCode, useLanguage, useT } from '../../context/LanguageContext';
import { langLabels, localeByLanguage } from '../account/DesktopShared';

/** ໂມດູນຫຼັກທີ່ສະແດງໃຕ້ໂມງ — ຊື່ໃຊ້ key ດຽວກັບໄອຄອນໃນ desktop */
const FEATURES = [
    { icon: 'fa-pen-to-square', label: 'accountAppJournal' },
    { icon: 'fa-book', label: 'accountAppGeneralLedger' },
    { icon: 'fa-chart-pie', label: 'accountAppFinancialStatements' },
];

// Intl ຂອງ browser ສ່ວນໃຫຍ່ບໍ່ມີຂໍ້ມູນພາສາລາວ (lo-LA ຕົກເປັນອັງກິດ) — ວັນທີລາວຈຶ່ງປະກອບເອງ
const LAO_WEEKDAYS = ['ວັນອາທິດ', 'ວັນຈັນ', 'ວັນອັງຄານ', 'ວັນພຸດ', 'ວັນພະຫັດ', 'ວັນສຸກ', 'ວັນເສົາ'];
const LAO_MONTHS = [
    'ມັງກອນ', 'ກຸມພາ', 'ມີນາ', 'ເມສາ', 'ພຶດສະພາ', 'ມິຖຸນາ',
    'ກໍລະກົດ', 'ສິງຫາ', 'ກັນຍາ', 'ຕຸລາ', 'ພະຈິກ', 'ທັນວາ',
];

interface FormValues {
    phones: string;
    password: string;
}

/** ຄຳຕອບຂອງ POST /user/login (api-bansi middleware/auth.ts) */
interface LoginResponse {
    user: {
        user_uuid: string;
        user_name: string;
        phones: string;
        type_user: string;
        company_id_fk: string;
        deletes: string;
        updates: string;
        creates: string;
    };
    token: string;
}

/**
 * ໜ້າເຂົ້າສູ່ລະບົບ — ແບບໜ້າຈໍລັອກຂອງ desktop ບັນຊີ: ພື້ນຫຼັງດຽວກັບ desktop (finance), ໂມງ/ວັນທີ
 * ຢູ່ຊ້າຍ ແລະ ກາດເຂົ້າລະບົບຢູ່ຂວາ. login ແລ້ວ → `/` (desktop).
 */
const LoginPage: React.FC = () => {
    const api = CONFIG.URLAPI;
    const { lang, setLang } = useLanguage();
    const t = useT();

    const [showPassword, setShowPassword] = useState(false);
    const [values, setValues] = useState<FormValues>({ phones: '', password: '' });
    const [loading, setLoading] = useState(false);
    /** key ຂອງຂໍ້ຄວາມ (login.error / login.network) — ແປຕອນ render ປ່ຽນພາສາແລ້ວຂໍ້ຄວາມປ່ຽນນຳ */
    const [error, setError] = useState<string | null>(null);
    const [now, setNow] = useState(() => new Date());

    // ໂມງສະແດງແຕ່ ຊົ່ວໂມງ:ນາທີ — 10 ວິນາທີຕໍ່ເທື່ອກໍ່ພໍ
    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 10_000);
        return () => window.clearInterval(timer);
    }, []);

    // login ຢູ່ແລ້ວ (token ຍັງບໍ່ໝົດອາຍຸ) — ບໍ່ຕ້ອງເຂົ້າໃໝ່
    if (!isTokenExpired()) return <Navigate to="/" replace />;

    const locale = localeByLanguage[lang];
    const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
    const date = lang === 'la'
        ? `${LAO_WEEKDAYS[now.getDay()]}, ${now.getDate()} ${LAO_MONTHS[now.getMonth()]} ${now.getFullYear()}`
        : new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now);

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const response = await axios.post<LoginResponse>(`${api}/user/login`, values);
            if (response.status === 200) {
                const { user, token } = response.data || {};
                localStorage.setItem('token', token);
                localStorage.setItem('userid', user.user_uuid);
                localStorage.setItem('user_name', user.user_name);
                localStorage.setItem('phones', user.phones);
                localStorage.setItem('type_user', user.type_user);
                localStorage.setItem('company_id_fk', user.company_id_fk);
                localStorage.setItem('deletes', user.deletes);
                localStorage.setItem('updates', user.updates);
                localStorage.setItem('creates', user.creates);
                // ໂຫຼດໃໝ່ທັງໜ້າ — ສິດ canCreate/canEdit/canDelete ອ່ານຄັ້ງດຽວຕອນໂຫຼດໂມດູນ
                window.location.href = '/';
            }
        } catch (err) {
            // ບໍ່ມີ response = ເຊື່ອມຕໍ່ api-bansi ບໍ່ໄດ້ (ບໍ່ແມ່ນລະຫັດຜິດ)
            setError(axios.isAxiosError(err) && !err.response ? 'login.network' : 'login.error');
        } finally {
            setLoading(false);
        }
    };

    const handleInvalid = (msg: string) => (e: React.InvalidEvent<HTMLInputElement>) => {
        e.currentTarget.setCustomValidity(msg);
    };
    const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
        e.currentTarget.setCustomValidity('');
    };

    return (
        <div className="bansi-login">
            <header className="bansi-login-top">
                <span className="bansi-login-mark">
                    <img src="/assets/img/logo/plc2.png" alt="" />
                </span>
                <span>
                    <strong>PL Lao Development</strong>
                    <small>{t('accountWorkspaceTitle')}</small>
                </span>
            </header>

            <section className="bansi-login-hero">
                <time className="bansi-login-time" dateTime={now.toISOString()}>{time}</time>
                <div className="bansi-login-date">{date}</div>
                <p className="bansi-login-tagline">{t('login.tagline')}</p>
                <ul className="bansi-login-features">
                    {FEATURES.map((feature) => (
                        <li key={feature.label}>
                            <i className={`fa-solid ${feature.icon}`} aria-hidden="true" /> {t(feature.label)}
                        </li>
                    ))}
                </ul>
            </section>

            <main className="bansi-login-panel">
                <form className="bansi-login-card" onSubmit={handleLogin} aria-busy={loading}>
                    <span className="bansi-login-avatar">
                        <img src="/assets/img/logo/plc2.png" alt="PL Lao Development" />
                    </span>
                    <h1>{t('login.welcome')}</h1>
                    <p className="bansi-login-subtitle">{t('login.subtitle')}</p>

                    <div className="bansi-login-field">
                        <label htmlFor="phones">{t('login.phone')}</label>
                        <div className="bansi-login-input">
                            <i className="fa-solid fa-mobile-screen" aria-hidden="true" />
                            <input
                                type="text"
                                id="phones"
                                placeholder="20 XXX XXX"
                                value={values.phones}
                                onChange={(e) => {
                                    const onlyNums = e.target.value.replace(/[^0-9]/g, '');
                                    setValues({ ...values, phones: onlyNums });
                                }}
                                onInvalid={handleInvalid(t('login.phoneError'))}
                                onInput={handleInput}
                                pattern="[0-9]{8}"
                                maxLength={8}
                                inputMode="numeric"
                                autoComplete="tel"
                                autoFocus
                                required
                            />
                        </div>
                    </div>

                    <div className="bansi-login-field">
                        <label htmlFor="password">{t('login.password')}</label>
                        <div className="bansi-login-input">
                            <i className="fa-solid fa-lock" aria-hidden="true" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="password"
                                placeholder="••••••••"
                                value={values.password}
                                onChange={(e) => setValues({ ...values, password: e.target.value })}
                                onInvalid={handleInvalid(t('login.passwordError'))}
                                onInput={handleInput}
                                autoComplete="current-password"
                                required
                            />
                            <button
                                type="button"
                                className="bansi-login-eye"
                                onClick={() => setShowPassword((show) => !show)}
                                aria-label={showPassword ? t('login.hidePass') : t('login.showPass')}
                                title={showPassword ? t('login.hidePass') : t('login.showPass')}
                            >
                                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true" />
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="bansi-login-error" role="alert">
                            <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
                            <span>{t(error)}</span>
                            <button type="button" onClick={() => setError(null)} aria-label={t('close')}>
                                <i className="fa-solid fa-xmark" aria-hidden="true" />
                            </button>
                        </div>
                    )}

                    <button type="submit" className="bansi-login-submit" disabled={loading}>
                        {loading ? (
                            <>
                                <span className="bansi-login-spinner" aria-hidden="true" /> {t('login.loading')}
                            </>
                        ) : (
                            <>
                                {t('login.submit')} <i className="fa-solid fa-arrow-right" aria-hidden="true" />
                            </>
                        )}
                    </button>
                </form>

                <footer className="bansi-login-footer">
                    PL Lao Development &copy; {now.getFullYear()} · v2.0
                </footer>
            </main>

            <nav className="bansi-login-lang" aria-label="Language">
                {(Object.keys(langLabels) as LangCode[]).map((code) => (
                    <button
                        key={code}
                        type="button"
                        aria-pressed={code === lang}
                        onClick={() => setLang(code)}
                    >
                        {langLabels[code]}
                    </button>
                ))}
            </nav>
        </div>
    );
};

export default LoginPage;
