import type { MenuFeature } from '../accountSettings';
/**
 * ເມນູຂອງແຖບໄອຄອນຊ້າຍ (`railNav` ຂອງ <AppPage>) ໃນໜ້າ popup ຂອງ Account desktop.
 * `label` ແລະ `group` ເປັນ key ຂອງພາສາ — ໃຊ້ `toRailNav()` ແປກ່ອນສົ່ງໃຫ້ <AppPage>.
 */
export type SidebarPopupItem = {
  key: string;
  /** Font Awesome class, ເຊັ່ນ "fa-solid fa-user" */
  icon: string;
  /** key ຂອງ src/i18n/lao-dict.ts */
  label: string;
  /** ຂຶ້ນສະເພາະເມື່ອບໍລິສັດເປີດຟັງຊັນນີ້ (ຕັ້ງຄ່າບັນຊີ → ຕັ້ງຄ່າທົ່ວໄປ) — ເບິ່ງ withFeatures() */
  feature?: MenuFeature;
};

export type SidebarPopupGroup = {
  /** ຫົວຂໍ້ນ້ອຍຂອງກຸ່ມ — ຂຽນເທື່ອດຽວ ບໍ່ຕ້ອງໃສ່ຊ້ຳທຸກລາຍການ */
  group: string;
  items: SidebarPopupItem[];
};

/** ເມນູຂອງໜ້າ popup ຕັ້ງຄ່າບັນຊີ — ລຽງຕາມກຸ່ມ, ຫົວຂໍ້ກຸ່ມຂຽນເທື່ອດຽວ */
export const ACCOUNT_SETTING_MENU: SidebarPopupGroup[] = [
  {
    group: 'accountSetGroupGeneral',
    items: [
      { key: 'general', icon: 'fa-solid fa-sliders', label: 'accountSetGeneral' },
      { key: 'fiscalYear', icon: 'fa-solid fa-calendar-check', label: 'accountSetFiscalYear' },
      { key: 'currency', icon: 'fa-solid fa-coins', label: 'accountSetCurrency' },
    ],
  },
  {
    group: 'accountSetGroupAccounts',
    items: [
      { key: 'accountClass', icon: 'fa-solid fa-sitemap', label: 'accountSetAccountClass' },
      { key: 'accountType', icon: 'fa-solid fa-layer-group', label: 'accountSetAccountType' },
      { key: 'openingBalance', icon: 'fa-solid fa-scale-balanced', label: 'accountSetOpeningBalance' },
    ],
  },
  {
    group: 'accountSetGroupIncomeExpense',
    items: [
      { key: 'incomeType', icon: 'fa-solid fa-arrow-trend-up', label: 'accountSetIncomeType' },
      { key: 'expenseType', icon: 'fa-solid fa-arrow-trend-down', label: 'accountSetExpenseType' },
    ],
  },
  {
    group: 'accountSetGroupCashBank',
    items: [
      { key: 'bankAccount', icon: 'fa-solid fa-building-columns', label: 'accountSetBankAccount' },
      { key: 'paymentMethod', icon: 'fa-solid fa-money-bill-transfer', label: 'accountSetPaymentMethod' },
    ],
  },
  {
    group: 'accountSetGroupDocuments',
    items: [
      { key: 'journalType', icon: 'fa-solid fa-book-open', label: 'accountSetJournalType' },
      { key: 'docNumbering', icon: 'fa-solid fa-hashtag', label: 'accountSetDocNumbering' },
      { key: 'tax', icon: 'fa-solid fa-percent', label: 'accountSetTax' },
    ],
  },
  {
    group: 'accountSetGroupSecurity',
    items: [
      { key: 'menuLock', icon: 'fa-solid fa-lock', label: 'accountSetMenuLock' },
    ],
  },
];

