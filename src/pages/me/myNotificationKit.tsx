import moment from 'moment';
import { putApi } from '../../utils/configApi';
import { markReadLocally, refreshMyInbox } from './meInbox';
import { idOf, type MyIntent, type MyNotification, type MyOpen } from './meApi';

/** ໄອຄອນ + ສີ ຕາມປະເພດແຈ້ງເຕືອນ (type ຈາກ notify() ຂອງ backend) */
const TYPE_META: Record<string, { icon: string; tone: string }> = {
  payroll: { icon: 'fa-wallet', tone: 'is-gold' },
  advance: { icon: 'fa-hand-holding-dollar', tone: 'is-gold' },
  leave: { icon: 'fa-plane-departure', tone: 'is-sky' },
  attendance: { icon: 'fa-fingerprint', tone: 'is-sky' },
  overtime: { icon: 'fa-business-time', tone: 'is-sky' },
  approval: { icon: 'fa-clipboard-check', tone: 'is-violet' },
  task: { icon: 'fa-list-check', tone: 'is-emerald' },
  workplan: { icon: 'fa-calendar-week', tone: 'is-emerald' },
  holiday: { icon: 'fa-umbrella-beach', tone: 'is-coral' },
  birthday: { icon: 'fa-cake-candles', tone: 'is-coral' },
  birthday_wish: { icon: 'fa-gift', tone: 'is-coral' },
  birthday_reply: { icon: 'fa-comment-dots', tone: 'is-coral' },
  announcement: { icon: 'fa-bullhorn', tone: 'is-slate' },
};
const metaOf = (type: string) => TYPE_META[type] ?? { icon: 'fa-bell', tone: 'is-slate' };

/** ແຈ້ງເຕືອນ → ໜ້າຂອງພື້ນທີ່ຂອງຂ້ອຍທີ່ກ່ຽວຂ້ອງ (ref = "<ປະເພດ>:<id>…"); null = ອ່ານຢ່າງດຽວ (ເຊັ່ນ ແຈ້ງການ) */
export const notificationTarget = (n: MyNotification): { key: string; intent?: MyIntent } | null => {
  const [kind, a] = (n.ref ?? '').split(':');
  switch (kind) {
    case 'leave': return { key: 'leaves' };
    case 'correction': return { key: 'corrections' };
    case 'advance': return { key: 'advances' };
    case 'payroll': return { key: 'pay' };
    case 'task': return { key: 'tasks', intent: Number(a) > 0 ? { action: 'open', id: Number(a) } : undefined };
    case 'approve': return { key: 'approvals', intent: a ? { action: 'tab', tab: a } : undefined };
    case 'workplan': return { key: 'workplans' };
    case 'overtime': return { key: 'attendance' };
    case 'holiday': return { key: 'today' };
    case 'birthday':
    case 'wish': return { key: 'team' };
    default: break;
  }
  return n.type === 'attendance' ? { key: 'attendance' } : null;
};

/** ກົດແຈ້ງເຕືອນ: ອ່ານແລ້ວ (ຕົວເລກຫຼຸດທັນທີ) ແລະ ເປີດໜ້າທີ່ກ່ຽວຂ້ອງ (ຖ້າມີ) */
export const openNotification = (n: MyNotification, onOpen: MyOpen) => {
  if (n.is_new) {
    markReadLocally(n._uuid);
    putApi(`/notification/me/read/${idOf(n)}`, {}).catch(() => refreshMyInbox());
  }
  const target = notificationTarget(n);
  if (target) onOpen(target.key, target.intent);
};

/** ໃໝ່ສຸດກ່ອນ */
export const newestFirst = (rows: MyNotification[]) =>
  [...rows].sort((a, b) => moment(b.createdAt).valueOf() - moment(a.createdAt).valueOf() || b._uuid - a._uuid);

/**
 * ແຖວແຈ້ງເຕືອນໜຶ່ງ — ໃຊ້ຮ່ວມ: ໜ້າ ແຈ້ງເຕືອນຂອງຂ້ອຍ ແລະ ກ່ອງ "ຂອງຂ້ອຍ" ໃນ taskbar.
 * ຍັງບໍ່ອ່ານ = ພື້ນອ່ອນ + ຂີດຊ້າຍ + ຈຸດ; time = ຮູບແບບເວລາ (ກ່ອງໃນ taskbar ບອກມື້ນຳ)
 */
export const NotificationItem = ({ n, onClick, time = 'HH:mm' }: { n: MyNotification; onClick: () => void; time?: string }) => {
  const meta = metaOf(n.type);
  const target = notificationTarget(n);
  return (
    <button type="button" className={`my-notification${n.is_new ? ' is-new' : ''}${target ? '' : ' is-static'}`} onClick={onClick}>
      <span className={`my-notification-icon ${meta.tone}`}><i className={`fa-solid ${meta.icon}`} /></span>
      <span className="my-notification-text">
        <b>{n.title}</b>
        {n.body && <span>{n.body}</span>}
      </span>
      <span className="my-notification-side">
        <small>{moment(n.createdAt).format(time)}</small>
        {target && <i className="fa-solid fa-chevron-right" />}
      </span>
    </button>
  );
};
