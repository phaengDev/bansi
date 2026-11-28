import { useEffect, useState } from 'react';
import { Form, Input, Loader } from 'rsuite';
import { getErrorMessage } from '../../utils/useCRUD';
import { runSave } from '../account/setting/settingApi';
import { ChoiceTiles, FormStep, SettingModal } from '../account/setting/settingKit';
import { useT } from '../../context/LanguageContext';
import { formatNumber, getApi } from '../../utils/configApi';
import type { RouteChoice, RouteContext, RouteOptions, RoutePerson } from './creditApi';

/** ທາງເລືອກຂອງຜູ້ໃຊ້ທີ່ login (GET /credit/route-options) — applicationId ບໍ່ໃສ່ = ຄຳຮ້ອງໃໝ່ */
export const useRouteOptions = (applicationId?: number | null, enabled = true, ctx: RouteContext = {}) => {
  const [options, setOptions] = useState<RouteOptions | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    const query = new URLSearchParams(Object.entries({
      application_id: applicationId, level: ctx.level, product_id: ctx.productId, amount: ctx.amount,
    }).filter(([, v]) => v !== undefined && v !== null && v !== 0).map(([k, v]) => [k, String(v)]));
    getApi(`/credit/route-options${query.size ? `?${query}` : ''}`)
      .then((res) => alive && setOptions(res.data?.data ?? { auto: null, manual: [], lineManager: false }))
      .catch((err) => alive && setError(getErrorMessage(err)));
    return () => {
      alive = false;
    };
  }, [applicationId, enabled, ctx.level, ctx.productId, ctx.amount]);
  return { options, error };
};

/** ຄ່າເລີ່ມຕົ້ນ: ອັດຕະໂນມັດ (ຖ້າມີຫົວໜ້າສາຍງານທີ່ພິຈາລະນາໄດ້) → ເລືອກເອງ → ເປີດໃຫ້ທຸກຄົນ (ບໍ່ມີໃຜສູງກວ່າ) */
export const defaultRoute = (options: RouteOptions | null): RouteChoice =>
  options?.auto ? { mode: 'auto', to: null } : options?.manual.length ? { mode: 'manual', to: null } : { mode: 'open', to: null };

/** ພ້ອມສົ່ງ: ອັດຕະໂນມັດມີຄົນ / ເລືອກເອງເລືອກແລ້ວ / ເປີດ (ບໍ່ມີໃຜສູງກວ່າ) */
export const routeReady = (route: RouteChoice, options: RouteOptions | null, allowOpen = true) =>
  !!options && (route.mode === 'auto' ? !!options.auto : route.mode === 'manual' ? options.manual.some((p) => p._uuid === route.to) : allowOpen && !options.auto && !options.manual.length);

const PersonRow = ({ p, badge, active, onClick }: { p: RoutePerson; badge?: string; active?: boolean; onClick?: () => void }) => {
  const t = useT();
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className={`cr-route-person${active ? ' is-active' : ''}${onClick ? '' : ' is-static'}`} onClick={onClick} aria-pressed={onClick ? !!active : undefined}>
      <span className="cr-avatar is-pending"><i className="fa-solid fa-user-tie" /></span>
      <span className="cr-route-person-text">
        <b>{p.employee ?? p.name}</b>
        <small>
          {[p.position, p.level !== null ? `Level ${p.level}` : t('crRouteNoPosition'), p.employee ? `@${p.name}` : null,
            p.limit !== null && p.limit !== undefined ? `${t('crRouteLimit')} ≤ ₭ ${formatNumber(p.limit)}` : null].filter(Boolean).join(' · ')}
        </small>
      </span>
      {badge && <em className="cr-route-badge">{badge}</em>}
      {onClick && <i className={`fa-solid ${active ? 'fa-circle-check' : 'fa-circle'} cr-route-check`} />}
    </Tag>
  );
};

/**
 * ເລືອກຜູ້ພິຈາລະນາ — ໃຊ້ຮ່ວມ: ສົ່ງພິຈາລະນາ (ຟອມ / ລາຍລະອຽດ), ອະນຸມັດແລ້ວສົ່ງຕໍ່ຂັ້ນຕໍ່ໄປ, ປ່ຽນ / ສົ່ງຕໍ່ຜູ້ພິຈາລະນາ.
 * ອັດຕະໂນມັດ = ຫົວໜ້າສາຍງານ (ຫຼື ຄົນຖັດໄປໃນສາຍງານ); ເລືອກເອງ = ສະເພາະຄົນທີ່ຕຳແໜ່ງສູງກວ່າຜູ້ສົ່ງ
 */
