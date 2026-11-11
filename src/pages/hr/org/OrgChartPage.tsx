import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import moment from 'moment';
import { useT } from '../../../context/LanguageContext';
import { canEdit } from '../../../utils/localStorage';
import { postApi, putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { printElementByFrame } from '../../../utils/Print';
import { ListState, SettingModal, SettingToolbar } from '../../account/setting/settingKit';
import { HrAvatar } from '../hrKit';
import { BossSelect, jobOf, useBossOptions } from './OrgBits';
import {
  buildOrgTree, inMainTree, isExecutive, personName, realDepartments, suggestBoss, toneClass, useOrgData,
  type OrgData, type OrgNode, type OrgTree,
} from './orgModel';

type View = 'tree' | 'dept';
const VIEW_KEY = 'hr.orgChart.view';
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.4;

const readView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'dept' ? 'dept' : 'tree';
  } catch {
    return 'tree';
  }
};

/** ຂໍ້ມູນຮ່ວມຂອງການແຕ້ມ — ຄຳຄົ້ນຫາ ແລະ ປຸ່ມປ່ຽນຫົວໜ້າສາຍງານ */
type Ctx = { query: string; onEdit?: (node: OrgNode) => void };

const hit = (n: OrgNode, q: string) =>
  !!q && `${personName(n.person)} ${n.person.emp_code} ${n.position?.position_name ?? ''}`.toLowerCase().includes(q);

const EditButton = ({ node, ctx }: { node: OrgNode; ctx: Ctx }) => {
  const t = useT();
  if (!ctx.onEdit) return null;
  return (
    <button type="button" className="org-edit" title={t('hrChangeBoss')} aria-label={t('hrChangeBoss')} onClick={() => ctx.onEdit!(node)}>
      <i className="fa-solid fa-pen" />
    </button>
  );
};

/**
 * ບັດຂອງຄົນ — ຮູບ, ຊື່, ຕຳແໜ່ງ; ປ້າຍພະແນກສະເພາະບ່ອນທີ່ພະແນກປ່ຽນຈາກຫົວໜ້າ (ຂັ້ນບໍລິຫານບໍ່ມີປ້າຍ).
 * compact = ຮູບຊ້າຍ ຊື່ຂວາ (ຖັນລູກທີມ)
 */
const NodeCard = ({ node, ctx, compact, loose }: { node: OrgNode; ctx: Ctx; compact?: boolean; loose?: boolean }) => {
  const t = useT();
  const newDept = !node.parent || node.parent.person.department_id !== node.person.department_id;
  const dept = newDept && !isExecutive(node.department) ? node.department?.depart_name : undefined;
  return (
    <div className={`org-card is-single${compact ? ' is-compact' : ''}${loose ? ' is-loose' : ''} ${toneClass(node.tone)}${hit(node, ctx.query) ? ' is-hit' : ''}`}>
      <EditButton node={node} ctx={ctx} />
      {loose && <span className="org-card-loose"><i className="fa-solid fa-triangle-exclamation" /> {t('hrNoBoss')}</span>}
      <span className="org-card-face"><HrAvatar url={node.person.profile_url} name={node.person.first_name} size="lg" /></span>
      <span className="org-card-info">
        <b className="org-card-name">{personName(node.person)}</b>
        <span className="org-card-title">{node.position?.position_name ?? node.person.emp_code}</span>
        {dept && <span className="org-card-dept">{dept}</span>}
      </span>
    </div>
  );
};

/** ກິ່ງຂອງຕົ້ນໄມ້ — ລູກທີມທີ່ບໍ່ມີລູກທີມຕໍ່ (≥ 2) ລຽງລົງເປັນຖັນ ເພື່ອບໍ່ໃຫ້ກວ້າງເກີນ */
const Branch = ({ node, ctx, keep }: { node: OrgNode; ctx: Ctx; keep?: (n: OrgNode) => boolean }) => {
  const kids = keep ? node.children.filter(keep) : node.children;
  const stacked = kids.length >= 2 && kids.every((c) => !(keep ? c.children.filter(keep) : c.children).length);
  return (
    <li>
      <NodeCard node={node} ctx={ctx} />
      {kids.length > 0 && (stacked ? (
        <div className="org-stack">
          {kids.map((c) => <div key={c.person._uuid} className="org-stack-item"><NodeCard node={c} ctx={ctx} compact /></div>)}
        </div>
      ) : (
        <ul>{kids.map((c) => <Branch key={c.person._uuid} node={c} ctx={ctx} keep={keep} />)}</ul>
      ))}
    </li>
  );
};

