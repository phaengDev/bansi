import moment from 'moment';
import { SelectPicker } from 'rsuite';
import { useT } from '../../../context/LanguageContext';
import type { EmployeeRef } from '../hrApi';
import { PAID_LEAVE, dayLabel, leaveTone, type LeaveBalance, type LeaveType } from './attendanceApi';
import type { LeaveFile } from './LeaveFiles';

/**
 * ຄຳຂໍລາພັກ ແລະ ແຈ້ງລືມສະແກນ — ໃຊ້ຮ່ວມກັນລະຫວ່າງໜ້າ HR (ອະນຸມັດ) ແລະ ພື້ນທີ່ຂອງຂ້ອຍ (ພະນັກງານຂໍເອງ).
 * status ຂອງທັງສອງ: 1 ລໍຖ້າ, 2 ອະນຸມັດ, 3 ປະຕິເສດ, 4 ຍົກເລີກ (ສີຢືມ .att-state)
 */
export const REQ_PENDING = 1;
export const REQ_APPROVED = 2;
export const REQ_REJECTED = 3;
export const REQ_CANCELLED = 4;
export const REQUEST_STATUSES: Record<number, { label: string; tone: string; icon: string }> = {
  [REQ_PENDING]: { label: 'leaveStatusPending', tone: 'is-late', icon: 'fa-hourglass-half' },
  [REQ_APPROVED]: { label: 'leaveStatusApproved', tone: 'is-present', icon: 'fa-circle-check' },
  [REQ_REJECTED]: { label: 'leaveStatusRejected', tone: 'is-absent', icon: 'fa-circle-xmark' },
  [REQ_CANCELLED]: { label: 'leaveStatusCancelled', tone: 'is-off', icon: 'fa-ban' },
};

/** lead_status — ຂັ້ນຫົວໜ້າທີມ (ລູກທີມ): 1 ລໍຫົວໜ້າ, 2 ຫົວໜ້າອະນຸມັດແລ້ວ (ລໍ HR), 3 ຫົວໜ້າປະຕິເສດ; null = HR ເລີຍ */
export const LEAD_WAITING = 1;
export const LEAD_APPROVED = 2;
export const LEAD_REJECTED = 3;

/** ປ້າຍສະຖານະ (ສີ + ໄອຄອນ + ຄຳ) ຈາກ meta ຂອງຕາຕະລາງສະຖານະໃດກໍໄດ້ (ຄຳຂໍ, ເງິນເບີກ …) */
export const StatusTag = ({ meta }: { meta: { label: string; tone: string; icon: string } }) => {
  const t = useT();
  return <span className={`att-state ${meta.tone}`}><i className={`fa-solid ${meta.icon}`} /> {t(meta.label)}</span>;
};

export type LeaveRequest = {
  _uuid: number;
  employee_id: number;
  /** null = ຄຳຂໍເກົ່າກ່ອນມີປະເພດ — ສະແດງຕາມ leave_type (ໄດ້/ບໍ່ໄດ້ເງິນເດືອນ) */
  leave_type_id: number | null;
  /** status ຂອງ tbl_attendance ທີ່ບັນທຶກຕອນອະນຸມັດ: 2 ໄດ້ເງິນເດືອນ, 3 ບໍ່ໄດ້ */
  leave_type: number;
  type: Pick<LeaveType, '_uuid' | 'name' | 'paid' | 'max_per_year' | 'max_per_request'> | null;
  start_date: string;
  end_date: string;
  /** ມື້ເຮັດວຽກໃນຊ່ວງ (ຕອນຂໍ) / ມື້ທີ່ບັນທຶກແທ້ (ຕອນອະນຸມັດ) */
  days: number;
  reason: string;
  status: number;
  review_note: string | null;
  reviewedAt: string | null;
  createdAt: string;
  employee?: (EmployeeRef & { position?: { _uuid: number; position_name: string } | null }) | null;
  /** ໃບລາທີ່ພະນັກງານແນບ (api ລຸ້ນເກົ່າ = ບໍ່ມີ) */
  files?: LeaveFile[];
  /** ຂັ້ນຫົວໜ້າທີມ (api ລຸ້ນເກົ່າ = ບໍ່ມີ) */
  lead_status?: number | null;
  lead_name?: string | null;
  lead_note?: string | null;
  lead_at?: string | null;
};

