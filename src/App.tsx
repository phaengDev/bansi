// src/App.tsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Navigate, Outlet } from 'react-router-dom';
import { Loader } from 'rsuite';
import { getApi, isTokenExpired, tokenExpiresAt } from './utils/configApi';

/** checking = ກຳລັງຖາມ api, ok = token ໃຊ້ໄດ້, invalid = ກັບໄປ login */
type Session = 'checking' | 'ok' | 'invalid';

/**
 * ປະຕູກວດ login ຂອງທຸກໜ້າທີ່ຢູ່ໃຕ້ `/` — ທຸກເທື່ອທີ່ເປີດເວັບ:
 * 1. ບໍ່ມີ token ຫຼື ໝົດອາຍຸແລ້ວ (exp ຂອງ JWT) → /login ທັນທີ
 * 2. ຖາມ api-bansi (GET /user/session) ກ່ອນສະແດງໜ້າໃດໆ — ປອມ / ບັນຊີຖືກປິດ / token ຂອງ app ພະນັກງານ → /login
 * 3. ເປີດໜ້າເວັບຄ້າງໄວ້ຈົນ token ໝົດອາຍຸ (1 ມື້) → /login ເອງ
 * token ທີ່ backend ປະຕິເສດລະຫວ່າງໃຊ້ງານ (401) ຖືກຈັບຢູ່ interceptor ຂອງ utils/configApi.ts.
 */
function App(): React.ReactElement {
  const [session, setSession] = useState<Session>(() => (isTokenExpired() ? 'invalid' : 'checking'));

  useEffect(() => {
    if (session !== 'checking') return;
    let alive = true;
    getApi('/user/session')
      .then(() => alive && setSession('ok'))
      .catch((error) => {
        if (!alive) return;
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        // ເຊື່ອມຕໍ່ api ບໍ່ໄດ້ / server error ບໍ່ໄລ່ອອກ — ແຕ່ລະໜ້າສະແດງ error ຂອງມັນເອງ
        setSession(status === 401 || status === 403 ? 'invalid' : 'ok');
      });
    return () => {
      alive = false;
    };
  }, [session]);

  useEffect(() => {
    if (session !== 'ok') return;
    const at = tokenExpiresAt();
    if (at === null) return;
    const timer = window.setTimeout(() => setSession('invalid'), Math.max(0, at - Date.now()));
    return () => window.clearTimeout(timer);
  }, [session]);

  if (session === 'invalid') {
    localStorage.removeItem('token');
    return <Navigate to="/login" replace />;
  }
  if (session === 'checking') return <Loader center size="md" />;
  // fs-15px — ຂະໜາດໂຕໜັງສືຂອງ desktop ດຽວກັບ .app ຂອງໂປຣເຈັກຕົ້ນແບບ
  return (
    <div className="fs-15px">
      <Outlet />
    </div>
  );
}

export default App;
