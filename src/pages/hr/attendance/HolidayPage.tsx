import { useCallback, useEffect, useMemo, useState } from 'react';
import { Checkbox, DatePicker, DateRangePicker, Input, Loader } from 'rsuite';
import moment from 'moment';
import { deleteApi, getApi, postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canCreate, canDelete } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { ListState, SettingModal, SettingToolbar, YearStepper } from '../../account/setting/settingKit';
import { runSave } from '../../account/setting/settingApi';
import { HOLIDAY_COMPANY, HOLIDAY_OFFICIAL, toApiDay, weekdayKey, type Holiday } from './attendanceApi';

/** ປະເພດວັນພັກ — ທັງສອງແບບ ພະນັກງານທຸກຄົນພັກ ແລະ ບໍ່ນັບເປັນມື້ເຮັດວຽກ */
const HOLIDAY_KINDS: Record<number, { label: string; hint: string; icon: string; tone: string; placeholder: string }> = {
  [HOLIDAY_OFFICIAL]: {
    label: 'attHolidayOfficial', hint: 'attHolidayOfficialHint', icon: 'fa-landmark', tone: 'is-official', placeholder: 'attHolidayPlaceholder',
  },
  [HOLIDAY_COMPANY]: {
    label: 'attHolidayCompany', hint: 'attHolidayCompanyHint', icon: 'fa-champagne-glasses', tone: 'is-company', placeholder: 'attHolidayCompanyPlaceholder',
  },
};
const kindOf = (kind: number | undefined) => HOLIDAY_KINDS[Number(kind)] ?? HOLIDAY_KINDS[HOLIDAY_OFFICIAL];

/** ທຸກວັນໃນຊ່ວງ "YYYY-MM-DD" */
const datesOf = (start: Date | string, end: Date | string) => {
  const dates: string[] = [];
  for (const d = moment(start).startOf('day'); !d.isAfter(moment(end), 'day'); d.add(1, 'day')) dates.push(d.format('YYYY-MM-DD'));
  return dates;
};

/** ວັນພັກບໍ່ເປັນທາງການທີ່ຕິດກັນ ຊື່ດຽວກັນ (ເຊັ່ນ ໄປທ່ຽວ 04–05/05) ລວມເປັນກຸ່ມດຽວ — ທາງການ ມື້ລະກຸ່ມສະເໝີ */
type HolidayGroup = { key: string; name: string; kind: number; start: string; end: string; rows: Holiday[] };
const groupHolidays = (rows: Holiday[]) => {
  const groups: HolidayGroup[] = [];
  [...rows].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date)).forEach((row) => {
    const last = groups[groups.length - 1];
    const kind = Number(row.kind) || HOLIDAY_OFFICIAL;
    const next = last && moment(last.end).add(1, 'day').format('YYYY-MM-DD');
    if (kind === HOLIDAY_COMPANY && last && last.kind === kind && last.name === row.name.trim() && next === row.holiday_date) {
      last.end = row.holiday_date;
      last.rows.push(row);
    } else {
      groups.push({ key: String(row._uuid), name: row.name.trim(), kind, start: row.holiday_date, end: row.holiday_date, rows: [row] });
    }
  });
  return groups;
};

/** ແຖວໃນຟອມ — ຊ່ວງວັນທີ (ທາງການ ມື້ດຽວສະເໝີ: ວັນເລີ່ມ = ວັນສິ້ນສຸດ); copied = ຄັດລອກມາຈາກປີກ່ອນ (ຕິກອອກໄດ້), ບໍ່ແມ່ນ = ເພີ່ມເອງ (ລຶບແຖວໄດ້) */
type HolidayRow = { key: number; range: [Date, Date] | null; name: string; on: boolean; copied: boolean };
type RowProblem = 'date' | 'year' | 'name' | 'dup' | 'taken' | null;

let rowSeq = 0;
const blankRow = (): HolidayRow => ({ key: ++rowSeq, range: null, name: '', on: true, copied: false });