/** ເມນູຂອງໜ້າຕ່າງ ບັນທຶກບັນຊີປະຈຳວັນ — ລາຍຮັບ ແລະ ລາຍຈ່າຍ ຢູ່ໜ້າຕ່າງດຽວກັນ */
export const JOURNAL_MENU: SidebarPopupGroup[] = [
  {
    group: 'journalGroupOverview',
    items: [
      { key: 'overview', icon: 'fa-solid fa-gauge-high', label: 'journalOverview' },
    ],
  },
  {
    group: 'journalGroupEntries',
    items: [
      { key: 'income', icon: 'fa-solid fa-arrow-trend-up', label: 'journalIncome' },
      { key: 'expense', icon: 'fa-solid fa-arrow-trend-down', label: 'journalExpense' },
    ],
  },
  {
    group: 'journalGroupGl',
    items: [
      { key: 'generalEntry', icon: 'fa-solid fa-pen-nib', label: 'glManualEntries' },
      { key: 'journalBook', icon: 'fa-solid fa-book-open', label: 'glJournalBook' },
    ],
  },
  {
    group: 'journalGroupReports',
    items: [
      { key: 'incomeReport', icon: 'fa-solid fa-chart-line', label: 'journalIncomeReport' },
      { key: 'expenseReport', icon: 'fa-solid fa-chart-pie', label: 'journalExpenseReport' },
    ],
  },
];

/** ເມນູຂອງໜ້າຕ່າງ ລາຍງານການເງິນ — ແຕ່ລະໃບລາຍງານ */
export const STATEMENTS_MENU: SidebarPopupGroup[] = [
  {
    group: 'fsGroupStatements',
    items: [
      { key: 'profitLoss', icon: 'fa-solid fa-scale-balanced', label: 'fsProfitLoss' },
      { key: 'cashFlow', icon: 'fa-solid fa-money-bill-transfer', label: 'fsCashFlow' },
      { key: 'balanceSheet', icon: 'fa-solid fa-landmark', label: 'fsBalanceSheet' },
      { key: 'equity', icon: 'fa-solid fa-chart-column', label: 'fsEquityChanges', feature: 'full_mode' },
      { key: 'notes', icon: 'fa-solid fa-file-lines', label: 'fsNotes', feature: 'full_mode' },
    ],
  },
  {
    group: 'fsGroupTax',
    items: [
      { key: 'vat', icon: 'fa-solid fa-receipt', label: 'fsVatReport', feature: 'use_vat' },
    ],
  },
];

/** ເມນູຂອງໜ້າຕ່າງ ລູກໜີ້ */
export const RECEIVABLES_MENU: SidebarPopupGroup[] = [
  {
    group: 'accountAppReceivables',
    items: [
      { key: 'overview', icon: 'fa-solid fa-gauge-high', label: 'arapOverview' },
      { key: 'docs', icon: 'fa-solid fa-file-invoice-dollar', label: 'arInvoices' },
      { key: 'payments', icon: 'fa-solid fa-hand-holding-dollar', label: 'arReceipts' },
      { key: 'partners', icon: 'fa-solid fa-user-tie', label: 'arCustomers' },
      { key: 'aging', icon: 'fa-solid fa-hourglass-half', label: 'arapAging' },
    ],
  },
];

/** ເມນູຂອງໜ້າຕ່າງ ເຈົ້າໜີ້ */
export const PAYABLES_MENU: SidebarPopupGroup[] = [
  {
    group: 'accountAppPayables',
    items: [
      { key: 'overview', icon: 'fa-solid fa-gauge-high', label: 'arapOverview' },
      { key: 'docs', icon: 'fa-solid fa-file-lines', label: 'apBills' },
      { key: 'payments', icon: 'fa-solid fa-money-bill-transfer', label: 'apPayments' },
      { key: 'partners', icon: 'fa-solid fa-truck-field', label: 'apSuppliers' },
      { key: 'aging', icon: 'fa-solid fa-hourglass-half', label: 'arapAging' },
    ],
  },
];

