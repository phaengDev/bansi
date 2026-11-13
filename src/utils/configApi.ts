export const CONFIG = {
  // api-bansi — dev (npm run dev) = localhost:8888, build = server ຈິງ; ຕັ້ງ VITE_API_URL ໃນ .env ເພື່ອຊີ້ໄປ server ອື່ນ
  URLAPI: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:8888/api" : "https://api-bansi.info-oac-centre.net/api"),
};

import axios, { type AxiosRequestConfig } from "axios";
import moment from 'moment';
import numeral from 'numeral';

const getCurrentToken = () => localStorage.getItem("token");
const api = CONFIG.URLAPI;

// ── Axios ─────────────────────────────────────────────────
export const axiosInstance = axios.create({
    baseURL: api,
});

export const axiosInstanceFile = axios.create({
    baseURL: api,
    headers: {
        'Content-Type': 'multipart/form-data',
    },
});

// token ໝົດອາຍຸ / ບໍ່ຖືກຕ້ອງ (401 ຈາກ verifyToken ຂອງ api-bansi) → ກັບໄປໜ້າ login
const redirectOnUnauthorized = (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401 && window.location.pathname !== '/login') {
        localStorage.removeItem('token');
        window.location.href = '/login';
    }
    return Promise.reject(error);
};
axiosInstance.interceptors.response.use((res) => res, redirectOnUnauthorized);
axiosInstanceFile.interceptors.response.use((res) => res, redirectOnUnauthorized);

const withAuth = (config?: AxiosRequestConfig): AxiosRequestConfig => {
    const token = getCurrentToken();
    return {
        ...config,
        headers: {
            ...(config?.headers || {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    };
};

// ── ✅ Format functions ───────────────────────────────────
/**
 * ຮູບແບບຕົວເລກຂອງບໍລິສັດ (ຕັ້ງຄ່າບັນຊີ → ຕັ້ງຄ່າທົ່ວໄປ): 1 = 1,250,000.50, 2 = 1.250.000,50 (ກົດໝາຍບັນຊີ ມາດຕາ 7).
 * ມີຜົນກັບທຸກບ່ອນທີ່ສະແດງຕົວເລກຜ່ານ formatNumber / formatDecimal / numeral; ຊ່ອງປ້ອນຕົວເລກ (InputNumber) ຄືເກົ່າ.
 * ຈື່ໄວ້ໃນ localStorage ໃຫ້ໂຫຼດໜ້າໃໝ່ແລ້ວໃຊ້ທັນທີ ກ່ອນດຶງຕັ້ງຄ່າຈາກ api
 */
export type NumberStyle = 1 | 2;
const NUMBER_STYLE_KEY = 'numberFormat';
numeral.register('locale', 'lo-dot', {
    delimiters: { thousands: '.', decimal: ',' },
    abbreviations: { thousand: 'k', million: 'm', billion: 'b', trillion: 't' },
    ordinal: () => '',
    currency: { symbol: '₭' },
});
export const applyNumberStyle = (style: NumberStyle) => {
    numeral.locale(style === 2 ? 'lo-dot' : 'en');
    try {
        localStorage.setItem(NUMBER_STYLE_KEY, String(style));
    } catch {
        // ບໍ່ມີ localStorage — ໃຊ້ໄດ້ສະເພາະຮອບນີ້
    }
};
const storedNumberStyle = (): NumberStyle => {
    try {
        return localStorage.getItem(NUMBER_STYLE_KEY) === '2' ? 2 : 1;
    } catch {
        return 1;
    }
};
applyNumberStyle(storedNumberStyle());

/** ຟໍແມັດຕົວເລກ:  1,000,000 */
export const formatNumber = (val: number | string | null | undefined): string => {
    return numeral(val ?? 0).format('0,0');
};

/** ຟໍແມັດທົດສະນິຍົມ:  1,000,000.00 */
export const formatDecimal = (val: number | string | null | undefined): string => {
    return numeral(val ?? 0).format('0,0.00');
};

/** ຟໍແມັດວັນທີ:  01/01/2026 */
export const formatDate = (val: string | Date | null | undefined): string => {
    if (!val) return '-';
    return moment(val).format('DD/MM/YYYY');
};

/** ຟໍແມັດວັນທີ + ເວລາ:  01/01/2026 10:30 */
export const formatDateTime = (val: string | Date | null | undefined): string => {
    if (!val) return '-';
    return moment(val).format('DD/MM/YYYY HH:mm');
};

// ── ✅ Axios helper functions ─────────────────────────────
/** POST request */
export const postApi = async <T = any>(url: string, payload?: any, config?: AxiosRequestConfig) => {
    const res = await axiosInstance.post<T>(url, payload, withAuth(config));
    return res; // ✅ return ທັງໝົດ — ມີ .status, .data, .headers
};

/** PUT request */
export const putApi = async <T = any>(url: string, payload?: any, config?: AxiosRequestConfig) => {
    const res = await axiosInstance.put<T>(url, payload, withAuth(config));
    return res;
};

/** PATCH request */
export const patchApi = async <T = any>(url: string, payload?: any, config?: AxiosRequestConfig) => {
    const res = await axiosInstance.patch<T>(url, payload, withAuth(config));
    return res;
};

/** GET request */
export const getApi = async <T = any>(url: string, config?: AxiosRequestConfig) => {
    const res = await axiosInstance.get<T>(url, withAuth(config));
    return res;
};

/** DELETE request */
export const deleteApi = async <T = any>(url: string, config?: AxiosRequestConfig) => {
    const res = await axiosInstance.delete<T>(url, withAuth(config));
    return res;
};

/** Upload file */
export const uploadApi = async <T = any>(url: string, formData: FormData) => {
    const res = await axiosInstanceFile.post<T>(url, formData, withAuth());
    return res;
};

// ── ✅ Token helper ───────────────────────────────────────
/** ດຶງ token ໃໝ່ທຸກຄັ້ງ (ຫຼີກເວັ້ນ stale token) */
export const getToken = (): string | null => {
    return getCurrentToken();
};

/** ເວລາໝົດອາຍຸຂອງ token (ms — ອ່ານ exp ຈາກ JWT ຝັ່ງໜ້າເວັບ, ບໍ່ຍິງ api); ບໍ່ມີ / ອ່ານບໍ່ໄດ້ = null */
export const tokenExpiresAt = (): number | null => {
    const t = getToken();
    if (!t) return null;
    try {
        // JWT ເປັນ base64url — ແປງເປັນ base64 ກ່ອນ atob
        const payload = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
    } catch {
        return null;
    }
};

/** ກວດສອບ token ໝົດອາຍຸ (ຝັ່ງໜ້າເວັບ) — ກວດກັບ api ແທ້ຢູ່ App.tsx (GET /user/session) */
export const isTokenExpired = (): boolean => {
    const at = tokenExpiresAt();
    return at === null || at < Date.now();
};