// ---- ມຸມມອງສາຍບັງຄັບບັນຊາ: ວາງບັດເປັນແຖວຕາມ Level ----
const CARD_W = 176;
const CARD_H = 190;
const GAP_X = 18;
const GAP_Y = 64;
const ROOT_GAP = 56;
/** ບ່ອນປ້າຍ Level ທາງຊ້າຍ */
const GUTTER = 92;
const PITCH = CARD_H + GAP_Y;

type Box = { node: OrgNode; x: number; y: number; row: number; loose: boolean };

/**
 * ວາງບັດ: ແຖວຕາມ Level ຂອງຕຳແໜ່ງ — ຄົນ Level ດຽວກັນຢູ່ແຖວດຽວກັນ ບໍ່ວ່າຈະລາຍງານຕໍ່ໃຜ ຫຼື ຍັງບໍ່ມີຫົວໜ້າສາຍງານ.
 * ພາຍໃນ Level ດຽວກັນ ຖ້າຕຳແໜ່ງໜຶ່ງລາຍງານຕໍ່ອີກຕຳແໜ່ງ (ເຊັ່ນ ຫົວໜ້າໜ່ວຍງານ → ຜູ້ຈັດການ ທັງສອງເປັນ Level 2)
 * ແຍກເປັນແຖວຍ່ອຍ Level 2.1, 2.2… ແລະ ຄົນຕຳແໜ່ງດຽວກັນຢູ່ແຖວຍ່ອຍດຽວກັນ. Level ຕ່ຳຢູ່ລຸ່ມທຸກແຖວຍ່ອຍຂອງ Level ສູງ.
 * ຕຳແໜ່ງທີ່ຍັງບໍ່ມີ Level: ຄົນຕຳແໜ່ງດຽວກັນແຖວດຽວກັນ. ລູກທີມຢູ່ຕ່ຳກວ່າຫົວໜ້າສະເໝີ (ຂໍ້ມູນບໍ່ສອດຄ່ອງ = ລົງແຖວຖັດໄປ).
 * ແນວນອນ: ແຕ່ລະກິ່ງມີແຖບຂອງຕົນ (ບໍ່ທັບກັນ), ຫົວໜ້າຢູ່ກາງລູກທີມ; ຕົ້ນຫຼັກກ່ອນ ແລ້ວຄົນທີ່ຍັງບໍ່ມີຫົວໜ້າສາຍງານ
 */