/** ເມນູຂອງໜ້າຕ່າງ ງົບປະມານ — ຕິດຕາມງົບຂອງປີ ແລະ ທຽບລາຍເດືອນ */
export const BUDGET_MENU: SidebarPopupGroup[] = [
  {
    group: 'accountAppBudget',
    items: [
      { key: 'overview', icon: 'fa-solid fa-gauge-high', label: 'budgetOverview' },
      { key: 'monthly', icon: 'fa-solid fa-calendar-days', label: 'budgetMonthly' },
    ],
  },
];

/** ເມນູຂອງໜ້າຕ່າງ ຕັ້ງຄ່າຂໍ້ມູນພື້ນຖານ (HR) — ຜູ້ໃຊ້ລະບົບ, ຂໍ້ມູນບໍລິສັດ, ພະແນກ ແລະ ຕຳແໜ່ງ, ພະນັກງານ */
export const HR_MENU: SidebarPopupGroup[] = [
  {
    group: 'hrGroupSystem',
    items: [
      { key: 'users', icon: 'fa-solid fa-user-shield', label: 'hrUsers' },
      { key: 'appRelease', icon: 'fa-brands fa-android', label: 'hrAppRelease' },
    ],
  },
  {
    group: 'hrGroupOrg',
    items: [
      { key: 'company', icon: 'fa-solid fa-building', label: 'hrCompany' },
      { key: 'departments', icon: 'fa-solid fa-building-user', label: 'hrDepartments' },
      { key: 'positions', icon: 'fa-solid fa-id-badge', label: 'hrPositions' },
      { key: 'empOptions', icon: 'fa-solid fa-list-check', label: 'hrEmpOptions' },
      { key: 'skills', icon: 'fa-solid fa-star', label: 'hrSkills' },
      { key: 'orgChart', icon: 'fa-solid fa-diagram-project', label: 'hrOrgChart' },
    ],
  },
];

/** ເມນູຂອງໜ້າຕ່າງ ການເຂົ້າ-ອອກວຽກ — ລາຍວັນ, ລາຍເດືອນ, ຄຳຂໍລາພັກ, OT, ວັນພັກ ແລະ ປະເພດການລາພັກ */
export const ATTENDANCE_MENU: SidebarPopupGroup[] = [
  {
    group: 'accountAppAttendance',
    items: [
      { key: 'daily', icon: 'fa-solid fa-calendar-day', label: 'attDaily' },
      { key: 'monthly', icon: 'fa-solid fa-table-cells', label: 'attMonthly' },
      { key: 'leaves', icon: 'fa-solid fa-plane-departure', label: 'attLeaveRequests' },
      { key: 'corrections', icon: 'fa-solid fa-fingerprint', label: 'attCorrections' },
      { key: 'overtime', icon: 'fa-solid fa-business-time', label: 'attOvertime' },
    ],
  },
  {
    group: 'attGroupSettings',
    items: [
      { key: 'holidays', icon: 'fa-solid fa-umbrella-beach', label: 'attHolidays' },
      { key: 'leaveTypes', icon: 'fa-solid fa-plane-departure', label: 'lvTypes' },
    ],
  },
];

/** ເມນູຂອງໜ້າຕ່າງ ເງິນເດືອນ — ໃບເງິນເດືອນປະຈຳເດືອນ ແລະ ຕັ້ງຄ່າ (ປກສ, ອາກອນ, ການຫັກ) */
export const PAYROLL_MENU: SidebarPopupGroup[] = [
  {
    group: 'accountAppPayroll',
    items: [
      { key: 'runs', icon: 'fa-solid fa-money-check-dollar', label: 'payRuns' },
      { key: 'advances', icon: 'fa-solid fa-hand-holding-dollar', label: 'advMenu' },
      { key: 'taxReport', icon: 'fa-solid fa-file-invoice', label: 'ptrMenu' },
    ],
  },
  {
    group: 'attGroupSettings',
    items: [
      { key: 'settings', icon: 'fa-solid fa-sliders', label: 'paySettings' },
    ],
  },
];

