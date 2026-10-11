import { useCallback, useEffect, useState } from 'react';
import { Checkbox, DatePicker, Input, Loader } from 'rsuite';
import moment from 'moment';
import { deleteApi, getApi, postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canCreate, canDelete } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { ListState, SettingModal, SettingToolbar, YearStepper } from '../../account/setting/settingKit';
import { runSave } from '../../account/setting/settingApi';
import { dayLabel, toApiDay, weekdayKey, type Holiday } from './attendanceApi';

/** ແຖວໃນຟອມ — copied = ຄັດລອກມາຈາກປີກ່ອນ (ຕິກອອກໄດ້), ບໍ່ແມ່ນ = ເພີ່ມເອງ (ລຶບແຖວໄດ້) */
type HolidayRow = { key: number; date: Date | null; name: string; on: boolean; copied: boolean };
type RowProblem = 'date' | 'year' | 'name' | 'dup' | 'taken' | null;

let rowSeq = 0;
const blankRow = (): HolidayRow => ({ key: ++rowSeq, date: null, name: '', on: true, copied: false });

/**
 * ເພີ່ມວັນພັກຫຼາຍວັນພ້ອມກັນ — ວັນພັກຂອງປີກ່ອນຂຶ້ນມາໃຫ້ເລືອກ (ວັນ-ເດືອນເດີມ ເລື່ອນມາປີນີ້) ເພາະແຕ່ລະປີສ່ວນຫຼາຍຄືເກົ່າ:
 * ຕິກອອກວັນທີ່ບໍ່ພັກ, ແກ້ວັນທີ່ທີ່ປ່ຽນທຸກປີ (ບຸນຕາມຈັນທະຄະຕິ), ກົດເພີ່ມວັນທີສຳລັບວັນພັກໃໝ່.
 * ວັນທີ່ມີແລ້ວໃນປີນີ້ (ວັນທີ ຫຼື ຊື່ດຽວກັນ) ບໍ່ຂຶ້ນໃຫ້ເລືອກ; ປີນີ້ຍັງບໍ່ມີວັນພັກ = ຕິກໃຫ້ທັງໝົດ
 */
