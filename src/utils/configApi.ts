export const CONFIG = {
  // api-bansi — ຕັ້ງ VITE_API_URL ໃນ .env ເພື່ອຊີ້ໄປ server ອື່ນ
  URLAPI: import.meta.env.VITE_API_URL || "http://localhost:8888/api",
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

/** ກວດສອບ token ໝົດອາຍຸ (ອ່ານ exp ຈາກ JWT ຝັ່ງໜ້າເວັບ — ບໍ່ຍິງ api) */
export const isTokenExpired = (): boolean => {
    const t = getToken();
    if (!t) return true;
    try {
        const payload = JSON.parse(atob(t.split('.')[1]));
        return payload.exp * 1000 < Date.now();
    } catch {
        return true;
    }
};
