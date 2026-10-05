import { useEffect, useRef, type ReactNode } from 'react';
import { Button, Form, Input, InputGroup, Loader, Modal, SelectPicker, Toggle } from 'rsuite';
import { useT } from '../../../context/LanguageContext';

/**
 * ຊິ້ນສ່ວນທີ່ໃຊ້ຮ່ວມກັນຂອງໜ້າຕັ້ງຄ່າບັນຊີ — ແຖບເຄື່ອງມື, ບັດລາຍການ, ຟອມ popup, ຕົວເລືອກແບບກ່ອງ.
 * ໜ້າຕາຂອງຟອມໃຊ້ style ດຽວກັບຟອມບັນຊີເງິນຄັງ (.acc-book-modal) ໃຫ້ທັງລະບົບບັນຊີເບິ່ງເປັນຊຸດດຽວ.
 */

export type ToolbarStat = { label: string; value: ReactNode; tone?: 'green' | 'violet' | 'gold' };

export const SettingToolbar = ({ stats, keyword, onKeyword, placeholder, addLabel, onAdd, canAdd = true, children }: {
  stats: ToolbarStat[];
  keyword?: string;
  onKeyword?: (value: string) => void;
  placeholder?: string;
  addLabel?: string;
  onAdd?: () => void;
  canAdd?: boolean;
  /** ຕົວກັ່ນຕອງເພີ່ມເຕີມ (segment, select) ລະຫວ່າງສະຖິຕິ ແລະ ຊ່ອງຄົ້ນຫາ */
  children?: ReactNode;
}) => {
  const t = useT();
  return (
    <div className="acs-toolbar">
      <div className="acs-stats">
        {stats.map((s) => (
          <span key={s.label} className={s.tone ? `is-${s.tone}` : ''}>
            <b>{s.value}</b> {s.label}
          </span>
        ))}
      </div>
      {children}
      {onKeyword && (
        <InputGroup inside size="sm" className="acs-search">
          <InputGroup.Addon><i className="fa-solid fa-magnifying-glass" /></InputGroup.Addon>
          <Input placeholder={placeholder ?? t('search')} value={keyword} onChange={onKeyword} />
        </InputGroup>
      )}
      {onAdd && (
        <button type="button" className="acc-class-add" disabled={!canAdd} onClick={onAdd}>
          <i className="fa-solid fa-plus" /> {addLabel}
        </button>
      )}
    </div>
  );
};

/** ສະຖານະ ໂຫຼດ / ບໍ່ມີຂໍ້ມູນ ຂອງລາຍການ */
export const ListState = ({ loading, empty, icon, children }: {
  loading: boolean;
  empty: boolean;
  icon: string;
  children: ReactNode;
}) => {
  const t = useT();
  if (loading) return <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>;
  if (empty) {
    return (
      <div className="acc-class-empty">
        <i className={`fa-solid ${icon}`} />
        <p>{t('noData')}</p>
      </div>
    );
  }
  return <>{children}</>;
};

export const StatusPill = ({ active }: { active: boolean }) => {
  const t = useT();
  return (
    <span className={`acc-class-status${active ? ' is-active' : ''}`}>
      <i className="fa-solid fa-circle" /> {active ? t('active') : t('inactive')}
    </span>
  );
};

/**
 * ບັດຂອງແຕ່ລະລາຍການ — ກ່ອງສີຊ້າຍ (ລະຫັດ ຫຼື ໄອຄອນ) + ຫົວຂໍ້/ຄຳອະທິບາຍ + ແຖວ meta (chip) + ຄ່າເດັ່ນທາງຂວາ.
 * tone = class ສີຂອງ .acc-class-code (is-blue, is-emerald, …)
 */
