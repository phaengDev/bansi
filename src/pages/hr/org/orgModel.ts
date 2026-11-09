import { useCallback, useEffect, useState } from 'react';
import { getApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';

/**
 * ໂຄງຮ່າງການຈັດຕັ້ງ — ຂໍ້ມູນຈາກ GET /org/chart (api-bansi orgController).
 * ສາຍບັງຄັບບັນຊາ = "ລາຍງານຕໍ່" ຂອງແຕ່ລະຄົນ (reports_to_id, ເລືອກຢູ່ຟອມພະນັກງານ);
 * ຕຳແໜ່ງເປັນລາຍຊື່ກາງມີລະດັບ (1 ຜູ້ບໍລິຫານສູງສຸດ · 2 ຮອງ · 3 ຫົວໜ້າພະແນກ/ທີມ · 4 ພະນັກງານ) ໃຊ້ແນະນຳຫົວໜ້າ.
 * ໜ້າໂຄງຮ່າງ, ຟອມພະນັກງານ ແລະ ລາຍລະອຽດພະນັກງານ ໃຊ້ຕົວຊ່ວຍໃນໄຟລ໌ນີ້ຮ່ວມກັນ
 */

/** executive = 1: ຂັ້ນບໍລິຫານ (ຄະນະບໍລິຫານ) — ຢູ່ເທິງສຸດ, ບໍ່ນັບ ແລະ ບໍ່ສະແດງເປັນພະແນກ */
export type OrgDepartment = { _uuid: number; depart_code: string; depart_name: string; sort: number; executive?: number };
export type OrgPosition = { _uuid: number; position_name: string; level: number | null };
export type OrgPerson = {
  _uuid: number;
  emp_code: string;
  first_name: string;
  last_name: string | null;
  gender: number;
  profile_url: string | null;
  department_id: number;
  position_id: number | null;
  /** ຫົວໜ້າທີ່ຍັງເຮັດວຽກຢູ່ (ເຊີບເວີຂ້າມຄົນລາອອກໃຫ້ແລ້ວ) */
  reports_to_id: number | null;
};
export type OrgData = { departments: OrgDepartment[]; positions: OrgPosition[]; people: OrgPerson[] };

export type OrgNode = {
  person: OrgPerson;
  position?: OrgPosition;
  department?: OrgDepartment;
  parent: OrgNode | null;
  children: OrgNode[];
  /** ສີຂອງພະແນກ (ລຳດັບໃນ PALETTE) */
  tone: number;
};

export type OrgTree = {
  /** ຕົ້ນຫຼັກ (ຕົ້ນທີ່ໃຫຍ່ສຸດ ເຊັ່ນ ຜູ້ອຳນວຍການ) ກ່ອນ, ຕາມດ້ວຍຄົນທີ່ຍັງບໍ່ໄດ້ກຳນົດຫົວໜ້າ */
  roots: OrgNode[];
  main: OrgNode | null;
  byPerson: Map<number, OrgNode>;
  departments: OrgDepartment[];
  positions: Map<number, OrgPosition>;
};

export const EMPTY_ORG: OrgData = { departments: [], positions: [], people: [] };

export const personName = (p: Pick<OrgPerson, 'first_name' | 'last_name'>) => [p.first_name, p.last_name].filter(Boolean).join(' ');

/** ສີຂອງພະແນກ — ວົນ 8 ສີ (class .org-tone-N ໃນ _hr-org.scss) */
export const toneClass = (tone: number) => `org-tone-${tone % 8}`;

export const isExecutive = (department: OrgDepartment | undefined) => Number(department?.executive) === 1;

/** ພະແນກແທ້ (ບໍ່ລວມຂັ້ນບໍລິຫານ) */
export const realDepartments = (departments: OrgDepartment[]) => departments.filter((d) => !isExecutive(d));

const subtreeSize = (node: OrgNode): number => 1 + node.children.reduce((n, c) => n + subtreeSize(c), 0);

/** ລຽງລູກທີມ: ລະດັບສູງກ່ອນ (ຫົວໜ້າກ່ອນພະນັກງານ) → ລຳດັບພະແນກ → ຊື່ */
const byRank = (deptRank: Map<number, number>) => (a: OrgNode, b: OrgNode) =>
  (a.position?.level ?? 9) - (b.position?.level ?? 9)
  || (deptRank.get(a.person.department_id) ?? 99) - (deptRank.get(b.person.department_id) ?? 99)
  || personName(a.person).localeCompare(personName(b.person));

export const buildOrgTree = (data: OrgData): OrgTree => {
  const positions = new Map(data.positions.map((p) => [p._uuid, p]));
  const departments = new Map(data.departments.map((d) => [d._uuid, d]));
  const deptRank = new Map(data.departments.map((d, i) => [d._uuid, i]));
  const byPerson = new Map<number, OrgNode>();
  for (const person of data.people) {
    byPerson.set(person._uuid, {
      person,
      position: person.position_id ? positions.get(person.position_id) : undefined,
      department: departments.get(person.department_id),
      parent: null,
      children: [],
      tone: deptRank.get(person.department_id) ?? 0,
    });
  }
  const roots: OrgNode[] = [];
  for (const node of byPerson.values()) {
    const parent = node.person.reports_to_id ? byPerson.get(node.person.reports_to_id) : undefined;
    if (parent && parent !== node) {
      node.parent = parent;
      parent.children.push(node);
    } else roots.push(node);
  }
  const sort = byRank(deptRank);
  for (const node of byPerson.values()) node.children.sort(sort);
  roots.sort(sort);
  // ຕົ້ນຫຼັກ = ຕົ້ນທີ່ໃຫຍ່ສຸດ (ຕ້ອງມີລູກທີມຢ່າງໜ້ອຍ 1 ຄົນ — ບໍ່ດັ່ງນັ້ນທຸກຄົນຍັງ "ບໍ່ໄດ້ກຳນົດຫົວໜ້າ")
  const biggest = roots.reduce<OrgNode | null>((best, r) => (!best || subtreeSize(r) > subtreeSize(best) ? r : best), null);
  const main = biggest && biggest.children.length ? biggest : null;
  return { roots: main ? [main, ...roots.filter((r) => r !== main)] : roots, main, byPerson, departments: data.departments, positions };
};

/** ຢູ່ໃນຕົ້ນຫຼັກບໍ່ (ກຳນົດຫົວໜ້າຂຶ້ນໄປຮອດຜູ້ອຳນວຍການແລ້ວ) */
export const inMainTree = (tree: OrgTree, node: OrgNode) => {
  let n: OrgNode | null = node;
  while (n?.parent) n = n.parent;
  return !!tree.main && n === tree.main;
};

/** ຫົວໜ້າ ແລະ ລູກທີມ ຂອງຄົນ */
export const reportLineOf = (tree: OrgTree, personId: number | null | undefined) => {
  const node = personId ? tree.byPerson.get(personId) : undefined;
  if (!node) return null;
  return { node, boss: node.parent, team: node.children, isTop: !node.parent && node === tree.main };
};

/**
 * ຫົວໜ້າທີ່ແນະນຳ — ຄົນທີ່ລະດັບສູງກວ່າທີ່ໃກ້ສຸດ: ໃນພະແນກດຽວກັນກ່ອນ, ບໍ່ມີ = ຂັ້ນບໍລິຫານ, ບໍ່ມີອີກ = ໃຜກໍ່ໄດ້ທີ່ສູງກວ່າ.
 * ພະນັກງານ → ຫົວໜ້າພະແນກ; ຫົວໜ້າພະແນກ → ຮອງ; ຮອງ → ຜູ້ອຳນວຍການ. ກົດເກນດຽວກັບເຊີບເວີ (orgController suggestBoss)
 */
export const suggestBoss = (data: OrgData, person: { _uuid?: number; department_id: number | null; position_id: number | null }) => {
  const levels = new Map(data.positions.map((p) => [p._uuid, p.level]));
  const levelOf = (id: number | null) => (id ? levels.get(id) ?? null : null);
  const level = levelOf(person.position_id);
  if (!level || level <= 1) return null;
  const above = data.people.filter((p) => p._uuid !== person._uuid && (levelOf(p.position_id) ?? Infinity) < level);
  if (!above.length) return null;
  const closest = (list: OrgPerson[]) => {
    const top = Math.max(...list.map((p) => levelOf(p.position_id)!));
    return list.filter((p) => levelOf(p.position_id) === top).sort((a, b) => a._uuid - b._uuid)[0]?._uuid ?? null;
  };
  const same = above.filter((p) => p.department_id === person.department_id);
  if (same.length) return closest(same);
  const executive = new Set(data.departments.filter(isExecutive).map((d) => d._uuid));
  const exec = above.filter((p) => executive.has(p.department_id));
  return closest(exec.length ? exec : above);
};

/** ຄົນທີ່ຢູ່ໃຕ້ personId (ລູກ ຫຼານ…) — ເລືອກເປັນຫົວໜ້າບໍ່ໄດ້ (ຈະວົນກັນ) */
export const descendantsOf = (tree: OrgTree, personId: number | null | undefined) => {
  const out = new Set<number>();
  const walk = (n: OrgNode) => n.children.forEach((c) => {
    if (out.has(c.person._uuid)) return;
    out.add(c.person._uuid);
    walk(c);
  });
  const node = personId ? tree.byPerson.get(personId) : undefined;
  if (node) walk(node);
  return out;
};

/** GET /org/chart — reload ຫຼັງແກ້ຫົວໜ້າ / ຕຳແໜ່ງ */
export const useOrgData = () => {
  const [data, setData] = useState<OrgData>(EMPTY_ORG);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getApi('/org/chart');
      setData({ ...EMPTY_ORG, ...(res.data ?? {}) });
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, setData, loading, reload };
};
