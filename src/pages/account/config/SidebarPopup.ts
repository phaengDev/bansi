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

/** ເມນູຂອງໜ້າຕ່າງ ຕັ້ງຄ່າຂໍ້ມູນພື້ນຖານ (HR) — ຜູ້ໃຊ້ລະບົບ, ພະແນກ ແລະ ຕຳແໜ່ງ, ພະນັກງານ */
export const HR_MENU: SidebarPopupGroup[] = [
  {
    group: 'hrGroupSystem',
    items: [
      { key: 'users', icon: 'fa-solid fa-user-shield', label: 'hrUsers' },
    ],
  },
  {
    group: 'hrGroupOrg',
    items: [
      { key: 'departments', icon: 'fa-solid fa-sitemap', label: 'hrDepartmentsPositions' },
      { key: 'employees', icon: 'fa-solid fa-id-card', label: 'hrEmployees' },
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
export const toRailNav = (groups: SidebarPopupGroup[], t: (key: string) => string) =>
  groups.flatMap(({ group, items }) =>
    items.map((item) => ({ ...item, label: t(item.label), group: t(group) }))
  );

/** ລາຍການທຳອິດ — ໃຊ້ເປັນຄ່າຕັ້ງຕົ້ນຂອງ `railActiveKey` */
export const firstRailKey = (groups: SidebarPopupGroup[]) => groups[0]?.items[0]?.key ?? '';