const layoutByLevel = (tree: OrgTree) => {
  const nodes = [...tree.byPerson.values()];
  const levelOf = (n: OrgNode) => n.position?.level ?? null;
  const posKey = (n: OrgNode) => (n.person.position_id ? `P${n.person.position_id}` : `N${n.person._uuid}`);
  const levels = [...new Set(nodes.map(levelOf).filter((l): l is number => !!l))].sort((a, b) => a - b);
  const passes = nodes.length * 2 + 2;

  // ແຖວຍ່ອຍພາຍໃນ Level: ຕຳແໜ່ງທີ່ລາຍງານຕໍ່ຕຳແໜ່ງອື່ນໃນ Level ດຽວກັນ ຢູ່ລຸ່ມມັນ 1 ແຖວຍ່ອຍ
  const sub = new Map<string, number>();
  const maxSub = new Set(nodes.map(posKey)).size - 1;
  for (let pass = 0; pass <= nodes.length; pass++) {
    let changed = false;
    for (const n of nodes) {
      const p = n.parent;
      if (!p || !levelOf(n) || levelOf(n) !== levelOf(p) || posKey(n) === posKey(p)) continue;
      // ຂໍ້ມູນວົນກັນ (ກ → ຂ → ກ) ບໍ່ໃຫ້ລົງເລິກເກີນຈຳນວນຕຳແໜ່ງ
      const need = Math.min(maxSub, (sub.get(posKey(p)) ?? 0) + 1);
      if ((sub.get(posKey(n)) ?? 0) < need) {
        sub.set(posKey(n), need);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const subOf = (n: OrgNode) => sub.get(posKey(n)) ?? 0;
  const height = new Map(levels.map((l) => [l, 1 + Math.max(0, ...nodes.filter((n) => levelOf(n) === l).map(subOf))]));
  const base = new Map<number, number>();
  levels.reduce((row, l) => (base.set(l, row), row + height.get(l)!), 0);
  const lowest = levels.length ? base.get(levels[levels.length - 1])! : 0;
  const unsetRow = new Map<string, number>();
  const rowOf = new Map<OrgNode, number>();
  const groupRow = (n: OrgNode) => {
    const level = levelOf(n);
    return level ? base.get(level)! + subOf(n) : unsetRow.get(posKey(n));
  };

  // ວົນຄິດຄືນຈົນບໍ່ປ່ຽນ: ແຖວຂອງ Level / ຕຳແໜ່ງໜຶ່ງ ດັນແຖວຂອງລູກທີມລົງນຳ
  for (let pass = 0; pass <= passes; pass++) {
    rowOf.clear();
    const assign = (n: OrgNode, parentRow: number | null) => {
      const want = groupRow(n);
      const row = parentRow === null ? want ?? lowest
        : n.parent && posKey(n.parent) === posKey(n) ? parentRow + 1
        : Math.max(want ?? parentRow + 1, parentRow + 1);
      rowOf.set(n, row);
      n.children.forEach((c) => assign(c, row));
    };
    tree.roots.forEach((r) => assign(r, null));
    let changed = false;
    for (const n of nodes) {
      const p = n.parent;
      if (p && posKey(p) === posKey(n)) continue;
      const level = levelOf(n);
      if (level) {
        // ຕ່ຳກວ່າຫົວໜ້າທີ່ຢູ່ Level ສູງກວ່າ / ບໍ່ມີ Level (ຫົວໜ້າ Level ຕ່ຳກວ່າຕົນ = ຂໍ້ມູນກັບກັນ ຂ້າມໄປ)
        const bossLevel = p ? levelOf(p) : null;
        if (p && (bossLevel === null || bossLevel < level)) {
          const need = rowOf.get(p)! + 1 - subOf(n);
          if (base.get(level)! < need) {
            base.set(level, need);
            changed = true;
          }
        }
      } else if ((unsetRow.get(posKey(n)) ?? -1) < rowOf.get(n)!) {
        unsetRow.set(posKey(n), rowOf.get(n)!);
        changed = true;
      }
    }
    for (let i = 1; i < levels.length; i++) {
      const need = base.get(levels[i - 1])! + height.get(levels[i - 1])!;
      if (base.get(levels[i])! < need) {
        base.set(levels[i], need);
        changed = true;
      }
    }
    if (!changed) break;
  }

  // ຕັດແຖວທີ່ບໍ່ມີໃຜອອກ (ເຊັ່ນ ແຖວທີ່ຖືກດັນລົງ ຫຼື ຂໍ້ມູນວົນກັນ) — ລຳດັບແຖວເກົ່າຍັງຄືເກົ່າ
  const used = [...new Set(rowOf.values())].sort((a, b) => a - b);
  const compact = new Map(used.map((r, i) => [r, i]));
  rowOf.forEach((r, n) => rowOf.set(n, compact.get(r)!));
  const levelAt = (row: number) => levels.find((l) => used[row] >= base.get(l)! && used[row] < base.get(l)! + height.get(l)!);

  // ລູກທີມແຖວໃກ້ກ່ອນ ແລ້ວແຖວລຸ່ມ — ລູກທີມທີ່ຢູ່ຫ່າງລົງໄປຈະຢູ່ຕິດກັນ ໃຊ້ເສັ້ນລຳດຽວລົງໄປຫາ
  const kidsOf = new Map(nodes.map((n) => [n, [...n.children].sort((a, b) => rowOf.get(a)! - rowOf.get(b)!)]));

  const widthOf = new Map<OrgNode, number>();
  const measure = (n: OrgNode): number => {
    const kids = n.children.reduce((sum, c) => sum + measure(c), 0) + GAP_X * Math.max(0, n.children.length - 1);
    const w = Math.max(CARD_W, kids);
    widthOf.set(n, w);
    return w;
  };
  const boxes: Box[] = [];
  const place = (n: OrgNode, left: number, loose: boolean): Box => {
    const w = widthOf.get(n)!;
    let x = left + (w - CARD_W) / 2;
    if (n.children.length) {
      const total = n.children.reduce((sum, c) => sum + widthOf.get(c)!, 0) + GAP_X * (n.children.length - 1);
      let cursor = left + (w - total) / 2;
      const kids = kidsOf.get(n)!.map((c) => {
        const box = place(c, cursor, false);
        cursor += widthOf.get(c)! + GAP_X;
        return box;
      });
      x = (kids[0].x + kids[kids.length - 1].x) / 2;
    }
    const box = { node: n, x, y: rowOf.get(n)! * PITCH, row: rowOf.get(n)!, loose };
    boxes.push(box);
    return box;
  };
  let cursor = GUTTER;
  for (const root of tree.roots) {
    measure(root);
    // ຜູ້ສູງສຸດ (Level 1) ບໍ່ຕ້ອງມີຫົວໜ້າ — ປ້າຍເຕືອນສະເພາະຄົນອື່ນທີ່ຍັງບໍ່ມີ
    place(root, cursor, root !== tree.main && (root.position?.level ?? 99) > 1);
    cursor += widthOf.get(root)! + ROOT_GAP;
  }
  const rows = boxes.length ? Math.max(...boxes.map((b) => b.row)) + 1 : 0;
  /** ປ້າຍແຖວ: "2" ຫຼື ແຖວຍ່ອຍ "2.1", "2.2"; null = ມີແຕ່ຕຳແໜ່ງທີ່ຍັງບໍ່ກຳນົດ Level; '' = ບໍ່ມີປ້າຍ */
  const rowLabels: (string | null)[] = Array.from({ length: rows }, (_, row) => {
    const level = levelAt(row);
    if (level) {
      const same = used.map((_r, i) => i).filter((i) => levelAt(i) === level);
      return same.length > 1 ? `${level}.${same.indexOf(row) + 1}` : String(level);
    }
    return boxes.some((b) => b.row === row && !levelOf(b.node)) ? null : '';
  });
  const byNode = new Map(boxes.map((b) => [b.node, b]));
  // ເສັ້ນ: ລົງຈາກຫົວໜ້າ → ເສັ້ນນອນ → ລົງຫາລູກທີມແຖວຖັດໄປ.
  // ລູກທີມທີ່ຢູ່ຫ່າງລົງໄປຫຼາຍແຖວ: ເສັ້ນລຳດຽວລົງໄປ → ເສັ້ນນອນເໜືອແຖວຂອງເຂົາ → ລົງຫາແຕ່ລະຄົນ (ບໍ່ແມ່ນເສັ້ນຍາວຂະໜານກັນຫຼາຍເສັ້ນ)
  const midX = (n: OrgNode) => byNode.get(n)!.x + CARD_W / 2;
  const lines = boxes.filter((b) => b.node.children.length).map((b) => {
    const px = b.x + CARD_W / 2;
    const bus = b.y + CARD_H + GAP_Y / 2;
    const kids = kidsOf.get(b.node)!;
    const near = kids.filter((c) => byNode.get(c)!.row === b.row + 1);
    const far = kids.filter((c) => byNode.get(c)!.row > b.row + 1);
    const farXs = far.map(midX);
    const trunk = far.length ? (Math.min(...farXs) + Math.max(...farXs)) / 2 : px;
    const xs = [px, trunk, ...near.map(midX)];
    let d = `M${px},${b.y + CARD_H}V${bus}M${Math.min(...xs)},${bus}H${Math.max(...xs)}`;
    for (const c of near) d += `M${midX(c)},${bus}V${byNode.get(c)!.y}`;
    if (far.length) {
      const farBus = Math.min(...far.map((c) => byNode.get(c)!.y)) - GAP_Y / 2;
      d += `M${trunk},${bus}V${farBus}M${Math.min(...farXs)},${farBus}H${Math.max(...farXs)}`;
      for (const c of far) d += `M${midX(c)},${farBus}V${byNode.get(c)!.y}`;
    }
    return d;
  });
  return { boxes, lines, rows, rowLabels, width: Math.max(cursor - ROOT_GAP, GUTTER + CARD_W) + 16, height: Math.max(0, rows * PITCH - GAP_Y) };
};

/** ມຸມມອງສາຍບັງຄັບບັນຊາ — ແຖວຕາມ Level (ປ້າຍ Level ທາງຊ້າຍ), ເສັ້ນເຊື່ອມແຕ້ມດ້ວຍ SVG */
const TreeView = ({ tree, ctx }: { tree: OrgTree; ctx: Ctx }) => {
  const t = useT();
  const layout = useMemo(() => layoutByLevel(tree), [tree]);
  return (
    <div className="org-level-tree" style={{ width: layout.width, height: layout.height }}>
      {Array.from({ length: layout.rows }, (_, row) => (
        <div key={row} className="org-level-band" style={{ top: row * PITCH - GAP_Y / 4, height: CARD_H + GAP_Y / 2 }}>
          {layout.rowLabels[row] !== '' && (
            <span className={`org-level-tag${layout.rowLabels[row] ? '' : ' is-unset'}`} title={layout.rowLabels[row] ? undefined : t('hrLevelUnsetHint')}>
              {layout.rowLabels[row] ? `Level ${layout.rowLabels[row]}` : t('hrLevelUnset')}
            </span>
          )}
        </div>
      ))}
      <svg className="org-level-lines" width={layout.width} height={layout.height} aria-hidden="true">
        {layout.lines.map((d, i) => <path key={i} d={d} />)}
      </svg>
      {layout.boxes.map((b) => (
        <div key={b.node.person._uuid} className="org-level-slot" style={{ left: b.x, top: b.y, width: CARD_W, height: CARD_H }}>
          <NodeCard node={b.node} ctx={ctx} loose={b.loose} />
        </div>
      ))}
    </div>
  );
};

/** ຄົນໃນຖັນພະແນກ — ແລ້ວລູກທີມໃນພະແນກດຽວກັນ ລຽງລົງແບບມີເສັ້ນທາງຊ້າຍ */
const ColumnNode = ({ node, ctx }: { node: OrgNode; ctx: Ctx }) => {
  const kids = node.children.filter((c) => c.person.department_id === node.person.department_id);
  return (
    <div className="org-col-node">
      <div className={`org-row${hit(node, ctx.query) ? ' is-hit' : ''}`}>
        <HrAvatar url={node.person.profile_url} name={node.person.first_name} size="sm" />
        <span className="org-row-text">
          <b>{personName(node.person)}</b>
          <small>{node.position?.position_name ?? node.person.emp_code}</small>
        </span>
        <EditButton node={node} ctx={ctx} />
      </div>
      {kids.length > 0 && <div className="org-col-kids">{kids.map((c) => <ColumnNode key={c.person._uuid} node={c} ctx={ctx} />)}</div>}
    </div>
  );
};

/**
 * ມຸມມອງຕາມຝ່າຍ — ຂັ້ນບໍລິຫານ (ພະແນກທີ່ໝາຍ "ຂັ້ນບໍລິຫານ"; ບໍ່ມີ = ພະແນກຂອງຜູ້ສູງສຸດ) ຢູ່ເທິງ,
 * ແຕ່ລະພະແນກເປັນຖັນ: ຫົວໜ້າພະແນກ ແລ້ວລູກທີມລຽງລົງ
 */
const DeptView = ({ tree, ctx }: { tree: OrgTree; ctx: Ctx }) => {
  const t = useT();
  const flagged = tree.departments.filter(isExecutive);
  const topIds = new Set(flagged.length ? flagged.map((d) => d._uuid) : tree.main ? [tree.main.person.department_id] : []);
  const topNames = tree.departments.filter((d) => topIds.has(d._uuid)).map((d) => d.depart_name);
  const inTop = (n: OrgNode) => topIds.has(n.person.department_id);
  const nodes = [...tree.byPerson.values()];
  const topRoots = nodes.filter((n) => inTop(n) && (!n.parent || !inTop(n.parent)));
  const columns = tree.departments
    .filter((d) => !topIds.has(d._uuid))
    .map((d) => {
      const own = nodes.filter((n) => n.person.department_id === d._uuid);
      const heads = own.filter((n) => !n.parent || n.parent.person.department_id !== d._uuid)
        .sort((a, b) => (a.position?.level ?? 99) - (b.position?.level ?? 99));
      return { dept: d, own, heads };
    })
    .filter((c) => c.own.length);

  return (
    <ul className="org-tree">
      <li>
        {topRoots.length > 0 && (
          <div className="org-top">
            {topNames.length > 0 && <span className="org-top-title"><i className="fa-solid fa-crown" /> {topNames.join(' · ')}</span>}
            <ul className="org-tree">{topRoots.map((r) => <Branch key={r.person._uuid} node={r} ctx={ctx} keep={inTop} />)}</ul>
          </div>
        )}
        {columns.length > 0 && (
          <ul>
            {columns.map(({ dept, own, heads }) => {
              const boss = heads.find((h) => h.parent)?.parent;
              const linked = heads.some((h) => inMainTree(tree, h));
              return (
                <li key={dept._uuid}>
                  <div className={`org-col ${toneClass(heads[0]?.tone ?? 0)}`}>
                    <header>
                      <b>{dept.depart_name}</b>
                      <small>{dept.depart_code} · {own.length} {t('hrPeople')}</small>
                      {boss ? <span className="org-col-boss"><i className="fa-solid fa-arrow-turn-up" /> {personName(boss.person)}</span>
                        : !linked && <span className="org-col-boss is-warn"><i className="fa-solid fa-triangle-exclamation" /> {t('hrNoBoss')}</span>}
                    </header>
                    <div className="org-col-body">{heads.map((h) => <ColumnNode key={h.person._uuid} node={h} ctx={ctx} />)}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </li>
    </ul>
  );
};

/** ປ່ຽນຫົວໜ້າສາຍງານຂອງຄົນ 1 ຄົນ (PUT /org/boss/:id) — ລະບົບແນະນຳຕາມ Level ຂອງຕຳແໜ່ງ */
const BossModal = ({ node, data, tree, onClose, onSaved }: {
  node: OrgNode;
  data: OrgData;
  tree: OrgTree;
  onClose: () => void;
  onSaved: (data: OrgData) => void;
}) => {
  const t = useT();
  const [boss, setBoss] = useState<number | null>(node.person.reports_to_id);
  const [saving, setSaving] = useState(false);
  const suggested = suggestBoss(data, node.person);
  const options = useBossOptions(data, tree, node.person._uuid, suggested);
  const save = async () => {
    try {
      setSaving(true);
      const res = await putApi(`/org/boss/${btoa(String(node.person._uuid))}`, { reports_to_id: boss });
      Notific.success('saveSuccessDone');
      onSaved(res.data?.data);
      onClose();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <SettingModal title={t('hrChangeBoss')} hint={`${personName(node.person)} · ${jobOf(node)}`} icon="fa-sitemap" saving={saving}
      onClose={onClose} onSubmit={save} compact keyboard={false}
    >
      <div className="org-boss-form">
        <span className="org-boss-label">{t('hrReportsTo')}</span>
        <BossSelect options={options} value={boss} onChange={setBoss} />
        {suggested && suggested !== boss && (
          <button type="button" className="org-boss-suggest" onClick={() => setBoss(suggested)}>
            <i className="fa-solid fa-wand-magic-sparkles" /> {t('hrSuggested')}: {personName(tree.byPerson.get(suggested)!.person)}
          </button>
        )}
        <small className="org-boss-note">{t('hrBossNote')}</small>
      </div>
    </SettingModal>
  );
};

/**
 * ໂຄງຮ່າງການຈັດຕັ້ງ — ສອງມຸມມອງ: ສາຍບັງຄັບບັນຊາ (ຕົ້ນໄມ້ຂອງຄົນ) / ຕາມຝ່າຍ (ບໍລິຫານຢູ່ເທິງ, ພະແນກເປັນຖັນ).
 * ຂໍ້ມູນ = ຫົວໜ້າສາຍງານຂອງແຕ່ລະຄົນ (ຟອມພະນັກງານ) + Level ຂອງຕຳແໜ່ງ.
 * ✎ = ປ່ຽນຫົວໜ້າສາຍງານ; "ຈັດອັດຕະໂນມັດ" = ໃສ່ຫົວໜ້າທີ່ແນະນຳໃຫ້ຄົນທີ່ຍັງບໍ່ມີ. ຄົ້ນຫາ, ຊູມ, ລາກ, ພິມ
 */
const OrgChartPage = () => {
  const t = useT();
  const org = useOrgData();
  const [view, setView] = useState<View>(readView);
  const [keyword, setKeyword] = useState('');
  const [zoom, setZoom] = useState(1);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [editing, setEditing] = useState<OrgNode | null>(null);
  const [assigning, setAssigning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const fitted = useRef(false);

  const tree = useMemo(() => buildOrgTree(org.data), [org.data]);
  const query = keyword.trim().toLowerCase();
  const ctx: Ctx = { query, onEdit: canEdit ? setEditing : undefined };
  const noBoss = tree.roots.filter((r) => r !== tree.main).length;
  const unleveled = org.data.positions.filter((p) => !p.level).length;

  const chooseView = (next: View) => {
    // ມຸມມອງໃໝ່ກວ້າງບໍ່ເທົ່າກັນ — ພໍດີຈໍຄືນເມື່ອວັດຂະໜາດໃໝ່ແລ້ວ
    if (next !== view) fitted.current = false;
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch { /* ບໍ່ມີບ່ອນເກັບ — ໃຊ້ຄ່າເລີ່ມຕົ້ນຄັ້ງໜ້າ */ }
  };

  // ຂະໜາດແທ້ຂອງຮູບ (transform ບໍ່ປ່ຽນ offsetWidth) — ໃຊ້ກັບກ່ອງເລື່ອນ ແລະ ການພິມ
  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return undefined;
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [org.loading, view]);

  /** ວັດຈາກ DOM ຕອນນີ້ (ບໍ່ໃຊ້ state) — ຫຼັງປ່ຽນມຸມມອງ state ຍັງເປັນຂະໜາດເກົ່າ */
  const fit = () => {
    const box = scrollRef.current;
    const width = canvasRef.current?.offsetWidth ?? 0;
    const height = canvasRef.current?.offsetHeight ?? 0;
    if (!box || !width) return;
    // ເຫັນທັງໝົດ (ກວ້າງ ແລະ ສູງ) ແຕ່ບໍ່ນ້ອຍກວ່າ 50% ໃຫ້ຍັງອ່ານຊື່ໄດ້
    const byHeight = height ? (box.clientHeight - 48) / height : 1;
    setZoom(Math.max(Math.max(ZOOM_MIN, 0.5), Math.min(1, (box.clientWidth - 32) / width, byHeight)));
  };
  // ຄັ້ງທຳອິດ / ປ່ຽນມຸມມອງ: ຫຍໍ້ໃຫ້ພໍດີຄວາມກວ້າງ (ບໍ່ຂະຫຍາຍເກີນ 100%)
  useEffect(() => {
    if (fitted.current || !size.w || org.loading) return;
    fitted.current = true;
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, org.loading, view]);

  // ຄົ້ນຫາ → ເລື່ອນໄປຫາບັດທຳອິດທີ່ກົງ
  useEffect(() => {
    if (!query) return;
    canvasRef.current?.querySelector('.is-hit')?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }, [query, view]);

  const step = (delta: number) => setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + delta) * 10) / 10)));

  const startPan = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, input, a')) return;
    const box = scrollRef.current!;
    pan.current = { x: e.clientX, y: e.clientY, left: box.scrollLeft, top: box.scrollTop };
    box.classList.add('is-panning');
  };
  const movePan = (e: ReactMouseEvent<HTMLDivElement>) => {
    const start = pan.current;
    if (!start) return;
    const box = scrollRef.current!;
    box.scrollLeft = start.left - (e.clientX - start.x);
    box.scrollTop = start.top - (e.clientY - start.y);
  };
  const endPan = () => {
    pan.current = null;
    scrollRef.current?.classList.remove('is-panning');
  };

  /** ພິມ A4 ແນວນອນ — ຫຍໍ້ໃຫ້ພໍດີໜ້າດຽວ */
  const print = () => {
    const el = canvasRef.current;
    if (!el || !size.w) return;
    const scale = Math.min(1, 1060 / size.w, 660 / size.h);
    const wrap = document.createElement('div');
    wrap.className = 'org-print';
    const title = document.createElement('h2');
    title.className = 'org-print-title';
    title.textContent = `${t('hrOrgChart')} · ${moment().format('DD/MM/YYYY')}`;
    const sizer = document.createElement('div');
    sizer.style.cssText = `width:${size.w * scale}px;height:${size.h * scale}px;overflow:hidden;margin:0 auto`;
    const copy = el.cloneNode(true) as HTMLElement;
    copy.style.transform = `scale(${scale})`;
    copy.querySelectorAll('.org-edit').forEach((b) => b.remove());
    sizer.appendChild(copy);
    wrap.append(title, sizer);
    printElementByFrame(wrap, '@page { size: A4 landscape; margin: 8mm; } html, body { background: #fff !important; }');
  };

  /** ໃສ່ຫົວໜ້າສາຍງານທີ່ແນະນຳໃຫ້ທຸກຄົນທີ່ຍັງບໍ່ມີ (ບໍ່ແຕະຄົນທີ່ມີແລ້ວ) */
  const autoAssign = () => Notific.confirm(t('hrAutoBossConfirm'), async () => {
    try {
      setAssigning(true);
      const res = await postApi('/org/auto-boss', {});
      org.setData(res.data?.data);
      fitted.current = false;
      Notific.success(t('hrAutoBossDone').replace('{n}', String(res.data?.updated ?? 0)));
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setAssigning(false);
    }
  });

  return (
    <div className="acs-page org-page">
      <SettingToolbar
        stats={[
          { label: t('hrDepartments'), value: realDepartments(tree.departments).length },
          { label: t('hrEmployees'), value: org.data.people.length, tone: 'green' },
          ...(noBoss ? [{ label: t('hrNoBoss'), value: noBoss, tone: 'gold' as const }] : []),
        ]}
        keyword={keyword}
        onKeyword={setKeyword}
        placeholder={t('hrOrgSearch')}
      >
        <div className="acc-type-segment" role="tablist">
          <button type="button" role="tab" aria-selected={view === 'tree'} className={view === 'tree' ? 'is-active' : ''} onClick={() => chooseView('tree')}>
            <i className="fa-solid fa-sitemap" /> {t('hrReportLine')}
          </button>
          <button type="button" role="tab" aria-selected={view === 'dept'} className={view === 'dept' ? 'is-active' : ''} onClick={() => chooseView('dept')}>
            <i className="fa-solid fa-table-columns" /> {t('hrOrgByDept')}
          </button>
        </div>
        <div className="org-zoom">
          <button type="button" className="acc-gl-act" title={t('hrZoomOut')} aria-label={t('hrZoomOut')} onClick={() => step(-0.1)} disabled={zoom <= ZOOM_MIN}>
            <i className="fa-solid fa-minus" />
          </button>
          <button type="button" className="org-zoom-value" title={t('hrZoomReset')} onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
          <button type="button" className="acc-gl-act" title={t('hrZoomIn')} aria-label={t('hrZoomIn')} onClick={() => step(0.1)} disabled={zoom >= ZOOM_MAX}>
            <i className="fa-solid fa-plus" />
          </button>
          <button type="button" className="acc-gl-act" title={t('hrZoomFit')} aria-label={t('hrZoomFit')} onClick={fit}>
            <i className="fa-solid fa-expand" />
          </button>
        </div>
        <button type="button" className="acc-rp-btn" onClick={print} disabled={!tree.byPerson.size}>
          <i className="fa-solid fa-print" /> {t('print')}
        </button>
        {canEdit && noBoss > 0 && (
          <button type="button" className="acc-rp-btn is-primary" onClick={autoAssign} disabled={assigning}>
            <i className="fa-solid fa-wand-magic-sparkles" /> {t('hrAutoBoss')}
          </button>
        )}
      </SettingToolbar>

      {(noBoss > 0 || unleveled > 0) && (
        <div className="hr-note is-warn org-hint">
          <i className="fa-solid fa-circle-info" />
          {[noBoss > 0 && t('hrNoBossHint').replace('{n}', String(noBoss)), unleveled > 0 && t('hrUnleveledHint').replace('{n}', String(unleveled))]
            .filter(Boolean).join(' · ')}
        </div>
      )}

      <ListState loading={org.loading && !org.data.people.length} empty={!tree.byPerson.size} icon="fa-sitemap">
        <div ref={scrollRef} className="org-scroll" onMouseDown={startPan} onMouseMove={movePan} onMouseUp={endPan} onMouseLeave={endPan}>
          <div className="org-sizer" style={{ width: size.w * zoom || undefined, height: size.h * zoom || undefined }}>
            <div ref={canvasRef} className={`org-canvas is-${view}${query ? ' has-query' : ''}`} style={{ transform: `scale(${zoom})` }}>
              {view === 'tree' ? <TreeView tree={tree} ctx={ctx} /> : <DeptView tree={tree} ctx={ctx} />}
            </div>
          </div>
        </div>
      </ListState>

      {editing && <BossModal node={editing} data={org.data} tree={tree} onClose={() => setEditing(null)} onSaved={org.setData} />}
    </div>
  );
};

export default OrgChartPage;
