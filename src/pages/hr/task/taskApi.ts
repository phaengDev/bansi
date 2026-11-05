import { useCallback, useEffect, useState } from 'react';
import { getApi, postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';

/**
 * ມອບໝາຍວຽກ — api-bansi: /task/*. ມອບໝາຍ = ຜູ້ຮັບຜິດຊອບໄດ້ຮັບແຈ້ງເຕືອນເດັ້ງຂຶ້ນຈໍມືຖື, ອັບເດດສະຖານະ / ລາຍການຍ່ອຍໃນ app
 */
export const TASK_PENDING = 1;
export const TASK_DOING = 2;
export const TASK_DONE = 3;

/** ປ້າຍ + ສີ (class is-*) + ໄອຄອນ ຂອງແຕ່ລະສະຖານະ */
export const TASK_STATUSES: Record<number, { label: string; tone: string; icon: string }> = {
  [TASK_PENDING]: { label: 'taskPending', tone: 'is-pending', icon: 'fa-regular fa-circle' },
  [TASK_DOING]: { label: 'taskDoing', tone: 'is-doing', icon: 'fa-solid fa-circle-half-stroke' },
  [TASK_DONE]: { label: 'taskDone', tone: 'is-done', icon: 'fa-solid fa-circle-check' },
};

/** ຄວາມສຳຄັນ — 1 ປົກກະຕິ (ບໍ່ສະແດງປ້າຍໃນຕາຕະລາງ), 2 ສຳຄັນ (ສີສົ້ມ), 3 ດ່ວນ (ສີແດງ) */
export const TASK_PRIORITIES: Record<number, { label: string; tone: string; icon: string }> = {
  1: { label: 'taskPriorityNormal', tone: 'is-normal', icon: 'fa-regular fa-flag' },
  2: { label: 'taskPriorityHigh', tone: 'is-high', icon: 'fa-solid fa-flag' },
  3: { label: 'taskPriorityUrgent', tone: 'is-urgent', icon: 'fa-solid fa-bolt' },
};

export type TaskProject = { _uuid: number; name: string; color: string; status: number; sort?: number; tasks?: number };

export type TaskAssignee = {
  employee_id: number;
  is_lead: boolean;
  emp_code: string;
  first_name: string;
  last_name: string | null;
  work_status: number | null;
  profile_url: string | null;
};

export type TaskComment = { _uuid: number; body: string; createdAt: string; author_name: string; author_photo: string | null; from_app: boolean; mine: boolean };

/** ລາຍການໄທມ໌ໄລນ໌ — action: create | update | item_done | item_undone | file_add | file_del | archive | unarchive */
export type TaskLog = {
  _uuid: number;
  action: string;
  /** ຊ່ອງທີ່ແກ້ຂອງ action update */
  fields: string[];
  /** ສະຖານະໃໝ່ ຖ້າປ່ຽນ */
  status: number | null;
  /** ຊື່ລາຍການຍ່ອຍ / ໄຟລ໌ */
  note: string | null;
  createdAt: string;
  author_name: string;
  author_photo: string | null;
  author_employee_id: number | null;
  from_app: boolean;
};

/** ຄົນໃນຕົວເລືອກຜູ້ຮັບຜິດຊອບ */
export type TaskPerson = Pick<TaskAssignee, 'employee_id' | 'emp_code' | 'first_name' | 'last_name' | 'profile_url'> & {
  work_status?: number | null;
  department?: { _uuid: number; depart_name: string } | null;
};

/** ກົງກັບ MAX_ASSIGNEES ຂອງ api-bansi */
export const MAX_TASK_ASSIGNEES = 50;

export type TaskItem = { _uuid?: number; title: string; done: boolean };

export type TaskFile = { _uuid: number; original_name: string; mime_type: string | null; file_size: number; createdAt: string };

/** ເອກະສານຕໍ່ວຽກ — ກົງກັບ MAX_FILES ແລະ taskFileUpload ຂອງ api-bansi */
export const MAX_TASK_FILES = 20;
export const TASK_FILE_TYPES = /\.(jpe?g|png|webp|pdf|docx?|xlsx?|pptx?)$/i;
export const TASK_FILE_ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx';

export type Task = {
  _uuid: number;
  title: string;
  detail: string | null;
  project_id: number | null;
  project: TaskProject | null;
  status: number;
  priority: number;
  start_date: string | null;
  due_date: string | null;
  archived: number;
  done_at: string | null;
  createdAt: string;
  updatedAt: string;
  assignees: TaskAssignee[];
  items_total: number;
  items_done: number;
  items?: TaskItem[];
  files_total: number;
  files?: TaskFile[];
  comments_total: number;
  comments?: TaskComment[];
  timeline?: TaskLog[];
  starred: boolean;
  overdue: boolean;
  createdby_name?: string | null;
};

export type TaskSummary = { total: number; pending: number; doing: number; done: number; overdue: number; archived: number };

export const assigneeName = (a: Pick<TaskAssignee, 'first_name' | 'last_name'>) => [a.first_name, a.last_name].filter(Boolean).join(' ');
export const idOf = (row: { _uuid: number }) => btoa(String(row._uuid));

/** ລາຍການວຽກ (ຫຼັກ ຫຼື ຄັງເກັບ) + ສະຫຼຸບ — ຄົ້ນຫາ / ຈັດລຽງ / ແບ່ງໜ້າ ເຮັດໃນໜ້າເວັບ */
export const useTasks = (archived: boolean) => {
  const [rows, setRows] = useState<Task[] | null>(null);
  const [summary, setSummary] = useState<TaskSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const res = await postApi('/task/fetch', { archived: archived ? 1 : 0 });
      setRows(res.data?.data ?? []);
      setSummary(res.data?.summary ?? null);
    } catch (error) {
      console.error(error);
      Notific.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [archived]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { rows, setRows, summary, loading, reload };
};

/** ໂປຣເຈັກທັງໝົດ (ລວມທີ່ປິດ) */
export const useTaskProjects = () => {
  const [projects, setProjects] = useState<TaskProject[]>([]);
  const reload = useCallback(async () => {
    try {
      const res = await getApi('/task/project/fetch');
      setProjects(res.data?.data ?? []);
    } catch (error) {
      Notific.error(getErrorMessage(error));
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { projects, reload };
};