const PROBLEM_KEYS: Record<Exclude<RowProblem, null>, string> = {
  date: 'attHolidayDateRequired',
  year: 'attHolidayWrongYear',
  name: 'attHolidayNameRequired',
  dup: 'attHolidayDuplicate',
  taken: 'attHolidayTaken',
};

/**
 * ເພີ່ມວັນພັກ — ເລືອກປະເພດກ່ອນ:
 * - ທາງການ (ລັດຖະການ): ມື້ລະລາຍການ (ພັກ 3 ມື້ = 3 ລາຍການ); ວັນພັກທາງການຂອງປີກ່ອນຂຶ້ນມາໃຫ້ເລືອກ (ວັນ-ເດືອນເດີມ ເລື່ອນມາປີນີ້)
 *   ເພາະແຕ່ລະປີສ່ວນຫຼາຍຄືເກົ່າ — ຕິກອອກວັນທີ່ບໍ່ພັກ, ແກ້ວັນທີທີ່ປ່ຽນທຸກປີ (ບຸນຕາມຈັນທະຄະຕິ); ປີນີ້ຍັງບໍ່ມີ = ຕິກໃຫ້ທັງໝົດ
 * - ບໍ່ເປັນທາງການ (ບໍລິສັດປະກາດເອງ ເຊັ່ນ ໄປທ່ຽວ, ພັກພິເສດ): ແຕ່ລະແຖວເປັນຊ່ວງວັນທີ, ເລີ່ມແຖວຫວ່າງ; ບັນທຶກແລ້ວແຈ້ງເຕືອນເດັ້ງຂຶ້ນຈໍມືຖືພະນັກງານທຸກຄົນທັນທີ (ທຸກວັນທີ)
 * ບັນທຶກເປັນມື້ລະແຖວໃນ tbl_holiday, ສະເພາະແຖວຂອງປະເພດທີ່ເລືອກຢູ່
 */
