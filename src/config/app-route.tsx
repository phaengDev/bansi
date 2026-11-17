import { Navigate, type RouteObject } from 'react-router-dom';
import App from '../App';
import LoginPage from '../pages/login/LoginPage';
import AccountShell from '../pages/account/Shell';
import AccountDesktopMenu from '../pages/account/DesktopMenu';

/**
 * desktop ຢູ່ທີ່ `/` — ທຸກໂມດູນເປີດເປັນໜ້າຕ່າງ (popup) ຢູ່ເທິງ desktop. path ຂອງເມນູ (/account/journal, …)
 * ໃຊ້ຈັບຄູ່ກັບແຖວ tbl_main_menu ຂອງ api-bansi ເທົ່ານັ້ນ ບໍ່ແມ່ນ route ແຍກ.
 * ລິ້ງເກົ່າ /account (bookmark) ແລະ path ອື່ນໆ → ກັບໄປ `/`
 */
const AppRoute: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <App />,
    children: [
      {
        element: <AccountShell />,
        children: [{ index: true, element: <AccountDesktopMenu /> }],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];

export default AppRoute;
