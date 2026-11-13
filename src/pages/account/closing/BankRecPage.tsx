import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, DatePicker, Loader, NumberInput } from 'rsuite';
import moment from 'moment';
import { deleteApi, formatDecimal, getApi, postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canCreate, canDelete } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { isNotReady } from '../gl/glApi';
import { GlNotReady, SourceChip, amountFormatter } from '../gl/glKit';

type BankAccount = {
  id: number;
  name: string;
  number: string | null;
  bank: string | null;
  currency: string | null;
  book_balance: number;
  uncleared: number;
  last: { id: number; statement_date: string; statement_balance: number } | null;
};
type OpenLine = { line_id: number; entry_number: string; entry_date: string; source_type: string; reference: string | null; description: string | null; amount: number };
type Rec = { _uuid: number; statement_date: string; statement_balance: string; book_balance: string; cleared_count: number; note: string | null };

const round2 = (n: number) => Math.round(n * 100) / 100;
const lastMonthEnd = () => moment().subtract(1, 'month').endOf('month').toDate();

/**
 * ກະທົບຍອດທະນາຄານ (ກົດໝາຍບັນຊີ ມາດຕາ 23 ຂໍ້ 2) — ເລືອກບັນຊີ, ປ້ອນວັນທີ ແລະ ຍອດໃນໃບແຈ້ງຍອດຂອງທະນາຄານ,
 * ຕິກລາຍການໃນລະບົບທີ່ປາກົດຢູ່ໃບແຈ້ງຍອດ: ຍອດຄັ້ງກ່ອນ + ລາຍການທີ່ຕິກ ຕ້ອງເທົ່າກັບຍອດໃນໃບແຈ້ງຍອດ ຈຶ່ງບັນທຶກໄດ້.
 * ລາຍການທີ່ບໍ່ໄດ້ຕິກ = ຍັງບໍ່ຜ່ານທະນາຄານ (ເຊັກທີ່ຍັງບໍ່ຂຶ້ນເງິນ…) ຍົກໄປຄັ້ງໜ້າ. ຍອດສະກຸນຂອງບັນຊີ
 */
