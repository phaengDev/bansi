import { useState } from 'react';
import { Loader } from 'rsuite';
import moment from 'moment';
import { putApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { useT } from '../../context/LanguageContext';
import { markReadLocally, refreshMyInbox, useMyInbox } from './meInbox';
import type { MyNotification, MyOpen } from './meApi';
import { NotificationItem, newestFirst, openNotification } from './myNotificationKit';

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
  const all = newestFirst(inbox.notifications?.data ?? []);
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
                {group.rows.map((n) => (
                  <li key={n._uuid}><NotificationItem n={n} onClick={() => openNotification(n, onOpen)} /></li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyNotifications;