/** ເມນູຂອງໜ້າຕ່າງ ປິດງວດບັນຊີ — ວຽກທ້າຍເດືອນ (ປິດງວດ, ກະທົບຍອດ, ປັບອັດຕາ) ແລະ ອາກອນ */
export const CLOSING_MENU: SidebarPopupGroup[] = [
  {
    group: 'closeGroupMonth',
    items: [
      { key: 'periodClose', icon: 'fa-solid fa-calendar-check', label: 'closePeriodClose' },
      { key: 'bankRec', icon: 'fa-solid fa-scale-unbalanced-flip', label: 'closeBankRec', feature: 'use_bank_reconciliation' },
      { key: 'fxReval', icon: 'fa-solid fa-arrow-right-arrow-left', label: 'closeFxReval', feature: 'use_fx_revaluation' },
    ],
  },
  {
    group: 'closeGroupTax',
    items: [
      { key: 'taxPayment', icon: 'fa-solid fa-building-columns', label: 'closeTaxPayment', feature: 'full_mode' },
      { key: 'profitTax', icon: 'fa-solid fa-percent', label: 'closeProfitTax', feature: 'full_mode' },
      { key: 'withholding', icon: 'fa-solid fa-hand-holding-dollar', label: 'closeWithholding', feature: 'use_withholding' },
    ],
  },
];

/** ເມນູຂອງໜ້າຕ່າງ ຊັບສົມບັດຄົງທີ່ */
export const FIXED_ASSET_MENU: SidebarPopupGroup[] = [
  {
    group: 'accountAppFixedAssets',
    items: [
      { key: 'register', icon: 'fa-solid fa-building', label: 'faRegister' },
      { key: 'depreciation', icon: 'fa-solid fa-chart-line', label: 'faDepreciation' },
      { key: 'schedule', icon: 'fa-solid fa-table-list', label: 'faSchedule' },
    ],
  },
];

/** ເມນູຂອງໜ້າຕ່າງ ຜັງບັນຊີ — ຜັງບັນຊີ, ຜູກບັນຊີ ແລະ ການເປີດໃຊ້ລະບົບບັນຊີຄູ່ */
export const CHART_MENU: SidebarPopupGroup[] = [
  {
    group: 'glGroupChart',
    items: [
      { key: 'chart', icon: 'fa-solid fa-sitemap', label: 'accountAppChartOfAccounts' },
      { key: 'mapping', icon: 'fa-solid fa-link', label: 'glMapping' },
      { key: 'setup', icon: 'fa-solid fa-power-off', label: 'glSetup' },
    ],
  },
];

/**
 * ແປງເປັນ `railNav` ຂອງ <AppPage> — ຄາຍກຸ່ມອອກເປັນລາຍການຮຽນ ພ້ອມແປພາສາໃຫ້ແລ້ວ.
 * <AppPage> ຂຶ້ນຫົວຂໍ້ກຸ່ມໃຫ້ເທື່ອດຽວຢູ່ລາຍການທຳອິດຂອງແຕ່ລະກຸ່ມເອງ.
 */
/** ການເຮັດວຽກຂອງຂ້ອຍ — ມື້ນີ້ + ການເຂົ້າ-ອອກວຽກ ແລະ ຄຳຮ້ອງທີ່ກ່ຽວກັບມັນ (ລາພັກ, ລືມສະແກນ) */
export const MY_WORK_MENU: SidebarPopupGroup[] = [
  {
    group: 'myGroupWork',
    items: [
      { key: 'today', icon: 'fa-solid fa-sun', label: 'myToday' },
      { key: 'attendance', icon: 'fa-solid fa-calendar-check', label: 'myAttendance' },
    ],
  },
  {
    group: 'myGroupRequests',
    items: [
      { key: 'leaves', icon: 'fa-solid fa-plane-departure', label: 'myLeaves' },
      { key: 'corrections', icon: 'fa-solid fa-fingerprint', label: 'myCorrections' },
    ],
  },
];