const HolidayForm = ({ year, existing, onClose, onSaved }: { year: number; existing: Holiday[]; onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState(HOLIDAY_OFFICIAL);
  const [rowsByKind, setRowsByKind] = useState<Record<number, HolidayRow[]> | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    const takenDates = new Set(existing.map((h) => h.holiday_date));
    const officialNow = existing.filter((h) => Number(h.kind) !== HOLIDAY_COMPANY);
    const takenNames = new Set(officialNow.map((h) => h.name.trim()));
    getApi(`/holiday/fetch?year=${year - 1}`)
      .then((res) => {
        const previous = ((res.data?.data ?? []) as Holiday[]).filter((h) => Number(h.kind) !== HOLIDAY_COMPANY);
        const copied = previous
          .map((h) => ({ date: moment(h.holiday_date, 'YYYY-MM-DD').year(year), name: h.name.trim() }))
          .filter((h) => !takenDates.has(h.date.format('YYYY-MM-DD')) && !takenNames.has(h.name))
          .map((h): HolidayRow => ({ key: ++rowSeq, range: [h.date.toDate(), h.date.toDate()], name: h.name, on: !officialNow.length, copied: true }));
        if (alive) setRowsByKind({ [HOLIDAY_OFFICIAL]: copied.length ? copied : [blankRow()], [HOLIDAY_COMPANY]: [blankRow()] });
      })
      .catch(() => alive && setRowsByKind({ [HOLIDAY_OFFICIAL]: [blankRow()], [HOLIDAY_COMPANY]: [blankRow()] }));
    return () => {
      alive = false;
    };
  }, [year, existing]);

  const list = rowsByKind?.[kind] ?? [];
  const copied = list.filter((r) => r.copied);
  const picked = list.filter((r) => r.on);
  const allCopiedOn = copied.length > 0 && copied.every((r) => r.on);
  const meta = kindOf(kind);

  const setList = (update: (rows: HolidayRow[]) => HolidayRow[]) =>
    setRowsByKind((prev) => prev && { ...prev, [kind]: update(prev[kind] ?? []) });
  const patch = (key: number, change: Partial<HolidayRow>) => setList((rows) => rows.map((r) => (r.key === key ? { ...r, ...change } : r)));
  const toggleAllCopied = (on: boolean) => setList((rows) => rows.map((r) => (r.copied ? { ...r, on } : r)));
  const addRow = () => setList((rows) => [...rows, blankRow()]);
  const removeRow = (key: number) => setList((rows) => rows.filter((r) => r.key !== key));

  const daysOf = (row: HolidayRow) => (row.range ? datesOf(row.range[0], row.range[1]) : []);
  const totalDays = picked.reduce((n, r) => n + daysOf(r).length, 0);

  /** ກວດສະເພາະແຖວທີ່ຕິກ */
  const problemOf = (row: HolidayRow): RowProblem => {
    if (!row.on) return null;
    if (!row.range) return 'date';
    const days = daysOf(row);
    if (days.some((d) => !d.startsWith(`${year}-`))) return 'year';
    if (!row.name.trim()) return 'name';
    if (days.some((d) => existing.some((h) => h.holiday_date === d))) return 'taken';
    if (picked.some((r) => r.key !== row.key && daysOf(r).some((d) => days.includes(d)))) return 'dup';
    return null;
  };

  const submit = async () => {
    setChecked(true);
    if (!picked.length) return Notific.warning('attHolidayPickOne');
    if (picked.some((r) => problemOf(r))) return Notific.warning('attHolidayFixRows');
    const items = picked.flatMap((r) => daysOf(r).map((holiday_date) => ({ holiday_date, name: r.name.trim(), kind })));
    if (await runSave(() => postApi('/holiday/create', { items }), setSaving)) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal title={t('attHolidayAdd')} hint={t('attHolidayHint')} icon="fa-umbrella-beach" saving={saving} onClose={onClose} onSubmit={submit} className="att-holiday-modal">
      {!rowsByKind ? (
        <div className="text-center py-4"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : (
        <div className="att-holiday-form">
          <div className="att-kind-tiles" role="radiogroup">
            {Object.entries(HOLIDAY_KINDS).map(([value, item]) => {
              const on = kind === Number(value);
              return (
                <button
                  key={value} type="button" role="radio" aria-checked={on}
                  className={`att-kind ${item.tone}${on ? ' is-on' : ''}`}
                  onClick={() => {
                    setKind(Number(value));
                    setChecked(false);
                  }}
                >
                  <span className="att-kind-icon"><i className={`fa-solid ${item.icon}`} /></span>
                  <span>
                    <b>{t(item.label)}</b>
                    <small>{t(item.hint)}</small>
                  </span>
                  <i className={`att-kind-check fa-${on ? 'solid fa-circle-check' : 'regular fa-circle'}`} />
                </button>
              );
            })}
          </div>

          {copied.length > 0 && (
            <div className="att-holiday-copy">
              <i className="fa-solid fa-clone" />
              <span>
                <b>{t('attHolidayFromYear')} {year - 1}</b>
                <small>{t('attHolidayFromYearHint')}</small>
              </span>
              <Checkbox checked={allCopiedOn} indeterminate={!allCopiedOn && copied.some((r) => r.on)} onChange={(_, on) => toggleAllCopied(on)}>
                {t('attHolidaySelectAll')}
              </Checkbox>
            </div>
          )}

          <div className="att-holiday-table">
            <div className="att-holiday-head">
              <span>#</span>
              <span>{t('date')}<em>*</em></span>
              <span>{t('attHolidayWeekday')}</span>
              <span>{t('attHolidayName')}<em>*</em></span>
              <span />
            </div>

            <div className="att-holiday-rows">
              {list.map((row, index) => {
                const problem = checked ? problemOf(row) : null;
                const days = daysOf(row);
                return (
                  <div key={row.key} className={`att-holiday-row${row.on ? '' : ' is-off'}${problem ? ' is-invalid' : ''}`}>
                    <span className="att-holiday-lead">
                      {row.copied
                        ? <Checkbox checked={row.on} onChange={(_, on) => patch(row.key, { on })} />
                        : <span className="att-holiday-num">{index + 1}</span>}
                    </span>
                    {kind === HOLIDAY_OFFICIAL ? (
                      <DatePicker
                        value={row.range?.[0] ?? null} onChange={(date) => patch(row.key, { range: date ? [date, date] : null, on: true })}
                        oneTap format="dd/MM/yyyy" placeholder="dd/mm/yyyy" cleanable={false} disabled={!row.on} block
                        calendarDefaultDate={moment(`${year}-01-01`).toDate()} shouldDisableDate={(d) => d.getFullYear() !== year}
                      />
                    ) : (
                      <DateRangePicker
                        value={row.range} onChange={(range) => patch(row.key, { range, on: true })} format="dd/MM/yyyy" character=" – "
                        placeholder={t('attHolidayRangePlaceholder')} cleanable={false} disabled={!row.on} showOneCalendar block
                        ranges={[]} defaultCalendarValue={[moment(`${year}-01-01`).toDate(), moment(`${year}-01-01`).toDate()]}
                        shouldDisableDate={(d) => d.getFullYear() !== year}
                      />
                    )}
                    <span className={`att-holiday-weekday${days.length ? '' : ' is-empty'}${days.length > 1 ? ' is-range' : ''}`}>
                      {!days.length ? '—' : days.length === 1 ? t(weekdayKey(days[0])) : `${days.length} ${t('attHolidayDays')}`}
                    </span>
                    <Input value={row.name} onChange={(name) => patch(row.key, { name })} placeholder={t(meta.placeholder)} maxLength={150} disabled={!row.on} />
                    {row.copied ? (
                      <span className="att-holiday-tag" title={`${t('attHolidayFromYear')} ${year - 1}`}>{year - 1}</span>
                    ) : (
                      <button type="button" className="att-holiday-remove" title={t('delete')} onClick={() => removeRow(row.key)}>
                        <i className="fa-solid fa-trash-can" />
                      </button>
                    )}
                    {problem && <small className="att-holiday-error"><i className="fa-solid fa-circle-exclamation" /> {t(PROBLEM_KEYS[problem])}</small>}
                  </div>
                );
              })}
            </div>

            <div className="att-holiday-foot">
              <button type="button" className="att-holiday-add" onClick={addRow}>
                <i className="fa-solid fa-plus" /> {t('attHolidayAddRow')}
              </button>
              <span className="att-holiday-count">
                {t('attHolidayWillSave')} <b>{totalDays}</b> {t('attHolidayDays')}
              </span>
            </div>
          </div>
        </div>
      )}
    </SettingModal>
  );
};

