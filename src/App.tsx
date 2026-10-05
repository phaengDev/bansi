// src/App.tsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { isTokenExpired } from './utils/configApi';

/**
 * ປະຕູກວດ login ຂອງທຸກໜ້າທີ່ຢູ່ໃຕ້ `/` — ບໍ່ມີ token ຫຼື token ໝົດອາຍຸ (ອ່ານ exp ຂອງ JWT) → /login.
 * token ທີ່ backend ປະຕິເສດລະຫວ່າງໃຊ້ງານ (401) ຖືກຈັບຢູ່ interceptor ຂອງ utils/configApi.ts.
 */
function App(): React.ReactElement {
  if (isTokenExpired()) {
    localStorage.removeItem('token');
    return <Navigate to="/login" replace />;
  }
  // fs-15px — ຂະໜາດໂຕໜັງສືຂອງ desktop ດຽວກັບ .app ຂອງໂປຣເຈັກຕົ້ນແບບ
  return (
    <div className="fs-15px">
      <Outlet />
    </div>
  );
}

export default App;
