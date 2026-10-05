import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import { Notific } from "./Notification";
import { CONFIG, getToken } from "./configApi";

const api = CONFIG.URLAPI;

/** header ຢືນຢັນຕົວຕົນ — ອ່ານ token ໃໝ່ທຸກຄັ້ງ, ບໍ່ຄ້າງຄ່າຕັ້ງແຕ່ຕອນໂຫຼດ module */
const authHeader = (): Record<string, string> => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/** ✅ ===================Reuse: get message safely ==================*/

export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      const data = error.response.data as any;
      if (typeof data === 'string') return data;
      return (
        data?.message || data?.error || `Server error (${error.response.status})`
      );
    }
    if (error.request) return 'No response from server';
    return error.message || 'Request failed';
  }
  if (error instanceof Error) return error.message;
  return 'Unexpected error occurred';
};


//** =======================✅ Reuse: fetch list  ================*/

type FetchArgs<TPayload, TData> = {

  path: string;
  method?: 'GET' | 'POST';
  payload?: TPayload;
  params?: Record<string, any>;

  setData?: (data: TData) => void;
  setTotal?: (total: number) => void;
  setSummary?: (summary: any) => void;
  setSummaryAll?: (data: any) => void;
  setInvoices?: (item: any) => void;
  setObject?: (obj: any) => void;
  setLoading?: (v: boolean) => void;
  setStatus?: (data: any) => void;
};

export async function fetchList<TPayload, TData>({
  path,
  method = 'POST',
  payload,
  params,
  setData,
  setTotal,
  setSummary,
  setSummaryAll,
  setInvoices,
  setObject,
  setLoading,
  setStatus,
}: FetchArgs<TPayload, TData>) {
  try {
    setLoading?.(true);
    const config = {
      headers: authHeader(),
      params,
    };
    const res = method === 'GET'
      ? await axios.get(`${api}${path}`, config)
      : await axios.post(`${api}${path}`, payload, config);

    if (res.status === 200) {
      const result = (res.data?.data ?? res.data?.rate ?? res.data) as TData;
      setData?.(result);
      setTotal?.(res.data?.total);
      setSummary?.(res.data?.summary);
      setSummaryAll?.(res.data?.summaryAll);
      setInvoices?.(res.data?.invoice);
      setObject?.(res.data);
    }
    setStatus?.(res.status)
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      setStatus?.(error.response?.status);
    }
    console.error(getErrorMessage(error));
  } finally {
    setLoading?.(false);
  }
}

/**==================== ✅ Reuse: submit (create/update) =================*/

type SubmitCRUDArgs<TPayload> = {
  formRef?: React.RefObject<{ check: () => boolean }>;
  payload: TPayload | null | undefined;
  multipart?: boolean;
  // if has uuid => update, else create
  uuid?: string | null;
  updateUrl?: (uuidB64: string) => string;
  createUrl?: string;
  setLoading: (v: boolean) => void;
  onSuccess: (data: any) => void;
  onClose?: () => void;
  setStatus?: (status: number) => void;
  successMsg?: (resData: any, mode: "create" | "update") => string;

  // ✅ NEW: confirm before submit?
  confirm?: boolean;
  confirmMsg?: (mode: "create" | "update") => string;
};

