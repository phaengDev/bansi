// Utility to read from localStorage
export const getLocal = (key: string): string | null => {
  return localStorage.getItem(key);
};

// Utility to parse permissions (1 = allow, 2 = deny) — ຄ່າມາຈາກ POST /user/login (creates/updates/deletes)
export const getPermission = (key: string): number => {
  const value = getLocal(key);
  return value ? parseInt(value, 10) : 2; // default 2 = no permission
};

/** ແພັກເກດຂອງບໍລິສັດໝົດອາຍຸ = ອ່ານໄດ້ຢ່າງດຽວ (ຕັ້ງໂດຍ pages/account/companyPlan — PLAN_READ_ONLY_KEY) */
const planReadOnly = () => getLocal("planReadOnly") === "1";

// Define storage getters

const storage = {
  get token(): string | null {
    return getLocal("token");
  },

  get canCreate(): boolean {
    return getPermission("creates") === 1 && !planReadOnly();
  },

  get canEdit(): boolean {
    return getPermission("updates") === 1 && !planReadOnly();
  },

  get canDelete(): boolean {
    return getPermission("deletes") === 1 && !planReadOnly();
  }

};

// Export them as constants — ອ່ານເທື່ອດຽວຕອນໂຫຼດໂມດູນ (login ໂຫຼດໜ້າໃໝ່ທັງໝົດ ສິດຈຶ່ງເປັນຄ່າປັດຈຸບັນ)
export const { token, canCreate, canEdit, canDelete } = storage;
