import { Fragment, useState, type PointerEvent as ReactPointerEvent, type ReactElement, type ReactNode } from 'react';
import { Popover, Whisper } from 'rsuite';
import { useT } from '../../context/LanguageContext';
import { useIsTablet } from '../../utils/hook/useMediaQuery';

/** One entry of the rail menu — the icon shows when the rail is collapsed, the label when it's expanded. */
export type AppPageRailItem = {
  key: string;
  /** Font Awesome class, e.g. "fa-solid fa-user". */
  icon: string;
  label: ReactNode;
  /**
   * Small heading above this entry, printed once for each run of entries sharing it — group the menu
   * by listing the entries of a group next to each other. A collapsed rail shows it as a divider line.
   */
  group?: ReactNode;
};

export type AppPageProps = {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Optional pill/indicator in the header's top-right corner — give it className="app-page-badge" for the standard look. */
  badge?: ReactNode;
  /**
   * Optional dark icon rail down the left side — the page owns it, so each page decides its own logo,
   * icons and which one is active (`className="is-active"`). Omit it for no rail.
   */
  rail?: ReactNode;
  /**
   * Rail menu. Passing it turns the rail into a collapsible nav: a toggle at the top widens the rail
   * in place so each icon shows its label, and narrows it back to icons only. Free-form `rail` content
   * (a logo, extra icons) still renders above the menu.
   */
  railNav?: AppPageRailItem[];
  /** Key of the highlighted `railNav` entry. */
  railActiveKey?: string;
  /** Called with the key of the clicked `railNav` entry — the page owns the selection. */
  onRailSelect?: (key: string) => void;
  /** Heading beside the toggle while the rail is expanded. Defaults to "ເມນູ". */
  railTitle?: ReactNode;
  /**
   * Optional footer pinned to the bottom of the rail (a version note, a logout button, …) — the menu
   * above it scrolls, this stays put. Give a button `className="app-page-rail-item"` to make it look
   * like a menu entry (icon only while the rail is collapsed). Omit for no rail footer.
   */
  railFooter?: ReactNode;
  /** Set false when the page draws its own heading — the title/subtitle/badge row is skipped. */
  showHeader?: boolean;
  /** Two-column "main content + side panel" layout instead of a single column. */
  split?: boolean;
  /** Entire footer row (left note + right actions) — fully custom; omit for no footer. */
  footer?: ReactNode;
  children: ReactNode;
};

/**
 * Standard reusable full-page content shell for any page in the app — imported the same way as
 * `<AppWindow>`, but for content that opens as a real route instead of a floating popup. Every page
 * that needs this "header + content + footer" shell imports this one component and configures its
 * own `title`/`subtitle`/`badge`/`footer` — the body content is whatever that page passes as `children`.
 *
 * Always fills its container edge-to-edge — there is no `width`/`height` to set (unlike `<AppWindow>`,
 * which is sized per popup instance). Just give it a container with a definite height (a full page's
 * content area, or an `<AppWindow>` popup body) and it fills it.
 *
 * @example
 * <AppPage
 *   title="ລາຍງານ"
 *   subtitle="ຕົວຢ່າງໜ້າ"
 *   badge={<span className="app-page-badge"><i className="fa-solid fa-pen-ruler" /> ສະບັບຮ່າງ</span>}
 *   rail={<img src="/assets/img/logo/plc2.png" alt="" />}
 *   railNav={[
 *     { key: 'customer', icon: 'fa-solid fa-user', label: 'ຂໍ້ມູນລູກຄ້າ' },
 *     { key: 'confirm', icon: 'fa-solid fa-circle-check', label: 'ຢືນຢັນ' },
 *   ]}
 *   railActiveKey={step}
 *   onRailSelect={setStep}
 *   railFooter={<button type="button"><i className="fa-solid fa-right-from-bracket" /></button>}
 *   footer={
 *     <>
 *       <span>ບັນທຶກອັດຕະໂນມັດແລ້ວ</span>
 *       <span className="app-page-actions">
 *         <button type="button">ບັນທຶກຮ່າງ</button>
 *         <button type="button" className="is-primary">ສົ່ງ</button>
 *       </span>
 *     </>
 *   }
 * >
 *   <YourPageContent />
 * </AppPage>
 */
/**
 * ຫໍ່ປຸ່ມໃນແຖບໄອຄອນດ້ວຍ Popover — ເລື່ອນເມົ້າເຂົ້າໄປໃນ Popover ໄດ້ (ແທນ title ຂອງ browser).
 * ຕອນແຖບຂະຫຍາຍອອກແລ້ວ (`off`) ຊື່ເມນູເຫັນຢູ່ແລ້ວ ຈຶ່ງບໍ່ຕ້ອງ hover ໃຫ້ຂຶ້ນອີກ.
 */