export async function submitCRUD<TPayload>({
  formRef,
  multipart,
  payload,
  uuid,
  updateUrl,
  createUrl,
  setLoading,
  onSuccess,
  onClose,
  successMsg = (resData) => resData?.message ? resData?.message : resData?.error,
  setStatus,
  // ✅ defaults
  confirm = false,
  confirmMsg = (mode) => mode === "update" ? "Confirm to submit?" : "Confirm to create?",
}: SubmitCRUDArgs<TPayload>) {
  if (formRef?.current && !formRef.current.check()) return;
  if (!payload) return;

  const isUpdate = !!uuid;
  const mode: "create" | "update" = isUpdate ? "update" : "create";

  const headers: Record<string, string> = { ...authHeader() };

  // FormData ຕ້ອງປ່ອຍໃຫ້ browser ໃສ່ boundary ເອງ — ຕັ້ງ Content-Type ເອງຈະເສຍ boundary
  // ແລະ ຖ້າຕັ້ງເປັນ json axios ຈະແປງ FormData ເປັນ json ຈົນໄຟລ໌ຫາຍ
  const isFormData = payload instanceof FormData;
  if (!isFormData) headers["Content-Type"] = multipart ? "multipart/form-data" : "application/json";

  const config: AxiosRequestConfig = { headers };

  // ມີ uuid ແຕ່ບໍ່ມີ updateUrl → ຢ່າຕົກໄປສ້າງໃໝ່ (ຈະໄດ້ຂໍ້ມູນຊ້ຳ)
  const url = isUpdate ? updateUrl?.(btoa(uuid!)) : createUrl;
  if (!url) {
    Notific.error(isUpdate ? "updateUrl is required to update" : "createUrl is required to create");
    return;
  }

  const doSubmit = async () => {
    try {
      setLoading(true);

      const res = isUpdate
        ? await axios.put(`${api}${url}`, payload, config)
        : await axios.post(`${api}${url}`, payload, config);
          setStatus?.(res.status);
      if (res.status === 200) {
        Notific.success(successMsg(res.data, mode));
        onSuccess(res.data);
        onClose?.();
      } else if (res.status === 201) {
        Notific.warning(successMsg(res.data, mode));
      }
    } catch (error: unknown) {
      Notific.error(getErrorMessage(error));
      console.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  // ✅ confirm optional — ລໍຖ້າຜູ້ໃຊ້ຕອບ ແລ້ວຈຶ່ງ resolve ໃຫ້ຜູ້ເອີ້ນທີ່ await ໄດ້ຜົນຈິງ
  if (confirm) {
    return new Promise<void>((resolve) => {
      Notific.confirm(
        confirmMsg(mode),
        async () => { await doSubmit(); resolve(); },
        () => resolve(),
      );
    });
  }

  // ✅ no confirm -> submit immediately
  await doSubmit();
}


// ======================= ✅ reusable delete function =================*/

export const deleteById = async (args: {
  path: string;
  id: string;
  confirmText?: string;
  // false = delete without asking (e.g. chained auto delete)
  confirm?: boolean;
  // false = skip success toast (caller shows one itself)
  notify?: boolean;
  onSuccess?: (resData: any) => void;
  onClose?: () => void;
  setStatus?: (status: number) => void;
  
}) => {
  const {
    path,
    id,
    confirmText = "ທ່ານຕ້ອງການລົບຂໍ້ມູນນີ້ແທ້ບໍ່?",
    confirm = true,
    notify = true,
    onSuccess,
    onClose,
    setStatus,
  } = args;
  const doDelete = async () => {
    const request = axios.delete(
      `${api}${path}/${encodeURIComponent(btoa(id))}`,
      {
        headers: authHeader(),
        validateStatus: () => true,
      }
    ).then((res) => {
      // ລາຍງານ status ໃຫ້ຜູ້ເອີ້ນ ບໍ່ວ່າຈະສຳເລັດ ຫຼື ລົ້ມເຫຼວ (validateStatus ຮັບທຸກ status)
      setStatus?.(res.status);

      if (res.status !== 200) {
        const message = res.data?.message || res.data?.error || `Delete failed (${res.status})`;
        throw new Error(message);
      }
      return res;
    });
    const onDone = (res: any) => {
      if (notify) Notific.success(res.data?.message || "Deleted successfully");
      onSuccess?.(res.data);
      onClose?.();
    };
    const onFail = (error: unknown) => {
      Notific.error(getErrorMessage(error));
      console.error(getErrorMessage(error));
    };

    // notify=false: silent delete (no loading/success toast), errors still shown
    if (notify) Notific.loading(request, onDone, onFail);

    try {
      const res = await request;
      if (!notify) onDone(res);
    } catch (error) {
      if (!notify) onFail(error);
    }
  };

  if (confirm) Notific.confirm(confirmText, doDelete);
  else await doDelete();
};
