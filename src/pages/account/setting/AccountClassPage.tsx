import { useEffect, useState } from 'react';
import { Input, InputGroup, Loader } from 'rsuite';
import { getApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canCreate, canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import AccountClassForm, { type AccountClass } from './AccountClassForm';
import { toneOf } from './accountTone';


/** ໝວດບັນຊີ — ດຶງຈາກ GET /type-account/option, ເພີ່ມ/ແກ້ໄຂຜ່ານ AccountClassForm */
const AccountClassPage = () => {
  const t = useT();
  const [rows, setRows] = useState<AccountClass[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  /** undefined = ປິດຟອມ, null = ເພີ່ມໃໝ່, ມີແຖວ = ແກ້ໄຂແຖວນັ້ນ */
  const [editing, setEditing] = useState<AccountClass | null | undefined>(undefined);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await getApi('/type-account/option');
      setRows(res.data?.data || []);
    } catch (error) {
      console.error(error);
      Notific.error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const q = keyword.trim().toLowerCase();
  const shown = q
    ? rows.filter((r) => `${r.type_code ?? ''} ${r.type_name ?? ''}`.toLowerCase().includes(q))
    : rows;
  const activeCount = rows.filter((r) => Number(r.status) === 1).length;

  return (
    <div className="acc-class">
      <div className="acc-class-toolbar">
        <div className="acc-class-stats">
          <span><b>{rows.length}</b> {t('accountSetAccountClass')}</span>
          <span className="is-active"><i className="fa-solid fa-circle" /> {activeCount} {t('active')}</span>
        </div>
        <InputGroup inside size="sm" className="acc-class-search">
          <Input placeholder={t('search')} value={keyword} onChange={setKeyword} />
          <InputGroup.Addon><i className="fa-solid fa-magnifying-glass" /></InputGroup.Addon>
        </InputGroup>
        <button type="button" className="acc-class-add" disabled={!canCreate} onClick={() => setEditing(null)}>
          <i className="fa-solid fa-plus" /> {t('accountClassAdd')}
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : shown.length ? (
        <div className="acc-class-grid">
          {shown.map((item) => {
            const active = Number(item.status) === 1;
            return (
              <div key={item._uuid} className={`acc-class-card${active ? '' : ' is-off'}`}>
                <span className={`acc-class-code ${toneOf(item.type_code)}`}>{item.type_code}</span>
                <div className="acc-class-body">
                  <h4 title={item.type_name}>{item.type_name}</h4>
                  <span className={`acc-class-status${active ? ' is-active' : ''}`}>
                    <i className="fa-solid fa-circle" /> {active ? t('active') : t('inactive')}
                  </span>
                </div>
                <button type="button" className="acc-class-edit" disabled={!canEdit}
                  aria-label={t('edit')} title={t('edit')}
                  onClick={() => setEditing(item)}
                >
                  <i className="fa-solid fa-pen" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="acc-class-empty">
          <i className="fa-solid fa-sitemap" />
          <p>{t('noData')}</p>
        </div>
      )}

      {editing !== undefined && (
        <AccountClassForm
          data={editing}
          onClose={() => setEditing(undefined)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
};

export default AccountClassPage;