/** ເງິນເດືອນຂອງຂ້ອຍ — ເງິນເດືອນ / ສະລິບ ແລະ ເງິນເບີກລ່ວງໜ້າ (ຫັກຄືນຈາກເງິນເດືອນ) */
export const MY_PAY_MENU: SidebarPopupGroup[] = [
  {
    group: 'myGroupPay',
    items: [
      { key: 'pay', icon: 'fa-solid fa-wallet', label: 'myPayPage' },
      { key: 'advances', icon: 'fa-solid fa-hand-holding-dollar', label: 'myAdvances' },
    ],
  },
];

/** ວຽກຂອງຂ້ອຍ — ວຽກທີ່ໄດ້ຮັບ / ທີ່ມອບໝາຍ, ແຜນວຽກ ແລະ ໂນດ */
export const MY_TASKS_MENU: SidebarPopupGroup[] = [
  {
    group: 'myGroupTasks',
    items: [
      { key: 'tasks', icon: 'fa-solid fa-inbox', label: 'myTasksReceived' },
      { key: 'assigned', icon: 'fa-solid fa-share-from-square', label: 'myTasksAssigned' },
    ],
  },
  {
    group: 'myGroupPlan',
    items: [
      { key: 'workplans', icon: 'fa-solid fa-calendar-week', label: 'myPlans' },
      { key: 'notes', icon: 'fa-solid fa-note-sticky', label: 'myNotes' },
    ],
  },
];

/**
 * ທີມ ແລະ ອະນຸມັດ — ອະນຸມັດຄຳຂໍ (ສະເພາະຄົນທີ່ມີສິດ / ເປັນຫົວໜ້າທີມ — MyWindow ເອົາອອກເມື່ອບໍ່ມີສິດ),
 * ທີມງານ (ສາຍງານ + ລາຍຊື່ເພື່ອນຮ່ວມງານ) ແລະ ໂຄງຮ່າງອົງກອນ
 */
export const MY_TEAM_MENU: SidebarPopupGroup[] = [
  {
    group: 'myGroupApprove',
    items: [{ key: 'approvals', icon: 'fa-solid fa-clipboard-check', label: 'myApprovals' }],
  },
  {
    group: 'myGroupTeam',
    items: [
      { key: 'team', icon: 'fa-solid fa-people-group', label: 'myTeamPage' },
      { key: 'org', icon: 'fa-solid fa-sitemap', label: 'myOrg' },
    ],
  },
];

/** ແຈ້ງເຕືອນຂອງຂ້ອຍ — ໜ້າດຽວ (ບໍ່ມີແຖບຊ້າຍ) */
export const MY_INBOX_MENU: SidebarPopupGroup[] = [
  {
    group: 'myGroupInbox',
    items: [{ key: 'notifications', icon: 'fa-solid fa-bell', label: 'myNotifications' }],
  },
];

export const toRailNav = (groups: SidebarPopupGroup[], t: (key: string) => string) =>
  groups.flatMap(({ group, items }) =>
    items.map((item) => ({ ...item, label: t(item.label), group: t(group) }))
  );

/** ເອົາລາຍການທີ່ບໍລິສັດປິດຟັງຊັນໄວ້ອອກ (ກຸ່ມທີ່ບໍ່ເຫຼືອລາຍການ ຖືກເອົາອອກນຳ) */
export const withFeatures = (groups: SidebarPopupGroup[], on: (feature: NonNullable<SidebarPopupItem['feature']>) => boolean) =>
  groups
    .map((g) => ({ ...g, items: g.items.filter((item) => !item.feature || on(item.feature)) }))
    .filter((g) => g.items.length);

/** ລາຍການທຳອິດ — ໃຊ້ເປັນຄ່າຕັ້ງຕົ້ນຂອງ `railActiveKey` */
export const firstRailKey = (groups: SidebarPopupGroup[]) => groups[0]?.items[0]?.key ?? '';
