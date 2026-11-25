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
import { matchStatement, readStatement, statementBalanceAt, type StatementRow } from './bankStatement';

type BankAccount = {
  id: number;
  /** ລະຫັດບັນຊີເງິນຄັງ (10211) */
  code: string | null;
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
  /** ໃບແຈ້ງຍອດທີ່ນຳເຂົ້າ (Excel/CSV) — ແຖວ + ຜົນຈັບຄູ່ກັບລາຍການໃນລະບົບ */
  const [imported, setImported] = useState<{ file: string; rows: StatementRow[]; matched: number[]; unmatched: StatementRow[] } | null>(null);

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
      setImported(null);
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

  /** ນຳເຂົ້າໃບແຈ້ງຍອດ: ຕິກລາຍການທີ່ກົງກັນ (ຈຳນວນເທົ່າກັນ, ວັນທີຫ່າງ ≤ 7 ມື້) ແລະ ເຕີມຍອດໃນໃບແຈ້ງຍອດ (ຖ້າຍັງບໍ່ປ້ອນ) */
  const importStatement = async (file: File) => {
    if (!open) return;
    try {
      const rows = await readStatement(file);
      const result = matchStatement(rows, open.lines, dateKey);
      setPicked((cur) => [...new Set([...cur, ...result.matched])]);
      if (statement === null) {
        const balance = statementBalanceAt(rows, dateKey);
        if (balance !== null) setStatement(balance);
      }
      setImported({ file: file.name, rows: rows.filter((r) => r.date <= dateKey), matched: result.matched, unmatched: result.unmatched });
    } catch (err) {
      console.error(err);
      Notific.warning('bankRecImportFail');
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
            <small>{[a.code, a.bank, a.number, a.currency].filter(Boolean).join(' · ')}</small>
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
          <h4><i className="fa-solid fa-scale-unbalanced-flip" /> {[account?.code, account?.name].filter(Boolean).join(' ')} {cur && <small>({cur})</small>}</h4>
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
          <label className="acc-bankrec-import-btn" title={t('bankRecImportHint')}>
            <span>{t('bankRecImportLabel')}</span>
            <span className="acc-rp-btn"><i className="fa-solid fa-file-import" /> {t('bankRecImport')}</span>
            <input type="file" accept=".xlsx,.xls,.csv" hidden disabled={!open} onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) importStatement(file);
            }} />
          </label>
        </div>

        {imported && (
          <div className="acc-bankrec-import">
            <p>
              <i className="fa-solid fa-file-excel" /> <b>{imported.file}</b> · {imported.rows.length} {t('closeEntries')}
              <span className="is-ok"><i className="fa-solid fa-circle-check" /> {t('bankRecMatched')} {imported.matched.length}</span>
              {!!imported.unmatched.length && <span className="is-bad"><i className="fa-solid fa-triangle-exclamation" /> {t('bankRecUnmatched')} {imported.unmatched.length}</span>}
              <button type="button" onClick={() => setImported(null)} aria-label={t('close')}><i className="fa-solid fa-xmark" /></button>
            </p>
            {!!imported.unmatched.length && (
              <>
                <small>{t('bankRecUnmatchedHint')}</small>
                <ul>
                  {imported.unmatched.map((r, i) => (
                    <li key={`${r.date}-${i}`}>
                      <span>{moment(r.date).format('DD/MM/YYYY')}</span>
                      <span>{r.description || '—'}</span>
                      <b className={r.amount < 0 ? 'is-out' : 'is-in'}>{r.amount < 0 ? '−' : '+'}{formatDecimal(Math.abs(r.amount))}</b>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

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
                      <tr key={l.line_id} className={`is-line${on ? ' is-picked' : ''}${imported?.matched.includes(l.line_id) ? ' is-matched' : ''}`}
                        onClick={() => setPicked(on ? picked.filter((id) => id !== l.line_id) : [...picked, l.line_id])}
                      >
                        <td><Checkbox checked={on} /></td>
                        <td>{moment(l.entry_date).format('DD/MM/YYYY')}</td>
                        <td>
                          <b>{l.reference || l.entry_number}</b>
                          <small><SourceChip type={l.source_type} />{imported?.matched.includes(l.line_id) && <em className="acc-bankrec-match"><i className="fa-solid fa-link" /> {t('bankRecInStatement')}</em>}</small>
                        </td>
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
