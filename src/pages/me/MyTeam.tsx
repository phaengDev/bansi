import { useMemo, useState } from 'react';
import { Loader } from 'rsuite';
import { useT } from '../../context/LanguageContext';
import { Notific } from '../../utils/Notification';
import { useGetData } from '../hr/attendance/attendanceApi';
import { HrAvatar } from '../hr/hrKit';
import { buildOrgTree, personName, reportLineOf, useOrgData, type OrgNode } from '../hr/org/orgModel';
import { DepartmentFilter, SearchBox } from '../account/setting/settingKit';
import type { Colleague, ColleagueData } from './meApi';

const nameOf = (c: Pick<Colleague, 'first_name' | 'last_name'>) => [c.first_name, c.last_name].filter(Boolean).join(' ');

/** ປ້າຍຂອງມື້ນີ້ — ຂ້ອຍ / ລາພັກ / ວັນເກີດ */
const DayTags = ({ person }: { person?: Colleague }) => {
  const t = useT();
  if (!person) return null;
  return (
    <span className="my-person-tags">
      {person.is_me && <em className="is-me">{t('myMe')}</em>}
      {person.on_leave_today && <em className="is-leave"><i className="fa-solid fa-plane-departure" /> {t('myOnLeaveToday')}</em>}
      {person.birthday_today && <em className="is-birthday"><i className="fa-solid fa-cake-candles" /> {t('myBirthdayToday')}</em>}
    </span>
  );
};

/** ເບີໂທ — ກົດ = ໂທ (ມືຖື / app ໂທ), ປຸ່ມ = ສຳເນົາ */
const Phone = ({ phone }: { phone: string | null }) => {
  const t = useT();
  if (!phone) return <span className="my-person-phone is-empty">—</span>;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(phone);
      Notific.success('myCopied');
    } catch {
      Notific.warning(phone);
    }
  };
  return (
    <span className="my-person-phone">
      <a href={`tel:${phone.replace(/\s+/g, '')}`}><i className="fa-solid fa-phone" /> {phone}</a>
      <button type="button" onClick={copy} title={t('myCopyPhone')} aria-label={t('myCopyPhone')}><i className="fa-regular fa-copy" /></button>
    </span>
  );
};

/** ຄົນໃນສາຍງານ (ຫົວໜ້າ / ລູກທີມ) — ຮູບ, ຊື່, ຕຳແໜ່ງ + ເບີໂທ ແລະ ປ້າຍມື້ນີ້ຈາກລາຍຊື່ເພື່ອນຮ່ວມງານ */
const LinePerson = ({ node, info }: { node: OrgNode; info?: Colleague }) => (
  <li className="my-line-person">
    <HrAvatar url={node.person.profile_url} name={node.person.first_name} />
    <span>
      <b>{personName(node.person)}</b>
      <small>{node.position?.position_name ?? node.person.emp_code}{node.department ? ` · ${node.department.depart_name}` : ''}</small>
      <DayTags person={info} />
    </span>
    {info && <Phone phone={info.phone} />}
  </li>
);

/**
 * ທີມງານ — ສາຍງານຂອງຂ້ອຍ (ຫົວໜ້າ ແລະ ລູກທີມ ຈາກໂຄງຮ່າງ), ມື້ນີ້ໃຜລາພັກ / ວັນເກີດ ແລະ ລາຍຊື່ເພື່ອນຮ່ວມງານທຸກພະແນກ
 * (ສະເພາະຂໍ້ມູນຕິດຕໍ່ວຽກ: ຊື່, ຮູບ, ເບີໂທ, ພະແນກ, ຕຳແໜ່ງ — ຄືແຖບ "ທີມງານ" ໃນ app)
 */
