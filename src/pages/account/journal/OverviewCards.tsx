import { useState, type CSSProperties, type ReactNode } from 'react';
import moment from 'moment';
import { formatNumber } from '../../../utils/configApi';
import { useT } from '../../../context/LanguageContext';
import { compact } from '../statements/StatementBits';
import { pctChange, type CategoryRow, type Party } from './overviewData';
import type { Entry } from './reportData';

/** ບັດຂອງໜ້າ ພາບລວມ ລາຍຮັບ-ລາຍຈ່າຍ — ຕາມປະເພດ, ຈຸດເດັ່ນ, ອັນດັບ, ລາຍການລ່າສຸດ */

const order = (i: number): CSSProperties => ({ '--i': i } as CSSProperties);

/** ສີປະເພດ (ລຳດັບຄົງທີ່, ກວດຕາບອດສີແລ້ວ) + ເທົາ = ອື່ນໆ */
const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'];
const OTHER = '#9aa8b5';

/** ▲ 12% / ▼ 5% / ໃໝ່ — good = ເພີ່ມຂຶ້ນແມ່ນດີບໍ່ */
export const DeltaPill = ({ current, previous, good }: { current: number; previous: number; good: boolean }) => {
  const t = useT();
  const diff = current - previous;
  if (Math.abs(diff) < 0.005) return <span className="acc-jo-delta is-flat">—</span>;
  const pct = pctChange(current, previous);
  const tone = (diff > 0) === good ? 'is-good' : 'is-bad';
  if (pct === null) return <span className={`acc-jo-delta ${tone}`}>{previous === 0 ? t('fsNew') : '—'}</span>;
  return (
    <span className={`acc-jo-delta ${tone}`}>
      <i className={`fa-solid ${diff > 0 ? 'fa-caret-up' : 'fa-caret-down'}`} />{Math.abs(pct) >= 1000 ? '999+' : Math.abs(pct).toFixed(Math.abs(pct) < 10 ? 1 : 0)}%
    </span>
  );
};

export const Empty = ({ icon, text }: { icon: string; text: string }) => (
  <div className="acc-jo-empty"><i className={`fa-solid ${icon}`} /><p>{text}</p></div>
);

/**
 * ເງິນມາຈາກໃສ / ຈ່າຍໄປໃສ — ແຖບແບ່ງສ່ວນ (5 ປະເພດຫຼາຍສຸດ + ອື່ນໆ) ແລ້ວລາຍການພ້ອມແຖບຍາວຕາມຍອດ (ສີດຽວ) ແລະ ປ່ຽນແປງທຽບງວດກ່ອນ
 */
