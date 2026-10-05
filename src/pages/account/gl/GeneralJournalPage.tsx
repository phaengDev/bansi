import { useCallback, useEffect, useState } from 'react';
import { DateRangePicker, Input, InputGroup, Loader } from 'rsuite';
import moment from 'moment';
import { postApi, putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { exportExcel } from '../../../utils/exportHelpers';
import { canCreate, canDelete } from '../../../utils/localStorage';
import { useLangField, useT } from '../../../context/LanguageContext';
import { SOURCES, isNotReady, money, type JournalEntry } from './glApi';
import { AccountCode, GlNotReady, SourceChip, useChartAccounts } from './glKit';
import JournalEntryForm from './JournalEntryForm';

/**
 * ສະໝຸດລາຍວັນ (General Journal) — ທຸກໃບບັນທຶກບັນຊີຕາມວັນທີ, ແຕ່ລະໃບສະແດງແຖວໜີ້/ມີ.
 * manualOnly = ໜ້າ "ບັນທຶກທົ່ວໄປ" (ສະເພາະ MANUAL + ປຸ່ມເພີ່ມ). ກັບລາຍການໄດ້ສະເພາະບັນທຶກທົ່ວໄປ —
 * ໃບທີ່ລົງຈາກລາຍຮັບ/ລາຍຈ່າຍ ຕ້ອງຍົກເລີກທີ່ເອກະສານ
 */
const GeneralJournalPage = ({ manualOnly = false }: { manualOnly?: boolean }) => {
  const t = useT();
  const lf = useLangField();
  const { rows: accounts } = useChartAccounts();
  const [dates, setDates] = useState<[Date, Date]>([moment().startOf('month').toDate(), moment().toDate()]);
  const [source, setSource] = useState<string>(manualOnly ? 'MANUAL' : '');
  const [keyword, setKeyword] = useState('');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await postApi('/journal-entry/fetch', {
        start_date: moment(dates[0]).format('YYYY-MM-DD'),
        end_date: moment(dates[1]).format('YYYY-MM-DD'),
        source_type: source || undefined,
        keyword: keyword.trim() || undefined,
      });
      setEntries(res.data?.data ?? []);
      setNotReady(false);
    } catch (error) {
      if (isNotReady(error)) setNotReady(true);
      else Notific.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [dates, source, keyword]);

  useEffect(() => {
    const timer = window.setTimeout(load, keyword ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [load, keyword]);

  const reverse = (entry: JournalEntry) => {
    Notific.confirm(`${t('glReverseConfirm')} ${entry.entry_number}?`, async () => {
      try {
        await putApi(`/journal-entry/reverse/${btoa(String(entry._uuid))}`, {});
        Notific.success('glReversed');
        load();
      } catch (error) {
        Notific.error(getErrorMessage(error));
      }
    });
  };

  const exportRows = () => {
    const col = { date: t('date'), no: t('glEntryNumber'), src: t('glSource'), code: t('glAccountCode'), acc: t('glAccount'), desc: t('detail'), dr: t('glDebit'), cr: t('glCredit') };
    exportExcel(entries.flatMap((e) => e.lines.map((l) => ({
      [col.date]: moment(e.entry_date).format('DD/MM/YYYY'),
      [col.no]: e.entry_number,
      [col.src]: t(SOURCES[e.source_type]?.label ?? e.source_type),
      [col.code]: l.account?.account_code ?? '',
      [col.acc]: l.account ? lf(l.account, 'name') : '',
      [col.desc]: l.description || e.description || '',
      [col.dr]: Number(l.debit) || '',
      [col.cr]: Number(l.credit) || '',
    }))), `journal_${moment(dates[0]).format('YYYY-MM-DD')}_${moment(dates[1]).format('YYYY-MM-DD')}`, t('glJournalBook'));
  };

  if (notReady) return <GlNotReady />;

  const total = entries.reduce((n, e) => n + (Number(e.total_debit) || 0), 0);
  const sourceKeys = manualOnly ? [] : ['', ...Object.keys(SOURCES).filter((k) => k !== 'CLOSING')];

  return (
    <div className="acs-page acc-gl">
      <div className="acc-gl-journal-bar">
        <div className="acs-stats">
          <span><b>{entries.length}</b> {t('glEntries')}</span>
          <span className="is-green"><b>{money(total)}</b> LAK</span>
        </div>
        <DateRangePicker className="acc-gl-range" format="dd/MM/yyyy" character=" – " cleanable={false} value={dates}
          onChange={(value) => value && setDates(value as [Date, Date])} placement="bottomEnd"
        />
        <InputGroup inside size="sm" className="acs-search">
          <InputGroup.Addon><i className="fa-solid fa-magnifying-glass" /></InputGroup.Addon>
          <Input placeholder={t('glSearchEntry')} value={keyword} onChange={setKeyword} />
        </InputGroup>
        <button type="button" className="acc-rp-btn" onClick={exportRows} disabled={!entries.length}>
          <i className="fa-solid fa-file-excel" /> Excel
        </button>
        <button type="button" className="acc-class-add" disabled={!canCreate} onClick={() => setAdding(true)}>
          <i className="fa-solid fa-plus" /> {t('glManualAdd')}
        </button>
      </div>

      {sourceKeys.length > 0 && (
        <div className="acc-type-segment acc-gl-source-filter" role="tablist">
          {sourceKeys.map((k) => (
            <button key={k || 'all'} type="button" role="tab" aria-selected={source === k} className={source === k ? 'is-active' : ''}
              onClick={() => setSource(k)}
            >
              {k ? t(SOURCES[k].label) : t('all')}
            </button>
          ))}
        </div>
      )}

      {loading && !entries.length ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : !entries.length ? (
        <div className="acc-class-empty">
          <i className="fa-solid fa-book-open" />
          <p>{t('rpEmpty')}</p>
        </div>
      ) : (
        <div className={`acc-gl-entries${loading ? ' is-refreshing' : ''}`}>
          {entries.map((e) => {
            const reversed = !!e.reversed_by;
            const isReversal = !!e.reversal_of;
            return (
              <article key={e._uuid} className={`acc-gl-entry${reversed ? ' is-reversed' : ''}${isReversal ? ' is-reversal' : ''}`}>
                <header>
                  <span className="acc-gl-entry-date">
                    <b>{moment(e.entry_date).format('DD')}</b>
                    <small>{moment(e.entry_date).format('MM/YYYY')}</small>
                  </span>
                  <span className="acc-gl-entry-title">
                    <span className="acc-gl-entry-meta">
                      <b className="acc-gl-mono">{e.entry_number}</b>
                      <SourceChip type={e.source_type} />
                      {e.reference && <span className="acc-gl-ref"><i className="fa-solid fa-hashtag" /> {e.reference}</span>}
                      {reversed && <span className="acc-gl-flag is-bad">{t('glReversedFlag')}</span>}
                      {isReversal && <span className="acc-gl-flag">{t('glReversalFlag')}</span>}
                    </span>
                    <span className="acc-gl-entry-desc">{e.description || '—'}</span>
                  </span>
                  <span className="acc-gl-entry-total">
                    <b>{money(Number(e.total_debit))}</b>
                    {e.user?.user_name && <small><i className="fa-regular fa-user" /> {e.user.user_name}</small>}
                  </span>
                  {e.source_type === 'MANUAL' && !reversed && !isReversal && (
                    <button type="button" className="acc-gl-act is-danger" disabled={!canDelete} title={t('glReverse')} onClick={() => reverse(e)}>
                      <i className="fa-solid fa-rotate-left" />
                    </button>
                  )}
                </header>
                <table className="acc-gl-entry-table">
                  <tbody>
                    {e.lines.map((l) => (
                      <tr key={l._uuid} className={Number(l.credit) ? 'is-cr' : 'is-dr'}>
                        <td className="acc-gl-entry-account">
                          {l.account && <AccountCode code={l.account.account_code} group={l.account.account_group} />}
                          <span>{l.account ? lf(l.account, 'name') : `#${l.account_id}`}</span>
                          {l.description && l.description !== e.description && <small>{l.description}</small>}
                        </td>
                        <td className="is-num">{Number(l.debit) ? money(Number(l.debit)) : ''}</td>
                        <td className="is-num">{Number(l.credit) ? money(Number(l.credit)) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            );
          })}
        </div>
      )}

      {adding && <JournalEntryForm accounts={accounts} onClose={() => setAdding(false)} onSaved={load} />}
    </div>
  );
};

export default GeneralJournalPage;