export const RoutePicker = ({ options, value, onChange, level, allowOpen = true }: {
  options: RouteOptions | null;
  value: RouteChoice;
  onChange: (route: RouteChoice) => void;
  level: number;
  /** ບໍ່ມີໃຜສູງກວ່າ: ສົ່ງພິຈາລະນາ / ອະນຸມັດ = ເປີດໃຫ້ທຸກຄົນ; ປ່ຽນ / ສົ່ງຕໍ່ = ສົ່ງບໍ່ໄດ້ */
  allowOpen?: boolean;
}) => {
  const t = useT();
  if (!options) return <div className="text-center py-3"><Loader size="sm" content={t('loadingDots')} /></div>;
  const nobodyHigher = !options.auto && !options.manual.length;
  if (nobodyHigher) {
    return (
      <div className="is-wide cr-route">
        <p className={`cr-route-note${allowOpen ? '' : ' is-bad'}`}>
          <i className={`fa-solid ${allowOpen ? 'fa-users' : 'fa-user-slash'}`} />
          <span>{allowOpen ? t('crRouteOpenHint').replace('{n}', String(level)) : t('crRouteNobodyHigher')}</span>
        </p>
      </div>
    );
  }
  const tiles = [
    ...(options.auto ? [{ value: 'auto' as const, label: t('crRouteAuto'), icon: 'fa-sitemap', hint: `→ ${options.auto.employee ?? options.auto.name}` }] : []),
    ...(options.manual.length ? [{ value: 'manual' as const, label: t('crRouteManual'), icon: 'fa-hand-pointer', hint: t('crRouteManualHint').replace('{n}', String(options.manual.length)) }] : []),
  ];
  return (
    <div className="is-wide cr-route">
      <ChoiceTiles<'auto' | 'manual'> label={t('crRouteHow')} value={value.mode === 'manual' ? 'manual' : 'auto'} options={tiles}
        onChange={(mode) => onChange({ mode, to: mode === 'manual' ? value.to : null })}
      />
      {!options.auto && (
        <p className="acc-gl-hint"><i className="fa-solid fa-circle-info" /> {t(options.lineManager ? 'crRouteNoLineApprover' : 'crRouteNoLine')}</p>
      )}
      {value.mode === 'auto' && options.auto && <PersonRow p={options.auto} badge={t('crRouteLineManager')} />}
      {!!options.final && !!options.over_limit && (
        <p className="acc-gl-hint"><i className="fa-solid fa-scale-balanced" /> {t('crRouteOverLimit').replace('{n}', String(options.over_limit)).replace('{a}', formatNumber(options.amount_lak ?? 0))}</p>
      )}
      {value.mode === 'manual' && (
        <div className="cr-route-list">
          {options.manual.map((p) => (
            <PersonRow key={p._uuid} p={p} active={value.to === p._uuid} badge={options.auto?._uuid === p._uuid ? t('crRouteLineManager') : undefined}
              onClick={() => onChange({ mode: 'manual', to: p._uuid })}
            />
          ))}
          <p className="acc-gl-hint"><i className="fa-solid fa-circle-info" /> {t('crRouteHigherOnly')}</p>
        </div>
      )}
    </div>
  );
};

/**
 * ກ່ອງ "ສົ່ງໃຫ້ໃຜພິຈາລະນາ" — ສົ່ງພິຈາລະນາ, ປ່ຽນຜູ້ພິຈາລະນາ (ຜູ້ສົ່ງ) ຫຼື ສົ່ງຕໍ່ (ຜູ້ຖືກສົ່ງໃຫ້).
 * onConfirm ເຮັດວຽກຈິງ (ຄືນ true = ສຳເລັດ → ປິດ)
 */
export const RouteModal = ({ applicationId, level, levels, title, hint, submitLabel, onClose, onConfirm, withComment, allowOpen = true, ctx }: {
  applicationId?: number | null;
  level: number;
  levels: number;
  title: string;
  hint?: string;
  submitLabel: string;
  onClose: () => void;
  onConfirm: (route: RouteChoice, comment: string) => Promise<unknown>;
  withComment?: boolean;
  allowOpen?: boolean;
  /** ຄຳຮ້ອງໃໝ່ (ຍັງບໍ່ບັນທຶກ): ຜະລິດຕະພັນ ແລະ ຍອດ — ໃຫ້ກວດວົງເງິນອະນຸມັດຂອງຂັ້ນສຸດທ້າຍ */
  ctx?: RouteContext;
}) => {
  const t = useT();
  const { options, error } = useRouteOptions(applicationId, true, { ...ctx, level });
  const [route, setRoute] = useState<RouteChoice | null>(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const value = route ?? defaultRoute(options);
  const submit = async () => {
    if (!routeReady(value, options, allowOpen)) return;
    if (await runSave(() => onConfirm(value, comment), setSaving)) onClose();
  };
  return (
    <SettingModal title={title} hint={hint ?? t('crLevelOf').replace('{n}', String(level)).replace('{m}', String(levels))} icon="fa-share-from-square"
      saving={saving} onClose={onClose} onSubmit={submit} className="is-steps cr-route-modal" submit={{ label: submitLabel, icon: 'fa-paper-plane' }}
    >
      <Form fluid>
        <FormStep no={1} done={routeReady(value, options, allowOpen)} title={t('crRouteTitle').replace('{n}', String(level))} hint={t('crRouteRule')}>
          {error ? <p className="cr-route-note is-bad is-wide"><i className="fa-solid fa-triangle-exclamation" /> {error}</p>
            : <RoutePicker options={options} value={value} onChange={setRoute} level={level} allowOpen={allowOpen} />}
          {withComment && (
            <label className="is-wide cr-route-comment">
              <small>{t('crComment')}</small>
              <Input value={comment} onChange={setComment} placeholder={t('crRouteCommentPlaceholder')} />
            </label>
          )}
        </FormStep>
      </Form>
    </SettingModal>
  );
};