/** ປ້າຍຂັ້ນຫົວໜ້າທີມ — ລໍ / ອະນຸມັດ / ປະຕິເສດ ໂດຍໃຜ ເມື່ອໃດ */
export const LeadStep = ({ row }: { row: LeaveRequest }) => {
  const t = useT();
  if (!row.lead_status) return null;
  const meta = {
    [LEAD_WAITING]: { label: 'leaveLeadWaiting', icon: 'fa-user-clock', tone: 'is-wait' },
    [LEAD_APPROVED]: { label: 'leaveLeadApproved', icon: 'fa-user-check', tone: 'is-ok' },
    [LEAD_REJECTED]: { label: 'leaveLeadRejected', icon: 'fa-user-xmark', tone: 'is-no' },
  }[row.lead_status];
  if (!meta) return null;
  return (
    <span className={`lv-lead ${meta.tone}`}>
      <i className={`fa-solid ${meta.icon}`} /> {t(meta.label)}{row.lead_name ? ` · ${row.lead_name}` : ''}
      {row.lead_at && row.lead_status !== LEAD_WAITING && <em>{moment(row.lead_at).format('DD/MM HH:mm')}</em>}
      {row.lead_note && row.lead_status !== LEAD_REJECTED && <small>{row.lead_note}</small>}
    </span>
  );
};

/** ສະຖານະຂອງຄຳຂໍລາພັກ: ລໍຫົວໜ້າທີມ ຫຼື ສະຖານະ + ຂັ້ນຫົວໜ້າ + ໝາຍເຫດຂອງຜູ້ອະນຸມັດ */
export const LeaveStatusCell = ({ row }: { row: LeaveRequest }) => {
  const t = useT();
  const waitingLead = row.status === REQ_PENDING && row.lead_status === LEAD_WAITING;
  return (
    <>
      {waitingLead
        ? <span className="att-state is-late"><i className="fa-solid fa-user-clock" /> {t('leaveLeadWaiting')}</span>
        : <StatusTag meta={REQUEST_STATUSES[row.status] ?? REQUEST_STATUSES[REQ_PENDING]} />}
      <LeadStep row={row} />
      {row.review_note && <small className="acc-gl-ref d-block">{row.review_note}</small>}
    </>
  );
};

export const rangeLabel = (row: Pick<LeaveRequest, 'start_date' | 'end_date'>) =>
  row.start_date === row.end_date ? dayLabel(row.start_date) : `${dayLabel(row.start_date)} – ${dayLabel(row.end_date)}`;

/** ຊື່ປະເພດຂອງຄຳຂໍ + ສີຕາມ ໄດ້/ບໍ່ໄດ້ເງິນເດືອນ (ຄຳຂໍເກົ່າບໍ່ມີປະເພດ = ປ້າຍ ໄດ້/ບໍ່ໄດ້ເງິນເດືອນ) */
export const typeLabel = (row: LeaveRequest, t: (key: string) => string) => {
  const meta = leaveTone(row.type ? row.type.paid : row.leave_type === PAID_LEAVE);
  return { tone: meta.tone, label: row.type?.name ?? t(meta.label) };
};

/** ຄຳຂໍນີ້ເກີນຂີດຈຳກັດຂອງປະເພດ (ຕໍ່ຄັ້ງ / ມື້ທີ່ເຫຼືອຂອງປີ) */
export const isOver = (b: LeaveBalance | undefined, days: number) =>
  !!b && ((!!b.max_per_request && days > b.max_per_request) || (b.remaining !== null && days > b.remaining));

/** ຄຳຂໍ `days` ມື້ ເກີນຂີດຈຳກັດຂອງປະເພດນີ້ບໍ — ຕໍ່ຄັ້ງ / ມື້ທີ່ເຫຼືອໃນປີ (backend ບໍ່ໃຫ້ອະນຸມັດ) */
const overOf = (b: LeaveBalance, days: number) => ({
  request: !!b.max_per_request && days > b.max_per_request,
  year: b.remaining !== null && days > b.remaining,
});