const RailPopover = ({
  label,
  off,
  onClick,
  children,
}: {
  label: ReactNode;
  off?: boolean;
  /** ເຮັດວຽກອັນດຽວກັນກັບປຸ່ມ — ກົດຊື່ເມນູໃນ Popover ກໍ່ໄດ້ຜົນຄືກັນ */
  onClick?: () => void;
  children: ReactElement;
}) =>
  off ? (
    children
  ) : (
    <Whisper placement="rightStart" trigger="hover" enterable
      speaker={({ onClose, className, left, top, arrowOffsetLeft: _arrowLeft, arrowOffsetTop: _arrowTop, ...rest }: any, ref: any) => (
        // ຕ້ອງກະຈາຍ `rest` ໃສ່ນຳ — RSuite ຝາກ onMouseEnter/onMouseLeave ມາທາງນັ້ນ
        // ຖ້າຖິ້ມ ມັນຈະບໍ່ຮູ້ວ່າເມົ້າຢູ່ເທິງ Popover ແລ້ວປິດພາຍໃນ 200ms (enterable ໃຊ້ບໍ່ໄດ້).
        // arrowOffset* ຂອງ Whisper — Popover ຂອງ rsuite 6 ບໍ່ໃຊ້ ແລະ ສົ່ງຕໍ່ໃສ່ DOM (React ເຕືອນ) ຈຶ່ງຕັດອອກ
        <Popover ref={ref} {...rest} className={`app-page-rail-popover ${className ?? ''}`} style={{ left, top }} arrow>
          <button type="button"
            onClick={() => {
              onClick?.();
              onClose();
            }}
          >
            {label}
          </button>
        </Popover>
      )}
    >
      {children}
    </Whisper>
  );

/** ຄວາມກວ້າງຂອງແຖບເມນູຕອນຂະຫຍາຍ — ລາກຂອບຂວາເພື່ອປັບ, ຈື່ໄວ້ໃນ localStorage ໃຊ້ຮ່ວມກັນທຸກໜ້າ */
const RAIL_WIDTH_KEY = 'appPageRailWidth';
const RAIL_WIDTH_DEFAULT = 200;
const RAIL_WIDTH_MIN = 160;
const RAIL_WIDTH_MAX = 420;
const clampRailWidth = (w: number) => Math.min(RAIL_WIDTH_MAX, Math.max(RAIL_WIDTH_MIN, Math.round(w)));

const readRailWidth = () => {
  try {
    const saved = Number(localStorage.getItem(RAIL_WIDTH_KEY));
    return saved ? clampRailWidth(saved) : RAIL_WIDTH_DEFAULT;
  } catch {
    return RAIL_WIDTH_DEFAULT;
  }
};

const saveRailWidth = (w: number) => {
  try {
    localStorage.setItem(RAIL_WIDTH_KEY, String(w));
  } catch {
    /* ບັນທຶກບໍ່ໄດ້ກໍ່ບໍ່ເປັນຫຍັງ — ພຽງແຕ່ບໍ່ຈື່ */
  }
};