/** ວັນທີຂອງກຸ່ມ — ມື້ດຽວ "14" / ຊ່ວງໃນເດືອນດຽວ "14–16" / ຂ້າມເດືອນ "30/04–02/05" */
const groupDay = (g: HolidayGroup) => {
  const start = moment(g.start);
  const end = moment(g.end);
  if (g.start === g.end) return { day: start.format('DD'), month: start.format('MM/YYYY') };
  if (start.month() === end.month()) return { day: `${start.format('DD')}–${end.format('DD')}`, month: start.format('MM/YYYY') };
  return { day: `${start.format('DD/MM')}–${end.format('DD/MM')}`, month: start.format('YYYY') };
};

/**
 * ວັນພັກທົ່ວບໍລິສັດ (ນອກຈາກວັນພັກປະຈຳອາທິດ) ຕໍ່ປີ — ທາງການ (ລັດຖະການ) ແລະ ບໍ່ເປັນທາງການ (ບໍລິສັດປະກາດເອງ);
 * ພະນັກງານທຸກຄົນພັກ: ບໍ່ສະແກນກໍ່ບໍ່ຂາດວຽກ ແລະ ບໍ່ນັບໃນມື້ເຮັດວຽກຂອງເງິນເດືອນ (ໃບເງິນເດືອນທີ່ເປັນຮ່າງ ໃຫ້ກົດຄິດໄລ່ໃໝ່).
 * ທາງການ = ບັດລະມື້; ບໍ່ເປັນທາງການ ມື້ທີ່ຕິດກັນ ຊື່ດຽວກັນ ສະແດງເປັນບັດດຽວ — ລຶບກໍ່ລຶບທັງຊ່ວງ
 */