/** ແຖວຂອງປະເພດການລາ — ໄອຄອນ (ສີຕາມໄດ້/ບໍ່ໄດ້ເງິນເດືອນ), ຊື່, ມື້ທີ່ເຫຼືອ; ເກີນສິດ = ສີແດງ. compact = ຄ່າທີ່ເລືອກໃນກ່ອງ (ແຖວດຽວ) */
const LeaveTypeLine = ({ b, days, compact }: { b: LeaveBalance; days: number; compact?: boolean }) => {
  const t = useT();
  const meta = leaveTone(b.paid);
  const over = overOf(b, days);
  const left = b.max_per_year ? `${t('lvBalanceLeft')} ${b.remaining} / ${b.max_per_year} ${t('leaveDayUnit')}` : t('lvTypeUnlimited');
  return (
    <span className={`lv-type-line ${meta.tone}${over.request || over.year ? ' is-over' : ''}${compact ? ' is-compact' : ''}`}>
      <span className="lv-type-icon"><i className={`fa-solid ${meta.icon}`} /></span>
      <span>
        <b>{b.name}</b>
        <small>{compact ? left : `${t(meta.label)} · ${left}`}</small>
        {!compact && (over.request || over.year) && (
          <small className="lv-type-over">
            <i className="fa-solid fa-triangle-exclamation" />{' '}
            {over.request ? `${t('lvOverRequest')} ${b.max_per_request} ${t('leaveDayUnit')}` : t('lvOverYear')}
          </small>
        )}
      </span>
    </span>
  );
};

/**
 * ປະເພດການລາ (ກ່ອງເລືອກ) + ມື້ທີ່ເຫຼືອໃນປີ — ປະເພດທີ່ຄຳຂໍນີ້ເກີນຂີດຈຳກັດ = ສີແດງ, ເລືອກແລ້ວມີຄຳເຕືອນໃຕ້ກ່ອງ.
 * HR ໃຊ້ຕອນອະນຸມັດ (ເລືອກປະເພດຄືນໄດ້), ພະນັກງານໃຊ້ຕອນຂໍລາພັກ
 */
export const LeaveTypePicker = ({ balances, days, value, onChange }: {
  balances: LeaveBalance[];
  days: number;
  value: number | null;
  onChange: (value: number) => void;
}) => {
  const t = useT();
  const byId = new Map(balances.map((b) => [b._uuid, b]));
  const picked = value ? byId.get(value) : undefined;
  const over = picked && overOf(picked, days);
  return (
    <div className="lv-type-pick">
      <SelectPicker
        block cleanable={false} searchable={balances.length > 8} placeholder={t('lvPickType')}
        data={balances.map((b) => ({ value: b._uuid, label: b.name }))} value={value}
        onChange={(v) => v !== null && onChange(v)}
        popupClassName="acc-book-menu lv-type-menu" locale={{ searchPlaceholder: t('search') }}
        renderOption={(_, item) => <LeaveTypeLine b={byId.get(item.value as number)!} days={days} />}
        renderValue={(v) => <LeaveTypeLine b={byId.get(v)!} days={days} compact />}
      />
      {over && (over.request || over.year) && (
        <p className="lv-type-over">
          <i className="fa-solid fa-triangle-exclamation" />{' '}
          {over.request ? `${t('lvOverRequest')} ${picked!.max_per_request} ${t('leaveDayUnit')}` : t('lvOverYear')}
        </p>
      )}
    </div>
  );
};

/** ແຈ້ງລືມສະແກນ (tbl_attendance_request) */
export type Correction = {
  _uuid: number;
  employee_id: number;
  work_date: string;
  /** ເວລາທີ່ຂໍ "HH:mm" — null = ໃຊ້ເວລາທີ່ສະແກນໄວ້ */
  check_in: string | null;
  check_out: string | null;
  reason: string;
  status: number;
  review_note: string | null;
  createdAt: string;
  /** ເວລາທີ່ບັນທຶກໄວ້ໃນມື້ນັ້ນ (ທຽບກັບເວລາທີ່ຂໍ) — ລາຍການຂອງ HR */
  recorded_in?: string | null;
  recorded_out?: string | null;
  employee?: (EmployeeRef & { position?: { _uuid: number; position_name: string } | null }) | null;
};

/** ເວລາທີ່ຂໍ (ຕົວເຂັ້ມ) ທຽບກັບທີ່ສະແກນໄວ້ — ບໍ່ໄດ້ຂໍ = ໃຊ້ທີ່ສະແກນໄວ້ (ຈາງ) */
export const TimePair = ({ requested, recorded }: { requested: string | null; recorded?: string | null }) =>
  requested ? (
    <span>
      <b>{requested}</b>
      {recorded && recorded !== requested && <small className="acc-gl-ref"> ({recorded})</small>}
    </span>
  ) : (
    <span className="acc-gl-ref">{recorded ?? '—'}</span>
  );
