import axios from "axios";
import { toSubmitDate } from "../utils/formater";

// ປ້ອງກັນ Date object ຖືກ serialize ເປັນ ISO/UTC (ວັນທີຖອຍ n-1) — ແປງເປັນ "DD/MM/YYYY" ກ່ອນສົ່ງ
const convertDates = (value: unknown): unknown => {
  if (value instanceof Date) return toSubmitDate(value);
  if (Array.isArray(value)) return value.map(convertDates);
  if (value && typeof value === "object" && value.constructor === Object) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, convertDates(item)])
    );
  }
  return value;
};

axios.interceptors.request.use((config) => {
  if (config.data && !(config.data instanceof FormData)) {
    config.data = convertDates(config.data);
  }
  return config;
});
