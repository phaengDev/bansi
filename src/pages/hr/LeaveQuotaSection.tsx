import { useEffect, useState } from 'react';
import { InputNumber } from 'rsuite';
import { getApi, putApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { canEdit } from '../../utils/localStorage';
import { useT } from '../../context/LanguageContext';
import { SettingModal } from '../account/setting/settingKit';
import type { Employee } from './hrApi';

/** GET / PUT /leave/quota/:id — ສິດວັນລາຂອງພະນັກງານ 1 ປະເພດໃນປີ */
type LeaveQuotaRow = {
  _uuid: number;
  name: string;
  paid: number;
  /** ສິດຂອງປີນີ້ (ຕັ້ງສະເພາະ / ຕາມເດືອນຂອງປີທີ່ເລີ່ມວຽກ) — null = ບໍ່ຈຳກັດ */
  max_per_year: number | null;
  /** ສິດເຕັມປີ (ກ່ອນຄິດຕາມເດືອນ) */
  full_per_year: number | null;
  /** ຂອງປະເພດ (ໜ້າຕັ້ງຄ່າປະເພດການລາ) */
  default_per_year: number | null;
  /** HR ຕັ້ງສະເພາະຄົນນີ້ */
  custom: boolean;
  /** ປີທີ່ເລີ່ມວຽກ — ຄິດຕາມເດືອນທີ່ເຮັດວຽກ */
  prorated: boolean;
  used: number;
  pending: number;
  remaining: number | null;
};

const enc = (id: number) => btoa(String(id));

/**
 * ສິດວັນລາພັກຂອງພະນັກງານ (ແຖບຂໍ້ມູນ) — ແຕ່ລະປະເພດ: ເຫຼືອ / ສິດປີນີ້, ໃຊ້ແລ້ວ, ລໍຖ້າ.
 * HR ຕັ້ງສິດສະເພາະຄົນໄດ້ (ປ່ອຍຫວ່າງ = ຂອງປະເພດ); ປີທີ່ເລີ່ມວຽກ backend ຄິດຕາມເດືອນທີ່ເຮັດວຽກ.
 * ພະນັກງານເຫັນສິດຂອງຕົນເອງໃນ app (ໂປຣໄຟລ໌ → ວັນລາພັກຂອງຂ້ອຍ). ໂຫຼດບໍ່ໄດ້ / ຍັງບໍ່ມີປະເພດ = ບໍ່ສະແດງ
 */
export const LeaveQuotaSection = ({ employee }: { employee: Employee }) => {
  const t = useT();
  const [data, setData] = useState<{ year: string; rows: LeaveQuotaRow[] } | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let alive = true;
    getApi(`/leave/quota/${enc(employee._uuid)}`)
      .then((res) => alive && setData({ year: String(res.data?.year ?? ''), rows: res.data?.data ?? [] }))
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, [employee._uuid, employee.start_date]);

  if (!data || !data.rows.length) return null;
  return (
    <section className="hr-profile-block hr-leave-quota">
      <header>
        <h6><i className="fa-solid fa-plane-departure" /> {t('lqTitle')} {data.year}</h6>
        {canEdit && (
          <button type="button" className="acc-rp-btn" onClick={() => setEditing(true)}>
            <i className="fa-solid fa-pen" /> {t('lqEdit')}
          </button>
        )}
      </header>
      <div className="hr-lq-list">
        {data.rows.map((r) => (
          <div key={r._uuid} className="hr-lq-row">
            <span className="hr-lq-name">
              <b>{r.name}</b>
              <small>
                {r.custom ? t('lqCustom') : t('lqDefault')}
                {r.prorated && r.full_per_year !== null ? ` · ${t('lqProrated')} (${t('lqFull')} ${r.full_per_year})` : ''}
              </small>
            </span>
            <span className="hr-lq-used">
              {t('lqUsed')} {r.used}{r.pending ? ` · ${t('lqPending')} ${r.pending}` : ''} {t('leaveDayUnit')}
            </span>
            {r.max_per_year === null ? (
              <span className="hr-lq-left is-free">{t('lqUnlimited')}</span>
            ) : (
              <span className={`hr-lq-left${r.remaining === 0 ? ' is-out' : ''}`}>
                <b>{r.remaining}</b> / {r.max_per_year} <small>{t('lvBalanceLeft')}</small>
              </span>
            )}
          </div>
        ))}
      </div>
      {editing && (
        <LeaveQuotaModal
          employee={employee}
          rows={data.rows}
          onClose={() => setEditing(false)}
          onSaved={(year, rows) => setData({ year, rows })}
        />
      )}
    </section>
  );
};

/** ຕັ້ງສິດສະເພາະຄົນ — ມື້ເຮັດວຽກຕໍ່ປີເຕັມ; ປ່ອຍຫວ່າງ = ກັບໄປໃຊ້ຂອງປະເພດ */
const LeaveQuotaModal = ({ employee, rows, onClose, onSaved }: {
  employee: Employee;
  rows: LeaveQuotaRow[];
  onClose: () => void;
  onSaved: (year: string, rows: LeaveQuotaRow[]) => void;
}) => {
  const t = useT();
  const [values, setValues] = useState<Map<number, string>>(
    () => new Map(rows.map((r) => [r._uuid, r.custom && r.full_per_year !== null ? String(r.full_per_year) : ''])),
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const quotas = rows.map((r) => {
      const raw = (values.get(r._uuid) ?? '').trim();
      return { leave_type_id: r._uuid, days: raw === '' ? null : Number(raw) };
    });
    if (quotas.some((q) => q.days !== null && (!Number.isInteger(q.days) || q.days < 0 || q.days > 366))) {
      return Notific.warning('lqInvalid');
    }
    try {
      setSaving(true);
      const res = await putApi(`/leave/quota/${enc(employee._uuid)}`, { quotas });
      Notific.success('saveSuccessDone');
      onSaved(String(res.data?.year ?? ''), res.data?.data ?? rows);
      onClose();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingModal title={t('lqEdit')} hint={t('lqHint')} icon="fa-plane-departure" saving={saving} onClose={onClose} onSubmit={save} keyboard={false}>
      <div className="hr-lq-editor">
        {rows.map((r) => (
          <label key={r._uuid} className="hr-lq-field">
            <span>
              <b>{r.name}</b>
              <small>{t('lqDefault')}: {r.default_per_year ?? t('lqUnlimited')}{r.default_per_year !== null ? ` ${t('leaveDayUnit')}` : ''}</small>
            </span>
            <InputNumber
              min={0}
              max={366}
              value={values.get(r._uuid) ?? ''}
              placeholder={r.default_per_year === null ? t('lqUnlimited') : String(r.default_per_year)}
              postfix={t('leaveDayUnit')}
              onChange={(v) => setValues((m) => new Map(m).set(r._uuid, v === null || v === undefined ? '' : String(v)))}
            />
          </label>
        ))}
      </div>
    </SettingModal>
  );
};