const AppPage = ({
  title,
  subtitle,
  badge,
  rail,
  railNav,
  railActiveKey,
  onRailSelect,
  railTitle,
  railFooter,
  showHeader = true,
  split = false,
  footer,
  children,
}: AppPageProps) => {
  const t = useT();
  const isTablet = useIsTablet();
  /** ແຖບໄອຄອນຂະຫຍາຍອອກເອງເພື່ອສະແດງຊື່ເມນູ — ຈໍນ້ອຍມັນລອຍທັບເນື້ອຫາ ຈຶ່ງປິດຫຼັງເລືອກ */
  const [railOpen, setRailOpen] = useState(false);
  const hasNav = !!railNav?.length;
  const toggleRail = () => setRailOpen((v) => !v);
  const [railWidth, setRailWidth] = useState(readRailWidth);
  const [resizing, setResizing] = useState(false);
  /** ລາກປັບຄວາມກວ້າງໄດ້ສະເພາະຈໍໃຫຍ່ຕອນແຖບຂະຫຍາຍ — ຈໍນ້ອຍແຖບລອຍທັບເນື້ອຫາ ໃຊ້ຄວາມກວ້າງຄົງທີ່ */
  const canResize = railOpen && !isTablet;

  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const handle = e.currentTarget;
    const startX = e.clientX;
    const startWidth = railWidth;
    let latest = startWidth;
    handle.setPointerCapture(e.pointerId);
    setResizing(true);

    const onMove = (ev: PointerEvent) => {
      latest = clampRailWidth(startWidth + ev.clientX - startX);
      setRailWidth(latest);
    };
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      setResizing(false);
      saveRailWidth(latest);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  };

  /** ດັບເບີນຄລິກຂອບ = ກັບຄືນຄວາມກວ້າງມາດຕະຖານ */
  const resetRailWidth = () => {
    setRailWidth(RAIL_WIDTH_DEFAULT);
    saveRailWidth(RAIL_WIDTH_DEFAULT);
  };

  return (
    <div className="app-page">
      {(rail || hasNav) && (
        <aside className={`app-page-rail${railOpen ? ' is-open' : ''}${resizing ? ' is-resizing' : ''}`}
          style={canResize ? { width: railWidth, minWidth: railWidth } : undefined}
        >
          {/* ຫົວແຖບ — ຢູ່ນອກກ່ອງທີ່ເລື່ອນ ຈຶ່ງຄ້າງຢູ່ເທິງສະເໝີເຖິງເມນູຈະຍາວ */}
          {hasNav && (
            <div className="app-page-rail-head">
              <RailPopover off={railOpen} label={t('menu')} onClick={toggleRail}>
                <button type="button" onClick={toggleRail}
                  className="app-page-rail-toggle"
                  aria-expanded={railOpen}
                  aria-label={railOpen ? t('closeAction') : t('menu')}
                >
                  <span className="d-flex align-items-center px-2 ">
                    <span><i className={`fa-solid ${railOpen ? 'fa-angles-left' : 'fa-angles-right'}`} aria-hidden="true" /></span>
                    <span className={`ms-2 ${railOpen ? '' : 'd-none'}`}>{railTitle ?? t('menu')}</span>
                  </span>
                </button>
              </RailPopover>
            </div>
          )}

          <div className="app-page-rail-body">
            {rail}

            {railNav?.map((item, i) => {
              const select = () => {
                onRailSelect?.(item.key);
                if (isTablet) setRailOpen(false);
              };
              /** ຫົວຂໍ້ກຸ່ມຂຶ້ນເທື່ອດຽວ ຢູ່ລາຍການທຳອິດຂອງກຸ່ມ */
              const group = item.group && item.group !== railNav[i - 1]?.group ? item.group : null;

              return (
                <Fragment key={item.key}>
                  {group && <span className="app-page-rail-group" title={typeof group === 'string' ? group : undefined}>{group}</span>}
                  <RailPopover off={railOpen} label={item.label} onClick={select}>
                    <button type="button"
                      className={`app-page-rail-item ${item.key === railActiveKey ? ' is-active' : ''}`}
                      onClick={select}
                    >
                      <span className="d-flex align-items-center px-2 py-0">
                        <span><i className={item.icon} aria-hidden="true" /></span>
                        <span className={`ms-2 ${railOpen ? '' : 'd-none'}`}>{item.label}</span>
                      </span>
                    </button>
                  </RailPopover>
                </Fragment>
              );
            })}
          </div>

          {/* ທ້າຍແຖບ — ຢູ່ນອກກ່ອງທີ່ເລື່ອນຄືກັນ ຈຶ່ງຄ້າງຢູ່ລຸ່ມສະເໝີ */}
          {railFooter && <div className="app-page-rail-foot">{railFooter}</div>}

          {/* ຂອບຂວາຂອງແຖບ — ລາກເພື່ອຢັບເຂົ້າ/ອອກ */}
          {canResize && (
            <div className="app-page-rail-resizer"
              role="separator"
              aria-orientation="vertical"
              aria-valuemin={RAIL_WIDTH_MIN}
              aria-valuemax={RAIL_WIDTH_MAX}
              aria-valuenow={railWidth}
              onPointerDown={startResize}
              onDoubleClick={resetRailWidth}
            />
          )}
        </aside>
      )}

      {/* ຈໍນ້ອຍ: ແຖບເມນູລອຍທັບເນື້ອຫາ ຈຶ່ງມີພື້ນຫຼັງໃຫ້ກົດປິດ (CSS ເຊື່ອງໄວ້ຢູ່ຈໍໃຫຍ່) */}
      {hasNav && railOpen && (
        <button type="button"
          className="app-page-rail-backdrop"
          aria-label={t('closeAction')}
          onClick={() => setRailOpen(false)}
        />
      )}

      <div className="app-page-main">
        {showHeader && (
          <header className="app-page-header">
            <span>
              {subtitle && <small>{subtitle}</small>}
              <h2>{title}</h2>
            </span>
            {badge}
          </header>
        )}

        <div className={`app-page-content p-2 ${split ? 'has-side' : ''}`}>{children}</div>

        {footer && <footer className="app-page-footer">{footer}</footer>}
      </div>
    </div>
  );
};

export default AppPage;