export const SettingCard = ({ tone, badge, title, subtitle, meta, aside, active, pill, onEdit, canEdit = true, actions, onToggle, toggling }: {
  tone: string;
  badge: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  aside?: ReactNode;
  active: boolean;
  /** ແທນປ້າຍ ໃຊ້ງານ/ບໍ່ໃຊ້ງານ ເມື່ອລາຍການມີສະຖານະແບບອື່ນ (ເຊັ່ນ ປີການເງິນ: ປັດຈຸບັນ / ເປີດ / ປິດ) */
  pill?: ReactNode;
  onEdit?: () => void;
  canEdit?: boolean;
  /** ປຸ່ມຄຳສັ່ງເພີ່ມເຕີມ (CardAction ແບບມີຂໍ້ຄວາມ) — ຢູ່ແຖວລຸ່ມສຸດຂອງບັດ ບໍ່ຊ້ອນກັນເປັນຖັນ */
  actions?: ReactNode;
  /** ມີ = ປ້າຍສະຖານະກາຍເປັນສະວິດ ເປີດ/ປິດໃຊ້ງານ (ຟອມບໍ່ມີຊ່ອງສະຖານະ) — ໃຊ້ຄູ່ກັບ useStatusToggle */
  onToggle?: (on: boolean) => void;
  toggling?: boolean;
}) => {
  const t = useT();
  return (
    <article className={`acs-card${active ? '' : ' is-off'}`}>
      <div className="acs-card-main">
        <span className={`acc-class-code acs-card-badge ${tone}`}>{badge}</span>
        <div className="acs-card-body">
          <div className="acs-card-head">
            <h4>{title}</h4>
            {pill ?? (onToggle ? (
              <label className={`acs-card-switch${active ? ' is-on' : ''}`} title={t(active ? 'statusTurnOff' : 'statusTurnOn')}>
                <span>{active ? t('active') : t('inactive')}</span>
                <Toggle size="sm" checked={active} loading={toggling} disabled={!canEdit || toggling} onChange={onToggle} />
              </label>
            ) : <StatusPill active={active} />)}
          </div>
          {subtitle && <p className="acs-card-sub">{subtitle}</p>}
          {meta && <div className="acs-card-meta">{meta}</div>}
        </div>
        {aside && <div className="acs-card-aside">{aside}</div>}
        {onEdit && (
          <button type="button" className="acc-class-edit acs-card-edit" disabled={!canEdit}
            aria-label={t('edit')} title={t('edit')} onClick={onEdit}
          >
            <i className="fa-solid fa-pen" />
          </button>
        )}
      </div>
      {actions && <div className="acs-card-foot">{actions}</div>}
    </article>
  );
};

/** chip ນ້ອຍໃນແຖວ meta ຂອງບັດ */
export const MetaChip = ({ icon, children, tone }: { icon?: string; children: ReactNode; tone?: string }) => (
  <span className={`acs-chip${tone ? ` is-${tone}` : ''}`}>
    {icon && <i className={`fa-solid ${icon}`} />} {children}
  </span>
);

/**
 * ກອບຟອມ popup ມາດຕະຖານ — ຫົວ (ໄອຄອນ + ຫົວຂໍ້ + ຄຳແນະນຳ), ເນື້ອໃນ, ທ້າຍ (ຍົກເລີກ / ບັນທຶກ).
 * ເນື້ອໃນແບ່ງກຸ່ມດ້ວຍ <FormSection> ທີ່ເປັນຕາລາງ 2 ຖັນ
 */
