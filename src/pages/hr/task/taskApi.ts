import { useCallback, useEffect, useState } from 'react';
import { getApi, postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { useT } from '../../../context/LanguageContext';

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

/** ຄວາມຄືບໜ້າສ່ວນຂອງແຕ່ລະຄົນ — ພະນັກງານອັບເດດເອງໃນ app (ບໍ່ປ່ຽນສະຖານະຂອງວຽກ) */
export const PERSON_TODO = 1;
export const PERSON_DONE = 3;
export const PERSON_STATUSES: Record<number, { label: string; tone: string; icon: string }> = {
  1: { label: 'taskPersonTodo', tone: 'is-pending', icon: 'fa-regular fa-circle' },
  2: { label: 'taskPersonDoing', tone: 'is-doing', icon: 'fa-solid fa-circle-half-stroke' },
  3: { label: 'taskPersonDone', tone: 'is-done', icon: 'fa-solid fa-circle-check' },
};

/**
 * ສ່ວນຂອງຄົນໜຶ່ງໃນວຽກໜຶ່ງ ທີ່ໃຊ້ສະແດງ / ນັບ: ວຽກປິດແລ້ວ (ສຳເລັດ) = ສຳເລັດ 100 %; ນອກນັ້ນ = ຕາມທີ່ຄົນນັ້ນອັບເດດ.
 * reported = ເຄີຍອັບເດດ ຫຼື ເຮັດຫຍັງໃນວຽກແລ້ວ
 */
export const partOf = (task: Pick<Task, 'status'>, a: TaskAssignee) => {
  const closed = task.status === TASK_DONE;
  return {
    status: closed ? PERSON_DONE : a.status,
    progress: closed ? 100 : a.progress,
    reported: closed || a.status !== PERSON_TODO || !!a.active_at,
  };
};

/** ຄວາມຄືບໜ້າຂອງທີມໃນວຽກໜຶ່ງ: ຈຳນວນຄົນທີ່ສຳເລັດສ່ວນຂອງຕົນ + ສະເລ່ຍ % */
export const teamOf = (task: Pick<Task, 'status' | 'assignees'>) => {
  const parts = task.assignees.map((a) => partOf(task, a));
  return {
    done: parts.filter((p) => p.status === PERSON_DONE).length,
    total: parts.length,
    progress: parts.length ? Math.round(parts.reduce((sum, p) => sum + p.progress, 0) / parts.length) : 0,
  };
};

/**
 * ຄວາມສຳຄັນ = ຕາຕະລາງບໍລິຫານເວລາ (ຄືກັບ app): ສຳຄັນ / ບໍ່ສຳຄັນ × ເລັ່ງດ່ວນ / ບໍ່ເລັ່ງດ່ວນ → 4 ຊ່ອງ ແລະ ສິ່ງທີ່ຄວນເຮັດ.
 * important / urgent ທັງສອງ null = ຍັງບໍ່ໄດ້ຈັດ
 */
export type Quadrant = 'doNow' | 'schedule' | 'delegate' | 'drop';
export const QUADRANTS: Record<Quadrant, { roman: string; action: string; tone: string; icon: string }> = {
  doNow: { roman: 'I', action: 'taskQDoNow', tone: 'is-q1', icon: 'fa-solid fa-fire' },
  schedule: { roman: 'II', action: 'taskQSchedule', tone: 'is-q2', icon: 'fa-solid fa-calendar-check' },
  delegate: { roman: 'III', action: 'taskQDelegate', tone: 'is-q3', icon: 'fa-solid fa-bolt' },
  drop: { roman: 'IV', action: 'taskQDrop', tone: 'is-q4', icon: 'fa-solid fa-circle-minus' },
};
export const quadrantOf = (important: boolean | null | undefined, urgent: boolean | null | undefined): Quadrant | null => {
  if (important == null && urgent == null) return null;
  if (important) return urgent ? 'doNow' : 'schedule';
  return urgent ? 'delegate' : 'drop';
};
/** "ສຳຄັນ · ເລັ່ງດ່ວນ" ຂອງວຽກ */
export const useQuadrantLabel = () => {
  const t = useT();
  return (important: boolean | null, urgent: boolean | null) =>
    `${t(important ? 'taskImportant' : 'taskNotImportant')} · ${t(urgent ? 'taskUrgent' : 'taskNotUrgent')}`;
};

/** ສີໃຫ້ເລືອກຂອງໂປຣເຈັກ */
export const PROJECT_COLORS = ['#1580be', '#8b5cf6', '#0e9f6e', '#f08a12', '#e5484d', '#0ea5e9', '#d946ef', '#64748b'];

export type TaskProject = { _uuid: number; name: string; color: string; status: number; sort?: number; tasks?: number };

export type TaskAssignee = {
  employee_id: number;
  is_lead: boolean;
  emp_code: string;
  first_name: string;
  last_name: string | null;
  work_status: number | null;
  profile_url: string | null;
  /** ຄວາມຄືບໜ້າສ່ວນຂອງຕົນ (ພະນັກງານອັບເດດໃນ app) — ເບິ່ງ PERSON_STATUSES */
  status: number;
  progress: number;
  /** ຄັ້ງລ່າສຸດທີ່ຄົນນີ້ເຮັດຫຍັງໃນວຽກ (ອັບເດດ, ໝາຍລາຍການຍ່ອຍ, ຄອມເມັນ); null = ຍັງບໍ່ເຄີຍ */
  active_at: string | null;
};

export type TaskComment = {
  _uuid: number;
  body: string;
  createdAt: string;
  author_name: string;
  author_photo: string | null;
  from_app: boolean;
  mine: boolean;
  /** ຄົນທີ່ຖືກແຈ້ງເຖິງ — ຫວ່າງ / ບໍ່ມີ = ແຈ້ງທຸກຄົນ */
  to?: { employee_id: number; name: string }[];
};

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
  important: boolean | null;
  urgent: boolean | null;
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
