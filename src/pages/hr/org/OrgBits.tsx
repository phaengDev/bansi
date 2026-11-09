import { useMemo, type ReactNode } from 'react';
import { SelectPicker } from 'rsuite';
import { useT } from '../../../context/LanguageContext';
import { HrAvatar } from '../hrKit';
import { levelText } from '../hrApi';
import { descendantsOf, isExecutive, personName, reportLineOf, type OrgData, type OrgNode, type OrgTree } from './orgModel';

/** ຕຳແໜ່ງ · ພະແນກ (ຂັ້ນບໍລິຫານບໍ່ສະແດງຊື່ພະແນກ) */
export const jobOf = (node: OrgNode) =>
  [node.position?.position_name, isExecutive(node.department) ? null : node.department?.depart_name].filter(Boolean).join(' · ');

/** ຄົນ 1 ຄົນ — ຮູບ + ຊື່ + ຕຳແໜ່ງ; ກົດໄດ້ເມື່ອມີ onOpen */
const PersonChip = ({ node, onOpen }: { node: OrgNode; onOpen?: (id: number) => void }) => {
  const body = (
    <>
      <HrAvatar url={node.person.profile_url} name={node.person.first_name} size="sm" />
      <span className="org-chip-text">
        <b>{personName(node.person)}</b>
        <small>{jobOf(node) || node.person.emp_code}</small>
      </span>
    </>
  );
  return onOpen
    ? <button type="button" className="org-chip is-link" onClick={() => onOpen(node.person._uuid)}>{body}</button>
    : <span className="org-chip">{body}</span>;
};

/**
 * ສາຍບັງຄັບບັນຊາຂອງຄົນ — "ລາຍງານຕໍ່" (ຫົວໜ້າ) ແລະ "ລູກທີມ" ທຸກຄົນ (ຮູບ, ຊື່, ຕຳແໜ່ງ).
 * ໃຊ້ໃນລາຍລະອຽດພະນັກງານ (onOpen = ກົດໄປເບິ່ງຄົນນັ້ນ) ແລະ ຟອມພະນັກງານ (showBoss=false — ຫົວໜ້າເລືອກຢູ່ picker)
 */
export const ReportLineBox = ({ tree, personId, showBoss = true, onOpen }: {
  tree: OrgTree;
  personId: number | null | undefined;
  showBoss?: boolean;
  onOpen?: (id: number) => void;
}) => {
  const t = useT();
  const line = reportLineOf(tree, personId);
  if (!line) return null;
  const { boss, team, isTop } = line;
  return (
    <div className="org-line">
      {showBoss && (
        <div className="org-line-row">
          <span className="org-line-label"><i className="fa-solid fa-arrow-turn-up" /> {t('hrReportsTo')}</span>
          {boss ? <PersonChip node={boss} onOpen={onOpen} /> : (
            <span className={`org-line-empty${isTop ? ' is-top' : ''}`}>
              {isTop ? <><i className="fa-solid fa-crown" /> {t('hrTopPosition')}</> : <><i className="fa-solid fa-triangle-exclamation" /> {t('hrNoBoss')}</>}
            </span>
          )}
        </div>
      )}
      <div className="org-line-row is-team">
        <span className="org-line-label"><i className="fa-solid fa-arrow-turn-down" /> {t('hrTeam')} {team.length > 0 && <em>{team.length}</em>}</span>
        {team.length ? (
          <span className="org-line-team">{team.map((c) => <PersonChip key={c.person._uuid} node={c} onOpen={onOpen} />)}</span>
        ) : <span className="org-line-empty">{t('hrNoTeam')}</span>}
      </div>
    </div>
  );
};

/**
 * ຕົວເລືອກຫົວໜ້າ — ພະນັກງານທີ່ເຮັດວຽກຢູ່ (ຈັດກຸ່ມຕາມພະແນກ), ບໍ່ລວມຕົນເອງ ແລະ ລູກທີມຂອງຕົນ (ກັນວົນ).
 * ຄົນທີ່ລະບົບແນະນຳ ມີປ້າຍ "ແນະນຳ"
 */
export const useBossOptions = (data: OrgData, tree: OrgTree, selfId: number | null | undefined, suggested: number | null) => {
  const t = useT();
  return useMemo(() => {
    const blocked = descendantsOf(tree, selfId);
    const deptName = new Map(data.departments.map((d) => [d._uuid, d.depart_name]));
    const deptRank = new Map(data.departments.map((d, i) => [d._uuid, i]));
    // ກຸ່ມຕາມລຳດັບພະແນກ, ໃນກຸ່ມ Level ສູງກ່ອນ
    return [...tree.byPerson.values()]
      .filter((n) => n.person._uuid !== selfId && !blocked.has(n.person._uuid))
      .sort((a, b) => (deptRank.get(a.person.department_id) ?? 99) - (deptRank.get(b.person.department_id) ?? 99)
        || (a.position?.level ?? 99) - (b.position?.level ?? 99) || personName(a.person).localeCompare(personName(b.person)))
      .map((n) => ({
        value: n.person._uuid,
        label: personName(n.person),
        group: deptName.get(n.person.department_id) ?? '',
        node: n,
        suggested: n.person._uuid === suggested,
        hint: t('hrSuggested'),
      }));
  }, [data.departments, tree, selfId, suggested, t]);
};

/** ແຖວຕົວເລືອກຫົວໜ້າ — ຮູບ + ຊື່ + ຕຳແໜ່ງ + ປ້າຍແນະນຳ */
export const bossOption = (label: ReactNode, item: any) => item?.node && (
  <span className="hr-org-opt">
    <HrAvatar url={item.node.person.profile_url} name={item.node.person.first_name} size="sm" />
    <span>
      <b>{label}</b>
      <small>{item.node.position?.position_name ?? item.node.person.emp_code}</small>
    </span>
    {item.suggested && <em className="org-suggest">{item.hint}</em>}
  </span>
);

/** ຄ່າທີ່ເລືອກ — ຮູບນ້ອຍ + ຊື່ */
export const bossValue = (_: unknown, item: any) => item?.node && (
  <span className="hr-org-value"><HrAvatar url={item.node.person.profile_url} name={item.node.person.first_name} size="sm" /> {item.label}</span>
);

/** ເລືອກຫົວໜ້າແບບ SelectPicker ທຳມະດາ (ນອກ Form) — ໃຊ້ໃນໜ້າໂຄງຮ່າງ */
export const BossSelect = ({ options, value, onChange }: {
  options: ReturnType<typeof useBossOptions>;
  value: number | null;
  onChange: (value: number | null) => void;
}) => {
  const t = useT();
  return (
    <SelectPicker block data={options} groupBy="group" value={value} placeholder={t('hrNoBossPick')}
      renderOption={bossOption} renderValue={bossValue} locale={{ searchPlaceholder: t('search'), noResultsText: t('noData') }}
      onChange={(v) => onChange((v as number | null) ?? null)} popupClassName="acc-book-menu hr-org-menu"
    />
  );
};

/** ປ້າຍ Level ຂອງຕຳແໜ່ງ — ບໍ່ມີ = "ຍັງບໍ່ກຳນົດ Level" */
export const LevelTag = ({ level }: { level: number | null | undefined }) => {
  const t = useT();
  return <span className={`org-level${level ? '' : ' is-unset'}`}>{levelText(level) ?? t('hrLevelUnset')}</span>;
};