const HolidayForm = ({ year, existing, onClose, onSaved }: { year: number; existing: Holiday[]; onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<HolidayRow[] | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    const takenDates = new Set(existing.map((h) => h.holiday_date));
    const takenNames = new Set(existing.map((h) => h.name.trim()));
    getApi(`/holiday/fetch?year=${year - 1}`)
      .then((res) => {
        const copied = ((res.data?.data ?? []) as Holiday[])
          .map((h) => ({ date: moment(h.holiday_date, 'YYYY-MM-DD').year(year), name: h.name.trim() }))
          .filter((h) => !takenDates.has(h.date.format('YYYY-MM-DD')) && !takenNames.has(h.name))
          .map((h): HolidayRow => ({ key: ++rowSeq, date: h.date.toDate(), name: h.name, on: !existing.length, copied: true }));
        if (alive) setRows(copied.length ? copied : [blankRow()]);
      })
      .catch(() => alive && setRows([blankRow()]));
    return () => {
      alive = false;
    };
  }, [year, existing]);

  const list = rows ?? [];
  const copied = list.filter((r) => r.copied);
  const picked = list.filter((r) => r.on);
  const allCopiedOn = copied.length > 0 && copied.every((r) => r.on);

  const patch = (key: number, change: Partial<HolidayRow>) =>
    setRows((prev) => prev && prev.map((r) => (r.key === key ? { ...r, ...change } : r)));
  const toggleAllCopied = (on: boolean) => setRows((prev) => prev && prev.map((r) => (r.copied ? { ...r, on } : r)));
  const addRow = () => setRows((prev) => [...(prev ?? []), blankRow()]);
  const removeRow = (key: number) => setRows((prev) => prev && prev.filter((r) => r.key !== key));

  /** ກວດສະເພາະແຖວທີ່ຕິກ */
  const problemOf = (row: HolidayRow): RowProblem => {
    if (!row.on) return null;
    if (!row.date) return 'date';
    const day = toApiDay(row.date);
    if (row.date.getFullYear() !== year) return 'year';
    if (!row.name.trim()) return 'name';
    if (existing.some((h) => h.holiday_date === day)) return 'taken';
    if (picked.some((r) => r.key !== row.key && r.date && toApiDay(r.date) === day)) return 'dup';
    return null;
  };
  const PROBLEM_KEYS: Record<Exclude<RowProblem, null>, string> = {
    date: 'attHolidayDateRequired',
    year: 'attHolidayWrongYear',
    name: 'attHolidayNameRequired',
    dup: 'attHolidayDuplicate',
    taken: 'attHolidayTaken',
  };

  const submit = async () => {
    setChecked(true);
    if (!picked.length) return Notific.warning('attHolidayPickOne');
    if (picked.some((r) => problemOf(r))) return Notific.warning('attHolidayFixRows');
    const items = picked.map((r) => ({ holiday_date: toApiDay(r.date as Date), name: r.name.trim() }));
    if (await runSave(() => postApi('/holiday/create', { items }), setSaving)) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal title={t('attHolidayAdd')} hint={t('attHolidayHint')} icon="fa-umbrella-beach" saving={saving} onClose={onClose} onSubmit={submit} className="att-holiday-modal">
      {!rows ? (
        <div className="text-center py-4"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : (
        <div className="att-holiday-form">
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
                return (
                  <div key={row.key} className={`att-holiday-row${row.on ? '' : ' is-off'}${problem ? ' is-invalid' : ''}`}>
                    <span className="att-holiday-lead">
                      {row.copied
                        ? <Checkbox checked={row.on} onChange={(_, on) => patch(row.key, { on })} />
                        : <span className="att-holiday-num">{index + 1}</span>}
                    </span>
                    <DatePicker
                      value={row.date} onChange={(date) => patch(row.key, { date, on: true })} oneTap format="dd/MM/yyyy"
                      placeholder="dd/mm/yyyy" cleanable={false} disabled={!row.on} calendarDefaultDate={moment(`${year}-01-01`).toDate()}
                      shouldDisableDate={(d) => d.getFullYear() !== year} block
                    />
                    <span className={`att-holiday-weekday${row.date ? '' : ' is-empty'}`}>
                      {row.date ? t(weekdayKey(toApiDay(row.date))) : '—'}
                    </span>
                    <Input value={row.name} onChange={(name) => patch(row.key, { name })} placeholder={t('attHolidayPlaceholder')} maxLength={150} disabled={!row.on} />
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
                {t('attHolidayWillSave')} <b>{picked.length}</b> {t('attHolidayDays')}
              </span>
            </div>
          </div>
        </div>
      )}
    </SettingModal>
  );
};

/**
 * ວັນພັກລັດຖະການ / ວັນພັກຂອງບໍລິສັດ (ນອກຈາກວັນພັກປະຈຳອາທິດ) ຕໍ່ປີ — ບໍ່ນັບເປັນມື້ເຮັດວຽກ: ບໍ່ສະແກນກໍ່ບໍ່ຂາດວຽກ
 * ແລະ ບໍ່ນັບໃນມື້ເຮັດວຽກຂອງເງິນເດືອນ (ໃບເງິນເດືອນທີ່ເປັນຮ່າງ ໃຫ້ກົດຄິດໄລ່ໃໝ່)
 */
const HolidayPage = () => {
  const t = useT();
  const [year, setYear] = useState(moment().year());
  const [rows, setRows] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

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

  const remove = (row: Holiday) =>
    Notific.confirm(`${t('attHolidayDeleteConfirm')} ${row.name} (${dayLabel(row.holiday_date)})`, async () => {
      try {
        await deleteApi(`/holiday/${btoa(String(row._uuid))}`);
        Notific.success('acsDeleted');
        reload();
      } catch (error) {
        Notific.error(getErrorMessage(error));
      }
    });

  const today = toApiDay(new Date());

  return (
    <div className="acs-page">
      <SettingToolbar
        stats={[{ label: t('attHolidays'), value: rows.length }]}
        addLabel={t('attHolidayAdd')}
        onAdd={() => setAdding(true)}
        canAdd={canCreate}
      >
        <YearStepper year={year} onChange={setYear} max={moment().year() + 1} />
      </SettingToolbar>
      <p className="acc-bg-note"><i className="fa-solid fa-circle-info" /> {t('attHolidayNote')}</p>

      <ListState loading={loading} empty={!rows.length} icon="fa-umbrella-beach">
        <div className="att-holidays">
          {rows.map((row) => (
            <article key={row._uuid} className={`att-holiday${row.holiday_date < today ? ' is-past' : ''}`}>
              <span className="att-holiday-date">
                <b>{moment(row.holiday_date).format('DD')}</b>
                <small>{moment(row.holiday_date).format('MM/YYYY')}</small>
              </span>
              <span className="att-holiday-text">
                <b>{row.name}</b>
                <small>{t(weekdayKey(row.holiday_date))}</small>
              </span>
              <button type="button" className="acc-gl-act is-danger" disabled={!canDelete} title={t('delete')} onClick={() => remove(row)}>
                <i className="fa-solid fa-trash" />
              </button>
            </article>
          ))}
        </div>
      </ListState>

      {adding && <HolidayForm year={year} existing={rows} onClose={() => setAdding(false)} onSaved={reload} />}
    </div>
  );
};

export default HolidayPage;
