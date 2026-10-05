// Utility to read from localStorage
export const getLocal = (key: string): string | null => {
  return localStorage.getItem(key);
};

// Utility to parse permissions (1 = allow, 2 = deny) — ຄ່າມາຈາກ POST /user/login (creates/updates/deletes)
export const getPermission = (key: string): number => {
  const value = getLocal(key);
  return value ? parseInt(value, 10) : 2; // default 2 = no permission
};

// Define storage getters

const storage = {
  get token(): string | null {
    return getLocal("token");
  },

  get canCreate(): boolean {
    return getPermission("creates") === 1;
  },

  get canEdit(): boolean {
    return getPermission("updates") === 1;
  },

  get canDelete(): boolean {
    return getPermission("deletes") === 1;
  }

};

// Export them as constants — ອ່ານເທື່ອດຽວຕອນໂຫຼດໂມດູນ (login ໂຫຼດໜ້າໃໝ່ທັງໝົດ ສິດຈຶ່ງເປັນຄ່າປັດຈຸບັນ)
export const { token, canCreate, canEdit, canDelete } = storage;