export const CategoryCard = ({ kind, rows, index }: { kind: 'in' | 'out'; rows: CategoryRow[]; index: number }) => {
  const t = useT();
  const [all, setAll] = useState(false);
  const total = rows.reduce((n, r) => n + r.total, 0);
  const top = rows.slice(0, 5);
  const rest = rows.slice(5);
  const parts = [
    ...top.map((r, i) => ({ ...r, color: PALETTE[i] })),
    ...(rest.length ? [{
      key: 'other', label: t('joOthers'), code: '', count: rest.reduce((n, r) => n + r.count, 0),
      total: rest.reduce((n, r) => n + r.total, 0), previous: rest.reduce((n, r) => n + r.previous, 0),
      share: rest.reduce((n, r) => n + r.share, 0), color: OTHER,
    }] : []),
  ];
  const listed = all ? rows.map((r, i) => ({ ...r, color: i < 5 ? PALETTE[i] : OTHER })) : parts;
  const peak = Math.max(1, ...listed.map((r) => r.total));
  return (
    <section className={`acc-rp-card acc-jo-card acc-jo-cats is-${kind}`} style={order(index)}>
      <header>
        <h4><i className={`fa-solid ${kind === 'in' ? 'fa-hand-holding-dollar' : 'fa-cart-shopping'}`} /> {t(kind === 'in' ? 'joWhereFrom' : 'joWhereTo')}</h4>
        <small>{rows.filter((r) => r.total).length} {t('joCategories')}</small>
      </header>
      {total > 0 ? <>
        <div className="acc-jo-seg" role="img" aria-label={parts.map((p) => `${p.label} ${p.share.toFixed(1)}%`).join(', ')}>
          {parts.filter((p) => p.total > 0).map((p) => {
            const tip = `${p.label} · ${formatNumber(p.total)} · ${p.share.toFixed(1)}%`;
            return (
              <i key={p.key} style={{ flexGrow: p.total, background: p.color }} data-tip={tip} aria-label={tip} tabIndex={0}>
                {p.share >= 9 && <span>{p.share.toFixed(0)}%</span>}
              </i>
            );
          })}
        </div>
        <ul className="acc-jo-cat-list">
          {listed.filter((r) => r.total || r.previous).map((r) => (
            <li key={r.key}>
              <span className="acc-jo-cat-dot" style={{ background: r.color }} />
              <span className="acc-jo-cat-name">
                <b title={r.label}>{r.label}</b>
                <small>{r.count} {t('incomeItems')} · {r.share.toFixed(1)}%</small>
              </span>
              <span className="acc-jo-cat-amount">
                <b>{formatNumber(r.total)}</b>
                <DeltaPill current={r.total} previous={r.previous} good={kind === 'in'} />
              </span>
              <span className="acc-jo-cat-bar"><i style={{ width: `${(r.total / peak) * 100}%` }} /></span>
            </li>
          ))}
        </ul>
        {rest.length > 0 && (
          <button type="button" className="acc-jo-more" onClick={() => setAll((v) => !v)}>
            {all ? t('joShowLess') : `${t('joShowAll')} (${rows.length})`} <i className={`fa-solid ${all ? 'fa-chevron-up' : 'fa-chevron-down'}`} />
          </button>
        )}
      </> : <Empty icon={kind === 'in' ? 'fa-seedling' : 'fa-mug-hot'} text={t(kind === 'in' ? 'joNoIncome' : 'joNoExpense')} />}
    </section>
  );
};

export type Fact = { key: string; icon: string; tone: string; title: string; value: ReactNode; sub?: ReactNode; onClick?: () => void };

/** ຈຸດເດັ່ນ — ບັດນ້ອຍຫຼາຍສີ (ກົດໄດ້ຖ້າເປີດລາຍການໄດ້) */
export const Facts = ({ facts }: { facts: Fact[] }) => (
  <div className="acc-jo-facts">
    {facts.map((f, i) => {
      const body = <>
        <span className={`acc-jo-fact-icon is-${f.tone}`}><i className={`fa-solid ${f.icon}`} /></span>
        <span className="acc-jo-fact-text">
          <small>{f.title}</small>
          <b>{f.value}</b>
          {f.sub && <em>{f.sub}</em>}
        </span>
        {f.onClick && <i className="fa-solid fa-chevron-right acc-jo-fact-go" />}
      </>;
      return f.onClick
        ? <button key={f.key} type="button" className="acc-jo-fact is-link" style={order(i)} onClick={f.onClick}>{body}</button>
        : <div key={f.key} className="acc-jo-fact" style={order(i)}>{body}</div>;
    })}
  </div>
);

/** ສີຂອງຮູບຫຍໍ້ (ອັກສອນທຳອິດ) — ຄົງທີ່ຕາມຊື່ */
const avatarHue = (name: string) => [...name].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 360, 7);