export const SettingModal = ({ title, hint, icon, saving, onClose, onSubmit, children, wide, compact }: {
  title: string;
  hint?: string;
  icon: string;
  saving?: boolean;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
  wide?: boolean;
  /** ຟອມນ້ອຍ 1–2 ຊ່ອງ (ເຊັ່ນ ຍົກເລີກລະຫັດຜ່ານເມນູ) — ແຄບລົງ, ຖັນດຽວ, ບໍ່ມີໝາຍເຫດ * */
  compact?: boolean;
}) => {
  const t = useT();
  return (
    <Modal open onClose={onClose} size="md" className={`acc-book-modal acs-modal${wide ? ' is-wide' : ''}${compact ? ' is-compact' : ''}`}>
      <Modal.Header>
        <div className="acc-book-modal-head">
          <span className="acc-book-modal-icon"><i className={`fa-solid ${icon}`} /></span>
          <span>
            <Modal.Title>{title}</Modal.Title>
            {hint && <small>{hint}</small>}
          </span>
        </div>
      </Modal.Header>
      <Modal.Body>
        <div className="acc-book-main">{children}</div>
      </Modal.Body>
      <Modal.Footer>
        <span className="acc-book-footnote"><span className="text-danger">*</span> {t('requiredFieldsNote')}</span>
        <Button appearance="default" className="acc-book-btn is-cancel" onClick={onClose}>{t('cancel')}</Button>
        <Button appearance="primary" className="acc-book-btn is-save" loading={saving} onClick={onSubmit}>
          <i className="fa-solid fa-check" /> {t('save')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

/** ກຸ່ມຊ່ອງໃນຟອມ — ຫົວຂໍ້ນ້ອຍ + ຕາລາງ 2 ຖັນ (ລູກທີ່ມີ class "is-wide" ກວ້າງເຕັມແຖວ) */
export const FormSection = ({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) => (
  <section className="acc-book-group">
    <header>
      <span>{title}</span>
      {note && <em>{note}</em>}
    </header>
    <div className="acc-book-grid">{children}</div>
  </section>
);

/**
 * ຂັ້ນຕອນຂອງຟອມແບບບັດ (ໃຊ້ໃນ modal ".acc-book-modal.is-steps") — ເລກຂັ້ນ (ກາຍເປັນ ✓ ເມື່ອປ້ອນຄົບ)
 * + ຫົວຂໍ້ + ຄຳແນະນຳ, ແລ້ວຕາລາງ 2 ຖັນ ທີ່ທຸກຊ່ອງກວ້າງ ແລະ ສູງເທົ່າກັນ
 */
export const FormStep = ({ no, done, title, hint, note, children }: {
  no: number;
  done?: boolean;
  title: string;
  hint?: string;
  note?: ReactNode;
  children: ReactNode;
}) => (
  <section className={`acc-book-step${done ? ' is-done' : ''}`}>
    <header>
      <span className="acc-book-step-no">{done ? <i className="fa-solid fa-check" /> : no}</span>
      <span className="acc-book-step-title">
        <b>{title}</b>
        {hint && <small>{hint}</small>}
      </span>
      {note && <em>{note}</em>}
    </header>
    <div className="acc-book-grid">{children}</div>
  </section>
);

/** SelectPicker ໃນຟອມ — ຂຽນ Form.Group ເອງ ເພາະ InputField ບໍ່ສົ່ງ renderOption/renderValue ຕໍ່ */
export const PickerField = ({ name, label, data, required = true, className, ...rest }: {
  name: string;
  label: string;
  data: Record<string, any>[];
  required?: boolean;
  className?: string;
} & Record<string, any>) => (
  <Form.Group controlId={`${name}-1`} className={className}>
    <Form.Label className="form-label">
      {label}
      {required && <span className="text-danger">*</span>}
    </Form.Label>
    <Form.Control name={name} accepter={SelectPicker} data={data as any[]} block popupClassName="acc-book-menu" {...rest} />
  </Form.Group>
);

/** ໝວດ / ປະເພດບັນຊີ ໃນ PickerField — ກ່ອງລະຫັດ (ສີຕາມໝວດ) + ຊື່ + ປ້າຍທ້າຍ; item ຕ້ອງມີ code, name, tone, cur? */
export const codeLabel = (_: unknown, item: any) => item && (
  <span className={`acc-book-opt acc-tone ${item.tone}`}>
    <b>{item.code}</b>
    <span>{item.name}</span>
    {item.cur && <em>{item.cur}</em>}
  </span>
);

/** ຊ່ອງສະຖານະໃນຟອມ — ສູງເທົ່າ input ເພື່ອໃຫ້ຮຽງກັບຊ່ອງອື່ນໃນແຖວດຽວກັນ */
export const ToggleField = ({ label, checked, onChange, onText, offText }: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  onText: string;
  offText: string;
}) => (
  <div className="rs-form-group">
    <label className="form-label">{label}</label>
    <div className={`acs-toggle-field${checked ? ' is-on' : ''}`}>
      <Toggle checked={checked} onChange={onChange} />
      <span>{checked ? onText : offText}</span>
    </div>
  </div>
);

export type Choice<T extends string | number> = { value: T; label: string; icon?: string; hint?: string };

/**
 * ຕົວເລືອກແບບກ່ອງ (ແທນ dropdown ເມື່ອມີ 2–6 ທາງເລືອກ) — ຢູ່ແຖວດຽວສະເໝີ ບໍ່ພໍກໍ່ເລື່ອນຂ້າງ (.acs-tiles).
 * ລໍ້ເມົາຂຶ້ນ-ລົງ ເລື່ອນແຖວໄປຂ້າງໃຫ້ ຈົນສຸດທາງຈຶ່ງປ່ອຍໃຫ້ຟອມເລື່ອນຕໍ່; ອັນທີ່ເລືອກຢູ່ຖືກເລື່ອນມາໃຫ້ເຫັນສະເໝີ
 */
export const ChoiceTiles = <T extends string | number>({ label, value, options, onChange, disabled, className = '' }: {
  label: string;
  value: T;
  options: Choice<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}) => {
  const rowRef = useRef<HTMLDivElement>(null);

  // React ລົງທະບຽນ onWheel ແບບ passive (preventDefault ບໍ່ໄດ້) — ຈຶ່ງຜູກ listener ເອງ
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const onWheel = (event: WheelEvent) => {
      // trackpad ເລື່ອນຂ້າງຢູ່ແລ້ວ — ປ່ອຍໃຫ້ browser ເຮັດເອງ
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const max = row.scrollWidth - row.clientWidth;
      if (max <= 0) return;
      const atEdge = event.deltaY < 0 ? row.scrollLeft <= 0 : row.scrollLeft >= max - 1;
      if (atEdge) return;
      event.preventDefault();
      row.scrollLeft = Math.max(0, Math.min(max, row.scrollLeft + event.deltaY));
    };
    // ມີຕົວເລືອກເຊື່ອງຢູ່ຊ້າຍ/ຂວາ → data-more ໃຫ້ CSS ຈາງຂອບດ້ານນັ້ນ (macOS ເຊື່ອງ scrollbar ໄວ້)
    const markMore = () => {
      const max = row.scrollWidth - row.clientWidth;
      row.dataset.more = [row.scrollLeft > 1 && 'start', row.scrollLeft < max - 1 && 'end'].filter(Boolean).join(' ');
    };
    const resize = new ResizeObserver(markMore);
    resize.observe(row);
    row.addEventListener('scroll', markMore, { passive: true });
    row.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      resize.disconnect();
      row.removeEventListener('scroll', markMore);
      row.removeEventListener('wheel', onWheel);
    };
  }, []);

  // ເປີດຟອມແກ້ໄຂ / ປ່ຽນຄ່າ — ເລື່ອນອັນທີ່ເລືອກມາໃຫ້ເຫັນ (ຂອບຊ້າຍ-ຂວາເທົ່ານັ້ນ ບໍ່ເລື່ອນຟອມ)
  useEffect(() => {
    const row = rowRef.current;
    const active = row?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!row || !active) return;
    const box = row.getBoundingClientRect();
    const tile = active.getBoundingClientRect();
    if (tile.left < box.left) row.scrollLeft -= box.left - tile.left + 8;
    else if (tile.right > box.right) row.scrollLeft += tile.right - box.right + 8;
  }, [value]);

  return (
    <div className={`rs-form-group ${className}`}>
      <label className="form-label">{label}</label>
      <div ref={rowRef} className="acs-tiles" role="radiogroup">
        {options.map((o) => (
          <button key={String(o.value)} type="button" role="radio" aria-checked={value === o.value}
            className={value === o.value ? 'is-active' : ''} disabled={disabled} onClick={() => onChange(o.value)}
          >
            {o.icon && <i className={`fa-solid ${o.icon}`} />}
            <span>
              <b>{o.label}</b>
              {o.hint && <small>{o.hint}</small>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * ປຸ່ມຄຳສັ່ງ — ຄ່າເລີ່ມຕົ້ນເປັນໄອຄອນຢ່າງດຽວ (ຕາຕະລາງ, ບັດສະກຸນເງິນ);
 * text = ສະແດງຂໍ້ຄວາມນຳ ສຳລັບແຖວລຸ່ມຂອງ SettingCard
 */
export const CardAction = ({ icon, label, onClick, disabled, tone, text }: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'danger' | 'accent';
  text?: boolean;
}) => (
  <button type="button" className={`acc-class-edit acs-action${tone ? ` is-${tone}` : ''}${text ? ' is-text' : ''}`}
    disabled={disabled} aria-label={label} title={label} onClick={onClick}
  >
    <i className={`fa-solid ${icon}`} />
    {text && <span>{label}</span>}
  </button>
);