const MyTeam = () => {
  const t = useT();
  const { data, loading, reload } = useGetData<ColleagueData>('/employee/me/colleagues');
  const org = useOrgData('/org/me');
  const [keyword, setKeyword] = useState('');
  const [dept, setDept] = useState<number | null>(null);

  const tree = useMemo(() => buildOrgTree(org.data), [org.data]);
  const line = reportLineOf(tree, org.data.me_id);
  const byId = useMemo(() => new Map((data?.data ?? []).map((c) => [c._uuid, c])), [data]);
  const people = data?.data ?? [];

  const departments = useMemo(() => [...new Map(people.filter((c) => c.department).map((c) => [c.department!._uuid, c.department!])).values()], [people]);

  const query = keyword.trim().toLowerCase();
  const shown = people.filter((c) =>
    (!dept || c.department?._uuid === dept)
    && (!query || `${nameOf(c)} ${c.emp_code} ${c.phone ?? ''} ${c.position?.position_name ?? ''} ${c.department?.depart_name ?? ''}`.toLowerCase().includes(query)));
  // ລຽງມາແລ້ວຕາມພະແນກ → ຈັດກຸ່ມຕາມລຳດັບທີ່ມາ
  const groups = shown.reduce<{ key: string; name: string; rows: Colleague[] }[]>((list, c) => {
    const key = String(c.department?._uuid ?? 0);
    const last = list[list.length - 1];
    if (last?.key === key) last.rows.push(c);
    else list.push({ key, name: c.department?.depart_name ?? t('myNoDepartment'), rows: [c] });
    return list;
  }, []);

  const onLeave = people.filter((c) => c.on_leave_today);
  const birthdays = people.filter((c) => c.birthday_today);

  const refresh = () => {
    reload();
    org.reload();
  };

  return (
    <div className="acc-rp att-page my-page">
      <div className="acc-rp-filters">
        <div className="acc-rp-filter-row">
          <SearchBox value={keyword} onChange={setKeyword} placeholder={t('myTeamSearch')} grow />
          <DepartmentFilter departments={departments} value={dept} onChange={setDept} />
          <div className="acc-rp-actions">
            <button type="button" className="acc-rp-btn" onClick={refresh} disabled={loading || org.loading} aria-label={t('reload')}><i className="fa-solid fa-rotate-right" /></button>
          </div>
        </div>
      </div>

      {!data ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : (
        <div className={`acc-rp-body${loading ? ' is-refreshing' : ''}`}>
          <div className="my-grid">
            <section className="my-card">
              <header><h3><i className="fa-solid fa-sitemap" /> {t('myReportLine')}</h3></header>
              {org.loading && !line ? <Loader size="sm" /> : !line ? (
                <p className="my-empty">{t('myNotInOrg')}</p>
              ) : (
                <div className="my-line">
                  <small>{t('myBoss')}</small>
                  {line.boss ? <ul><LinePerson node={line.boss} info={byId.get(line.boss.person._uuid)} /></ul> : <p className="my-empty">{t(line.isTop ? 'myTopOfOrg' : 'myNoBoss')}</p>}
                  <small>{t('myTeamMembers')} <em>{line.team.length}</em></small>
                  {line.team.length ? (
                    <ul>{line.team.map((n) => <LinePerson key={n.person._uuid} node={n} info={byId.get(n.person._uuid)} />)}</ul>
                  ) : <p className="my-empty">{t('myNoTeamMembers')}</p>}
                </div>
              )}
            </section>

            <section className="my-card">
              <header><h3><i className="fa-solid fa-calendar-day" /> {t('myTeamToday')}</h3></header>
              <ul className="my-facts">
                <li><span>{t('myColleagues')}</span><b>{data.summary.total}</b></li>
                <li><span>{t('myOnLeaveToday')}</span><b>{data.summary.on_leave}</b></li>
                <li><span>{t('myBirthdayToday')}</span><b>{data.summary.birthdays}</b></li>
              </ul>
              {!onLeave.length && !birthdays.length ? (
                <p className="my-empty">{t('myTeamTodayQuiet')}</p>
              ) : (
                <ul className="my-today-people">
                  {[...birthdays, ...onLeave.filter((c) => !c.birthday_today)].map((c) => (
                    <li key={c._uuid}>
                      <HrAvatar url={c.profile_url} name={c.first_name} size="sm" />
                      <span><b>{nameOf(c)}</b><small>{c.department?.depart_name ?? ''}</small></span>
                      <DayTags person={c} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {!groups.length ? (
            <div className="acc-class-empty"><i className="fa-solid fa-users" /><p>{t('noData')}</p></div>
          ) : groups.map((group) => (
            <section key={group.key} className="my-dept">
              <h4 className="my-apv-head"><i className="fa-solid fa-building-user" /> {group.name} <em>{group.rows.length}</em></h4>
              <div className="my-people">
                {group.rows.map((c) => (
                  <article key={c._uuid} className={`my-person${c.is_me ? ' is-me' : ''}`}>
                    <HrAvatar url={c.profile_url} name={c.first_name} size="lg" />
                    <span className="my-person-info">
                      <b>{nameOf(c)}</b>
                      <small>{c.position?.position_name ?? '—'} · {c.emp_code}</small>
                      <DayTags person={c} />
                    </span>
                    <Phone phone={c.phone} />
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyTeam;