/** ອັນດັບ 5 — ລູກຄ້າ (ຮັບຈາກ) / ຜູ້ຮັບເງິນ (ຈ່າຍໃຫ້); 3 ອັນດັບທຳອິດມີຫຼຽນ */
export const Leaderboard = ({ payers, payees, index }: { payers: Party[]; payees: Party[]; index: number }) => {
  const t = useT();
  const [tab, setTab] = useState<'in' | 'out'>('in');
  const list = tab === 'in' ? payers : payees;
  const peak = Math.max(1, ...list.map((p) => p.total));
  return (
    <section className="acc-rp-card acc-jo-card acc-jo-board" style={order(index)}>
      <header>
        <h4><i className="fa-solid fa-trophy" /> {t('joLeaderboard')}</h4>
        <div className="acc-type-segment acc-jo-mini-switch" role="tablist">
          {(['in', 'out'] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'is-active' : ''} onClick={() => setTab(k)}>
              {t(k === 'in' ? 'joPayers' : 'joPayees')}
            </button>
          ))}
        </div>
      </header>
      {list.length ? (
        <ol className="acc-jo-rank">
          {list.map((p, i) => (
            <li key={p.key} style={order(i)}>
              <span className={`acc-jo-rank-no is-${i + 1}`}>{i < 3 ? <i className="fa-solid fa-medal" /> : i + 1}</span>
              <span className="acc-jo-avatar" style={{ '--hue': avatarHue(p.name) } as CSSProperties}>{[...p.name.trim()][0]?.toUpperCase()}</span>
              <span className="acc-jo-rank-name">
                <b title={p.name}>{p.name}</b>
                <span className={`acc-jo-rank-bar is-${tab}`}><i style={{ width: `${(p.total / peak) * 100}%` }} /></span>
              </span>
              <span className="acc-jo-rank-amount">
                <b>{formatNumber(p.total)}</b>
                <small>{p.count} {t('incomeItems')}</small>
              </span>
            </li>
          ))}
        </ol>
      ) : <Empty icon="fa-user-group" text={t('joNoParties')} />}
    </section>
  );
};

/** ມື້ນີ້ / ມື້ວານ / DD/MM */
const whenOf = (e: Entry, t: (k: string) => string) => {
  const today = moment().startOf('day');
  if (e.date.isSame(today, 'day')) return t('joToday');
  if (e.date.isSame(today.clone().subtract(1, 'day'), 'day')) return t('joYesterday');
  return e.date.format(e.date.isSame(today, 'year') ? 'DD/MM' : 'DD/MM/YY');
};

/** ລາຍການລ່າສຸດ — ຮັບ/ຈ່າຍ ລວມກັນ, ກົດເປີດໃບ */
export const RecentFeed = ({ entries, kindOf, onOpen, index }: {
  entries: Entry[];
  kindOf: (e: Entry) => 'in' | 'out';
  onOpen: (e: Entry) => void;
  index: number;
}) => {
  const t = useT();
  return (
    <section className="acc-rp-card acc-jo-card acc-jo-feed" style={order(index)}>
      <header>
        <h4><i className="fa-solid fa-clock-rotate-left" /> {t('joRecent')}</h4>
        <small>{entries.length} {t('incomeItems')}</small>
      </header>
      {entries.length ? (
        <ul>
          {entries.map((e, i) => {
            const k = kindOf(e);
            return (
              <li key={`${k}-${e.id}`} style={order(i)}>
                <button type="button" onClick={() => onOpen(e)}>
                  <span className={`acc-jo-feed-icon is-${k}`}>
                    {e.account?.url ? <img src={e.account.url} alt="" /> : <i className={`fa-solid ${k === 'in' ? 'fa-arrow-down' : 'fa-arrow-up'}`} />}
                  </span>
                  <span className="acc-jo-feed-text">
                    <b title={e.title}>{e.title || e.number}</b>
                    <small>{[e.category?.name, e.party].filter(Boolean).join(' · ') || e.number}</small>
                  </span>
                  <span className={`acc-jo-feed-amount is-${k}`}>
                    <b>{k === 'in' ? '+' : '−'}{formatNumber(e.amount)}</b>
                    <small>{whenOf(e, t)}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : <Empty icon="fa-feather" text={t('joNoRecent')} />}
    </section>
  );
};

/** ຕົວເລກຫຍໍ້ພ້ອມສັນຍາລັກ — ໃຊ້ໃນຈຸດເດັ່ນ */
export const short = (symbol: string, value: number) => `${symbol} ${compact(value)}`.trim();