const BankRecPage = () => {
  const t = useT();
  const [accounts, setAccounts] = useState<BankAccount[] | null>(null);
  const [error, setError] = useState('');
  const [notReady, setNotReady] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [date, setDate] = useState<Date>(lastMonthEnd);
  const [statement, setStatement] = useState<number | null>(null);
  const [open, setOpen] = useState<{ opening: number; book_balance: number; lines: OpenLine[] } | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [history, setHistory] = useState<Rec[]>([]);
  const [busy, setBusy] = useState(false);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await getApi('/bank-rec/accounts');
      const list: BankAccount[] = res.data?.data ?? [];
      setAccounts(list);
      setSelected((cur) => cur ?? list[0]?.id ?? null);
    } catch (err) {
      if (isNotReady(err)) setNotReady(true);
      else setError(getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const dateKey = moment(date).format('YYYY-MM-DD');
  const loadOpen = useCallback(async () => {
    if (!selected) return;
    try {
      const [o, h] = await Promise.all([
        postApi('/bank-rec/open', { treasury_account_id: selected, statement_date: dateKey }),
        postApi('/bank-rec/history', { treasury_account_id: selected }),
      ]);
      setOpen(o.data);
      setHistory(h.data?.data ?? []);
      setPicked([]);
    } catch (err) {
      Notific.error(getErrorMessage(err));
    }
  }, [selected, dateKey]);

  useEffect(() => {
    setOpen(null);
    loadOpen();
  }, [loadOpen]);

  const account = accounts?.find((a) => a.id === selected) ?? null;
  const cleared = useMemo(
    () => round2((open?.lines ?? []).filter((l) => picked.includes(l.line_id)).reduce((n, l) => n + l.amount, 0)),
    [open, picked],
  );

  if (notReady) return <GlNotReady />;
  if (error) return <div className="acc-class-empty"><i className="fa-solid fa-triangle-exclamation" /><p>{error}</p></div>;
  if (!accounts) return <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>;
  if (!accounts.length) return <div className="acc-class-empty"><i className="fa-solid fa-building-columns" /><p>{t('bankRecNoAccounts')}</p></div>;

  const cur = account?.currency ?? '';
  const computed = round2((open?.opening ?? 0) + cleared);
  const diff = statement === null ? null : round2(statement - computed);
  const balanced = diff !== null && Math.abs(diff) < 0.005;
  const latestId = history[0]?._uuid;

  const save = async () => {
    try {
      setBusy(true);
      await postApi('/bank-rec/save', { treasury_account_id: selected, statement_date: dateKey, statement_balance: statement, line_ids: picked });
      Notific.success('acsSaved');
      setStatement(null);
      await Promise.all([loadAccounts(), loadOpen()]);
    } catch (err) {
      Notific.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const undo = (rec: Rec) =>
    Notific.confirm(`${t('bankRecUndoConfirm')} ${moment(rec.statement_date).format('DD/MM/YYYY')}`, async () => {
      try {
        await deleteApi(`/bank-rec/${rec._uuid}`);
        Notific.success('acsDeleted');
        await Promise.all([loadAccounts(), loadOpen()]);
      } catch (err) {
        Notific.error(getErrorMessage(err));
      }
    });

  return (
    <div className="acs-page acc-bankrec">
      <div className="acc-bankrec-accounts" role="listbox" aria-label={t('closeBankRec')}>
        {accounts.map((a) => (
          <button key={a.id} type="button" role="option" aria-selected={a.id === selected}
            className={a.id === selected ? 'is-active' : ''} onClick={() => setSelected(a.id)}
          >
            <b>{a.name}</b>
            <small>{[a.bank, a.number, a.currency].filter(Boolean).join(' · ')}</small>
            <span>{t('bankRecBook')} <em>{formatDecimal(a.book_balance)}</em></span>
            <span>
              {a.last ? <>{t('bankRecLast')} {moment(a.last.statement_date).format('DD/MM/YYYY')}</> : t('bankRecNever')}
              {a.uncleared > 0 && <i className="acc-bankrec-badge">{a.uncleared}</i>}
            </span>
          </button>
        ))}
      </div>

      <section className="acc-rp-card acc-bankrec-work">
        <header>
          <h4><i className="fa-solid fa-scale-unbalanced-flip" /> {account?.name} {cur && <small>({cur})</small>}</h4>
          <small>{t('bankRecHint')}</small>
        </header>

        <div className="acc-bankrec-inputs">
          <label>
            <span>{t('bankRecStatementDate')}</span>
            <DatePicker value={date} onChange={(v) => v && setDate(v)} format="dd/MM/yyyy" cleanable={false} oneTap block />
          </label>
          <label>
            <span>{t('bankRecStatementBalance')} {cur && `(${cur})`}</span>
            <NumberInput value={statement ?? ''} onChange={(v) => setStatement(v === '' || v === null ? null : Number(String(v).replace(/,/g, '')))}
              formatter={amountFormatter} controls={false} />
          </label>
        </div>

        {!open ? (
          <div className="text-center py-4"><Loader size="sm" /></div>
        ) : (
          <>
            <div className="acc-rp-scroll">
              <table className="acc-fs-table acc-bankrec-table">
                <thead>
                  <tr>
                    <th>
                      <Checkbox checked={!!open.lines.length && picked.length === open.lines.length}
                        indeterminate={picked.length > 0 && picked.length < open.lines.length}
                        onChange={(_, on) => setPicked(on ? open.lines.map((l) => l.line_id) : [])}
                      />
                    </th>
                    <th>{t('date')}</th>
                    <th>{t('vatEntryNo')}</th>
                    <th>{t('description')}</th>
                    <th>{t('bankRecIn')}</th>
                    <th>{t('bankRecOut')}</th>
                  </tr>
                </thead>
                <tbody>
                  {open.lines.length ? open.lines.map((l) => {
                    const on = picked.includes(l.line_id);
                    return (
                      <tr key={l.line_id} className={`is-line${on ? ' is-picked' : ''}`}
                        onClick={() => setPicked(on ? picked.filter((id) => id !== l.line_id) : [...picked, l.line_id])}
                      >
                        <td><Checkbox checked={on} /></td>
                        <td>{moment(l.entry_date).format('DD/MM/YYYY')}</td>
                        <td><b>{l.reference || l.entry_number}</b><small><SourceChip type={l.source_type} /></small></td>
                        <td>{l.description ?? '—'}</td>
                        <td>{l.amount > 0 ? formatDecimal(l.amount) : ''}</td>
                        <td>{l.amount < 0 ? formatDecimal(-l.amount) : ''}</td>
                      </tr>
                    );
                  }) : (
                    <tr className="is-empty"><td colSpan={6}>{t('bankRecNothing')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <dl className="acc-bankrec-sum">
              <dt>{t('bankRecOpening')}</dt><dd>{formatDecimal(open.opening)}</dd>
              <dt>{t('bankRecCleared')} ({picked.length})</dt><dd>{formatDecimal(cleared)}</dd>
              <dt>{t('bankRecComputed')}</dt><dd><b>{formatDecimal(computed)}</b></dd>
              <dt>{t('bankRecStatementBalance')}</dt><dd>{statement === null ? '—' : formatDecimal(statement)}</dd>
              <dt>{t('bankRecDifference')}</dt>
              <dd className={balanced ? 'is-ok' : 'is-bad'}>{diff === null ? '—' : formatDecimal(diff)}</dd>
              <dt>{t('bankRecBookAtDate')}</dt><dd>{formatDecimal(open.book_balance)}</dd>
            </dl>
            <footer>
              <span>{balanced ? <><i className="fa-solid fa-circle-check" /> {t('bankRecBalanced')}</> : t('bankRecNotBalanced')}</span>
              <Button appearance="primary" loading={busy} disabled={!canCreate || !balanced} onClick={save}>
                <i className="fa-solid fa-check" /> {t('bankRecSave')}
              </Button>
            </footer>
          </>
        )}

        {!!history.length && (
          <div className="acc-bankrec-history">
            <h5>{t('bankRecHistory')}</h5>
            <ul>
              {history.map((h) => (
                <li key={h._uuid}>
                  <b>{moment(h.statement_date).format('DD/MM/YYYY')}</b>
                  <span>{formatDecimal(Number(h.statement_balance))} {cur}</span>
                  <small>{h.cleared_count} {t('closeEntries')}</small>
                  {h._uuid === latestId && canDelete && (
                    <button type="button" onClick={() => undo(h)} title={t('bankRecUndo')} aria-label={t('bankRecUndo')}>
                      <i className="fa-solid fa-rotate-left" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
};

export default BankRecPage;