const HolidayPage = () => {
  const t = useT();
  const [year, setYear] = useState(moment().year());
  const [rows, setRows] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  /** 0 = ທັງໝົດ */
  const [filter, setFilter] = useState(0);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getApi(`/holiday/fetch?year=${year}`);
      setRows(res.data?.data ?? []);
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    reload();
  }, [reload]);

  const groups = useMemo(() => groupHolidays(rows), [rows]);
  const shown = filter ? groups.filter((g) => g.kind === filter) : groups;
  const countDays = (kind: number) => rows.filter((r) => (Number(r.kind) || HOLIDAY_OFFICIAL) === kind).length;
  const tabs = [
    { key: 0, label: 'all', value: rows.length },
    { key: HOLIDAY_OFFICIAL, label: HOLIDAY_KINDS[HOLIDAY_OFFICIAL].label, value: countDays(HOLIDAY_OFFICIAL) },
    { key: HOLIDAY_COMPANY, label: HOLIDAY_KINDS[HOLIDAY_COMPANY].label, value: countDays(HOLIDAY_COMPANY) },
  ];

  const remove = (g: HolidayGroup) => {
    const { day, month } = groupDay(g);
    Notific.confirm(`${t('attHolidayDeleteConfirm')} ${g.name} (${day}/${month})`, async () => {
      try {
        for (const row of g.rows) await deleteApi(`/holiday/${btoa(String(row._uuid))}`);
        Notific.success('acsDeleted');
      } catch (error) {
        Notific.error(getErrorMessage(error));
      } finally {
        reload();
      }
    });
  };

  const today = toApiDay(new Date());

  return (
    <div className="acs-page">
      <SettingToolbar stats={[{ label: t('attHolidayDaysOff'), value: rows.length }]} addLabel={t('attHolidayAdd')} onAdd={() => setAdding(true)} canAdd={canCreate}>
        <div className="acc-type-segment" role="tablist">
          {tabs.map((tab) => (
            <button key={tab.key} type="button" role="tab" aria-selected={filter === tab.key} className={filter === tab.key ? 'is-active' : ''} onClick={() => setFilter(tab.key)}>
              {t(tab.label)} <em>{tab.value}</em>
            </button>
          ))}
        </div>
        <YearStepper year={year} onChange={setYear} max={moment().year() + 1} />
      </SettingToolbar>
      <p className="acc-bg-note"><i className="fa-solid fa-circle-info" /> {t('attHolidayNote')}</p>

      <ListState loading={loading} empty={!shown.length} icon="fa-umbrella-beach">
        <div className="att-holidays">
          {shown.map((g) => {
            const meta = kindOf(g.kind);
            const { day, month } = groupDay(g);
            const sub = g.rows.length === 1
              ? t(weekdayKey(g.start))
              : `${g.rows.length} ${t('attHolidayDays')} · ${t(weekdayKey(g.start))} – ${t(weekdayKey(g.end))}`;
            return (
              <article key={g.key} className={`att-holiday ${meta.tone}${g.end < today ? ' is-past' : ''}`}>
                <span className={`att-holiday-date${day.length > 2 ? ' is-range' : ''}`}>
                  <b>{day}</b>
                  <small>{month}</small>
                </span>
                <span className="att-holiday-text">
                  <b title={g.name}>{g.name}</b>
                  <small>{sub}</small>
                  <em className="att-holiday-kind"><i className={`fa-solid ${meta.icon}`} /> {t(meta.label)}</em>
                </span>
                <button type="button" className="acc-gl-act is-danger" disabled={!canDelete} title={t('delete')} onClick={() => remove(g)}>
                  <i className="fa-solid fa-trash" />
                </button>
              </article>
            );
          })}
        </div>
      </ListState>

      {adding && <HolidayForm year={year} existing={rows} onClose={() => setAdding(false)} onSaved={reload} />}
    </div>
  );
};

export default HolidayPage;
