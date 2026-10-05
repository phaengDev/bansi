# bansi — ລະບົບບັນຊີການເງິນ (PLC)

ໜ້າເວັບບັນຊີຂອງ PL Lao Development — React 19 + TypeScript + Vite 8, UI ແບບ desktop
(ໄອຄອນ, taskbar, Start menu, ໜ້າຕ່າງ popup) ທີ່ໃຊ້ rsuite 6 ຢູ່ເທິງ Bootstrap 5 SCSS (Color Admin).
ຂໍ້ມູນທັງໝົດມາຈາກ [api-bansi](../api-bansi) (`/api`, ຄ່າຕັ້ງຕົ້ນ `http://localhost:8888/api`).

## ເລີ່ມໃຊ້

```bash
npm install
cp .env.example .env   # ປ່ຽນ VITE_API_URL ຖ້າ api-bansi ບໍ່ໄດ້ຢູ່ localhost:8888
npm run dev
```

| ຄຳສັ່ງ | ໃຊ້ເຮັດຫຍັງ |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b` ແລ້ວ `vite build` — unused import/variable ເຮັດໃຫ້ build ລົ້ມ |
| `npm run typecheck` | ກວດ type ຢ່າງດຽວ |
| `npm run lint` | ESLint (typescript-eslint + react-hooks) |
| `npm run preview` | ເປີດ `dist/` |

Login ດ້ວຍເບີໂທ 8 ຕົວ + ລະຫັດຜ່ານ (`POST /user/login`). ສ້າງຜູ້ໃຊ້ທຳອິດໄດ້ທີ່ api-bansi: `npm run create-admin`.

## ໂຄງສ້າງ

```
src/
  main.tsx                 BrowserRouter + LanguageProvider + CSS ທັງໝົດ
  App.tsx                  ປະຕູກວດ login (token ໝົດອາຍຸ → /login)
  config/app-route.tsx     /login, /account/* (ທຸກໜ້າເປີດເປັນໜ້າຕ່າງຢູ່ desktop)
  config/axiosSetup.ts     ແປງ Date ໃນ payload ເປັນວັນທີກ່ອນສົ່ງ
  pages/
    login/                 ໜ້າເຂົ້າສູ່ລະບົບ
    account/               desktop ບັນຊີ — Shell, DesktopMenu, ເມນູ/ລັອກເມນູ
      journal/             ລາຍຮັບ, ລາຍຈ່າຍ, ບັນທຶກທົ່ວໄປ, ລາຍງານ
      ledger/              ບັນຊີເງິນຄັງ, ໂອນເງິນ, ໃບແຈ້ງຍອດ
      gl/                  ຜັງບັນຊີ, ຜູກບັນຊີ, ງົບທົດລອງ
      arap/                ລູກໜີ້ / ເຈົ້າໜີ້
      statements/          ກຳໄລ-ຂາດທຶນ, ກະແສເງິນສົດ, ໃບສະຫຼຸບຊັບສົມບັດ
      setting/             ຕັ້ງຄ່າບັນຊີ (ປີການເງິນ, ສະກຸນເງິນ, ອາກອນ, ລະຫັດຜ່ານເມນູ …)
    calendar/              ປະຕິທິນລາວ (ແຜນວຽກສະແດງເມື່ອ api ມີ /workplan)
  components/Elements/     AppWindow (ໜ້າຕ່າງ popup), AppPage (ໂຄງໜ້າ + ແຖບໄອຄອນຊ້າຍ)
  context/LanguageContext  ພາສາ la / en / cn — useT(), useLangField()
  i18n/                    ວັດຈະນານຸກົມຂໍ້ຄວາມ
  utils/                   configApi (axios + format), useCRUD, Notification, …
  scss/                    Color Admin + ສະໄຕລ໌ desktop/ບັນຊີ (ເຂົ້າຜ່ານ scss/react.scss)
```

ເມນູໜ້າ desktop ມາຈາກ `GET /menu/main` (tbl_main_menu, types 2) — ຈັບຄູ່ກັບ `shortcuts` ໃນ
`src/pages/account/DesktopShared.ts` ດ້ວຍ `path`. ເພີ່ມໂມດູນໃໝ່ = ເພີ່ມ shortcut + ໜ້າໃນ `Shell.tsx`
ແລະ ແຖວເມນູທີ່ api-bansi (`seedDefaults`).
