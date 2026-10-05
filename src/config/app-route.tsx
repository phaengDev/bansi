import { Navigate, type RouteObject } from 'react-router-dom';
import App from '../App';
import LoginPage from '../pages/login/LoginPage';
import AccountShell from '../pages/account/Shell';
import AccountDesktopMenu from '../pages/account/DesktopMenu';

/**
 * ທຸກໂມດູນບັນຊີເປີດເປັນໜ້າຕ່າງ (popup) ຢູ່ເທິງ desktop ຂອງ `/account` — path ຂອງເມນູ (/account/journal, …)
 * ໃຊ້ຈັບຄູ່ກັບແຖວ tbl_main_menu ຂອງ api-bansi ເທົ່ານັ້ນ ບໍ່ແມ່ນ route ແຍກ.
 */
const AppRoute: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/account" replace /> },
      {
        path: 'account/*',
        element: <AccountShell />,
        children: [{ index: true, element: <AccountDesktopMenu /> }],
      },
      { path: '*', element: <Navigate to="/account" replace /> },
    ],
  },
];

export default AppRoute;
