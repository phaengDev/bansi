import { useState } from 'react';
import { Loader } from 'rsuite';
import moment from 'moment';
import { putApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { useT } from '../../context/LanguageContext';
import { markReadLocally, refreshMyInbox, useMyInbox } from './meInbox';
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
const targetOf = (n: MyNotification): { key: string; intent?: MyIntent } | null => {
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

/** ຫົວຂອງແຕ່ລະມື້ — ມື້ນີ້ / ມື້ວານ / ວັນທີ */
const dayHead = (date: string, t: (key: string) => string) => {
  const day = moment(date);
  if (day.isSame(moment(), 'day')) return t('myToday');
  if (day.isSame(moment().subtract(1, 'day'), 'day')) return t('myYesterday');
  return day.format('DD/MM/YYYY');
};

/**
 * ແຈ້ງເຕືອນຂອງຂ້ອຍ — ອັນດຽວກັບກະດິ່ງໃນ app ພະນັກງານ (ເງິນເດືອນ, ຜົນຄຳຂໍ, ວຽກ, ຄຳຂໍລໍອະນຸມັດ, ວັນພັກ, ແຈ້ງການ…).
 * ກົດ = ອ່ານແລ້ວ ແລະ ເປີດໜ້າທີ່ກ່ຽວຂ້ອງ; "ອ່ານແລ້ວທັງໝົດ"; ກັ່ນສະເພາະທີ່ຍັງບໍ່ອ່ານ
 */
const MyNotifications = ({ onOpen }: { onOpen: MyOpen }) => {
  const t = useT();
  const inbox = useMyInbox();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // ໃໝ່ສຸດກ່ອນ (ເຊີບເວີລຽງໃຫ້ແລ້ວ — ລຽງຊ້ຳໃຫ້ກຸ່ມມື້ຖືກລຳດັບສະເໝີ)
  const all = [...(inbox.notifications?.data ?? [])].sort((a, b) => moment(b.createdAt).valueOf() - moment(a.createdAt).valueOf() || b._uuid - a._uuid);
  const unread = inbox.notifications?.unread ?? 0;
  const rows = unreadOnly ? all.filter((n) => n.is_new) : all;

  const groups = rows.reduce<{ head: string; rows: MyNotification[] }[]>((list, n) => {
    const head = dayHead(n.createdAt, t);
    const last = list[list.length - 1];
    if (last?.head === head) last.rows.push(n);
    else list.push({ head, rows: [n] });
    return list;
  }, []);

  const reload = async () => {
    setRefreshing(true);
    await refreshMyInbox();
    setRefreshing(false);
  };

  const readAll = async () => {
    try {
      markReadLocally();
      await putApi('/notification/me/read', {});
    } catch (error) {
      Notific.error(getErrorMessage(error));
    }
    refreshMyInbox();
  };

  const openOne = (n: MyNotification) => {
    if (n.is_new) {
      markReadLocally(n._uuid);
      putApi(`/notification/me/read/${idOf(n)}`, {}).catch(() => refreshMyInbox());
    }
    const target = targetOf(n);
    if (target) onOpen(target.key, target.intent);
  };

  return (
    <div className="acc-rp att-page my-page">
      <div className="acc-rp-filters">
        <div className="acc-rp-filter-row">
          <div className="acc-type-segment" role="tablist">
            <button type="button" role="tab" aria-selected={!unreadOnly} className={!unreadOnly ? 'is-active' : ''} onClick={() => setUnreadOnly(false)}>
              {t('all')} <em>{all.length}</em>
            </button>
            <button type="button" role="tab" aria-selected={unreadOnly} className={unreadOnly ? 'is-active' : ''} onClick={() => setUnreadOnly(true)}>
              {t('myUnread')} {!!unread && <em className="is-alert">{unread}</em>}
            </button>
          </div>
          <div className="acc-rp-actions">
            <button type="button" className="acc-rp-btn" onClick={reload} disabled={refreshing} aria-label={t('reload')}><i className="fa-solid fa-rotate-right" /></button>
            <button type="button" className="acc-rp-btn is-primary" onClick={readAll} disabled={!unread}>
              <i className="fa-solid fa-check-double" /> {t('myReadAll')}
            </button>
          </div>
        </div>
      </div>

      {!inbox.loaded ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : !rows.length ? (
        <div className="acc-class-empty"><i className="fa-regular fa-bell-slash" /><p>{t(unreadOnly ? 'myNoUnread' : 'myNoNotifications')}</p></div>
      ) : (
        <div className={`my-feed${refreshing ? ' is-refreshing' : ''}`}>
          {groups.map((group) => (
            <section key={group.head}>
              <h4 className="my-apv-head"><i className="fa-regular fa-calendar" /> {group.head}</h4>
              <ul className="my-notifications">
                {group.rows.map((n) => {
                  const meta = metaOf(n.type);
                  const target = targetOf(n);
                  return (
                    <li key={n._uuid}>
                      <button type="button" className={`my-notification${n.is_new ? ' is-new' : ''}${target ? '' : ' is-static'}`} onClick={() => openOne(n)}>
                        <span className={`my-notification-icon ${meta.tone}`}><i className={`fa-solid ${meta.icon}`} /></span>
                        <span className="my-notification-text">
                          <b>{n.title}</b>
                          {n.body && <span>{n.body}</span>}
                        </span>
                        <span className="my-notification-side">
                          <small>{moment(n.createdAt).format('HH:mm')}</small>
                          {target && <i className="fa-solid fa-chevron-right" />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyNotifications;
