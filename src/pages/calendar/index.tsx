import React, { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, InputPicker } from 'rsuite'
import {
  FiCalendar,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiEdit3,
  FiEye,
  FiMaximize2,
  FiMinimize2,
  FiPlus,
  FiTrash2,
} from 'react-icons/fi'
import axios from 'axios'
import { deleteApi, postApi, putApi } from '../../utils/configApi'
import { useT } from '../../context/LanguageContext'
import { getErrorMessage } from '../../utils/useCRUD'
import { Notific } from '../../utils/Notification'
import './calendar.css'
import { getMarkersForYear, markerLabel } from './calendarMarkers'
import { getLaoLunarDate } from './laoLunarCalendar'
import TaskPlanModal from './TaskPlanModal'
import TaskViewModal from './TaskViewModal'

type CalendarTask = {
  id: string
  startDate: string
  endDate: string
  title: string
  note: string
  done: boolean
  createdAt: string
}

type TaskStatusFilter = 'pending' | 'done' | 'all'

const STATUS_FILTERS: Array<{ value: TaskStatusFilter; label: string }> = [
  { value: 'pending', label: 'ຍັງບໍ່ສຳເລັດ' },
  { value: 'done', label: 'ສຳເລັດແລ້ວ' },
  { value: 'all', label: 'ທັງໝົດ' },
]

const MONTHS = [
  'ມັງກອນ', 'ກຸມພາ', 'ມີນາ', 'ເມສາ', 'ພຶດສະພາ', 'ມິຖຸນາ',
  'ກໍລະກົດ', 'ສິງຫາ', 'ກັນຍາ', 'ຕຸລາ', 'ພະຈິກ', 'ທັນວາ',
]

const MONTH_PICKER_DATA = MONTHS.map((label, value) => ({ label, value }))
const YEAR_PICKER_DATA = Array.from({ length: 131 }, (_, index) => {
  const value = 1970 + index
  return { label: String(value), value }
})

const WEEKDAYS = ['ຈັນ', 'ອັງຄານ', 'ພຸດ', 'ພະຫັດ', 'ສຸກ', 'ເສົາ', 'ອາທິດ']
const FULL_WEEKDAYS = ['ວັນອາທິດ', 'ວັນຈັນ', 'ວັນອັງຄານ', 'ວັນພຸດ', 'ວັນພະຫັດ', 'ວັນສຸກ', 'ວັນເສົາ']

const LAO_CALENDAR_LOCALE = {
  sunday: WEEKDAYS[6],
  monday: WEEKDAYS[0],
  tuesday: WEEKDAYS[1],
  wednesday: WEEKDAYS[2],
  thursday: WEEKDAYS[3],
  friday: WEEKDAYS[4],
  saturday: WEEKDAYS[5],
  today: 'ມື້ນີ້',
  formattedMonthPattern: 'MM yyyy',
  formattedDayPattern: 'dd/MM/yyyy',
}

const pad = (value: number) => String(value).padStart(2, '0')

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const dateFromKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

type WorkPlanRow = {
  _uuid: number | string
  title?: string
  note?: string
  start_date?: string
  end_date?: string
  done?: number | string
  createdAt?: string
}

/** ແປງແຖວຈາກ api (/workplan) ໃຫ້ເປັນຮູບແບບທີ່ໜ້ານີ້ໃຊ້ */
const mapWorkPlan = (row: WorkPlanRow): CalendarTask => {
  const startDate = String(row?.start_date ?? '').slice(0, 10)
  return {
    id: String(row?._uuid),
    startDate,
    endDate: String(row?.end_date ?? row?.start_date ?? '').slice(0, 10) || startDate,
    title: row?.title ?? '',
    note: row?.note ?? '',
    done: Number(row?.done) === 1,
    createdAt: row?.createdAt ?? '',
  }
}

const isTaskOnDate = (task: CalendarTask, dateKey: string) =>
  task.startDate <= dateKey && task.endDate >= dateKey

const formatShortDate = (dateKey: string) => {
  if (!dateKey) return '—'
  const [year, month, day] = dateKey.split('-')
  return `${day}/${month}/${year}`
}

const countTaskDays = (task: CalendarTask) => {
  const start = dateFromKey(task.startDate).getTime()
  const end = dateFromKey(task.endDate).getTime()
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1)
}

const formatTaskRange = (task: CalendarTask) => task.startDate === task.endDate
  ? formatShortDate(task.startDate)
  : `${formatShortDate(task.startDate)} – ${formatShortDate(task.endDate)}`

const CalendarPage: React.FC = () => {
  const t = useT()
  const today = useMemo(() => new Date(), [])
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(today))
  const [tasks, setTasks] = useState<CalendarTask[]>([])
  const [response, setResponse] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  // api ທີ່ບໍ່ມີ /workplan (404) — ເຊື່ອງສ່ວນແຜນວຽກ ປະຕິທິນລາວ ແລະ ວັນສຳຄັນຍັງໃຊ້ໄດ້ຄືເກົ່າ
  const [tasksSupported, setTasksSupported] = useState(true)
  const userId = useMemo(() => localStorage.getItem('userid') || '', [])
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [viewingTask, setViewingTask] = useState<CalendarTask | null>(null)
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('pending')
  const [agendaExpanded, setAgendaExpanded] = useState(false)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [startDate, setStartDate] = useState(() => toDateKey(today))
  const [endDate, setEndDate] = useState(() => toDateKey(today))
  const [editingId, setEditingId] = useState<string | null>(null)

  const currentYear = visibleMonth.getFullYear()
  const currentMonth = visibleMonth.getMonth()
  const markers = useMemo(() => getMarkersForYear(currentYear), [currentYear])
  const todayKey = toDateKey(today)

  const selectedDateValue = dateFromKey(selectedDate)
  const selectedMarkers = getMarkersForYear(selectedDateValue.getFullYear())
    .filter((marker) => marker.date === selectedDate)
  const selectedTasks = tasks
    .filter((task) => isTaskOnDate(task, selectedDate))
    // ວຽກທີ່ສຳເລັດແລ້ວໃຫ້ຢູ່ລຸ່ມສຸດ, ນອກນັ້ນລຽງຕາມເວລາສ້າງ
    .sort((a, b) => Number(a.done) - Number(b.done) || a.createdAt.localeCompare(b.createdAt))
  const monthMarkers = markers.filter((marker) => Number(marker.date.slice(5, 7)) === currentMonth + 1)

  const doneCount = selectedTasks.filter((task) => task.done).length
  const pendingCount = selectedTasks.length - doneCount
  const statusCount: Record<TaskStatusFilter, number> = {
    pending: pendingCount,
    done: doneCount,
    all: selectedTasks.length,
  }
  // ໂດຍຄ່າເລີ່ມຕົ້ນສະແດງສະເພາະວຽກທີ່ຍັງບໍ່ສຳເລັດ — ປ່ຽນເບິ່ງໄດ້ທີ່ຟິວເຕີສະຖານະ
  const visibleTasks = statusFilter === 'all'
    ? selectedTasks
    : selectedTasks.filter((task) => statusFilter === 'done' ? task.done : !task.done)

  // ດຶງແຜນວຽກຂອງເດືອນທີ່ກຳລັງເບິ່ງ (ບວກ 10 ມື້ຫົວ-ທ້າຍ ເພື່ອຄຸມວັນຂອງເດືອນຂ້າງຄຽງໃນຕາຕະລາງ)
  useEffect(() => {
    const loadTasks = async () => {
      const rangeStart = new Date(currentYear, currentMonth, 1)
      rangeStart.setDate(rangeStart.getDate() - 10)
      const rangeEnd = new Date(currentYear, currentMonth + 1, 0)
      rangeEnd.setDate(rangeEnd.getDate() + 10)

      try {
        setIsLoading(true)
        const res = await postApi('/workplan/fetch', {
          userid: userId,
          start_date: toDateKey(rangeStart),
          end_date: toDateKey(rangeEnd),
        })
        const rows = (res.data?.data ?? []) as WorkPlanRow[]
        setTasks(Array.isArray(rows) ? rows.map(mapWorkPlan) : [])
        setTasksSupported(true)
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          setTasksSupported(false)
          setTasks([])
        } else {
          Notific.error(getErrorMessage(error))
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadTasks()
  }, [currentYear, currentMonth, userId, response])

  const reloadTasks = () => setResponse(Date.now())

  const clearForm = (dateKey = selectedDate) => {
    setTitle('')
    setNote('')
    setStartDate(dateKey)
    setEndDate(dateKey)
    setEditingId(null)
  }

  const openTaskModal = () => {
    clearForm(selectedDate)
    setTaskModalOpen(true)
  }

  const closeTaskModal = () => {
    setTaskModalOpen(false)
    clearForm(selectedDate)
  }

  const handleDateSelect = (date: Date) => {
    const dateKey = toDateKey(date)
    setSelectedDate(dateKey)
    if (date.getMonth() !== currentMonth || date.getFullYear() !== currentYear) {
      setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    }
    clearForm(dateKey)
  }

  const moveMonth = (amount: number) => {
    const next = new Date(currentYear, currentMonth + amount, 1)
    setVisibleMonth(next)
    setSelectedDate(toDateKey(next))
    clearForm(toDateKey(next))
  }

  const selectMonth = (month: number) => {
    const next = new Date(currentYear, month, 1)
    setVisibleMonth(next)
    setSelectedDate(toDateKey(next))
    clearForm(toDateKey(next))
  }

  const selectYear = (year: number) => {
    const next = new Date(year, currentMonth, 1)
    setVisibleMonth(next)
    setSelectedDate(toDateKey(next))
    clearForm(toDateKey(next))
  }

  const goToToday = () => {
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDate(todayKey)
    clearForm(todayKey)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle) return

    const payload = {
      userid: userId,
      title: cleanTitle,
      note: note.trim(),
      start_date: startDate,
      end_date: endDate,
    }

    try {
      setIsSaving(true)
      // ມີ editingId = ແກ້ໄຂ (PUT), ບໍ່ມີ = ສ້າງໃໝ່ (POST) — id ສົ່ງເປັນ base64
      const res = editingId
        ? await putApi(`/workplan/${btoa(editingId)}`, payload)
        : await postApi('/workplan/create', payload)

      if (res.status === 200) {
        Notific.success(res.data?.message || 'ບັນທຶກຂໍ້ມູນສຳເລັດ')
        setTaskModalOpen(false)
        clearForm(selectedDate)
        reloadTasks()
      }
    } catch (error) {
      Notific.error(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  const viewTask = (task: CalendarTask) => setViewingTask(task)

  const editTask = (task: CalendarTask) => {
    setViewingTask(null)
    setEditingId(task.id)
    setTitle(task.title)
    setNote(task.note)
    setStartDate(task.startDate)
    setEndDate(task.endDate)
    setTaskModalOpen(true)
  }

  const toggleTask = async (task: CalendarTask) => {
    // ອັບເດດໜ້າຈໍກ່ອນ ແລ້ວຈຶ່ງ sync ກັບ api
    setTasks((prev) => prev.map((item) => item?.id === task.id ? { ...item, done: !item?.done } : item))
    try {
      await putApi(`/workplan/done/${btoa(task.id)}`, { done: task.done ? 0 : 1 })
    } catch (error) {
      Notific.error(getErrorMessage(error))
    } finally {
      reloadTasks()
    }
  }

  const deleteTask = (taskId: string) => {
    Notific.confirm('ຕ້ອງການລຶບບັນທຶກນີ້ບໍ?', async () => {
      try {
        const res = await deleteApi(`/workplan/${btoa(taskId)}`)
        if (res.status === 200) {
          Notific.success(res.data?.message || 'ລຶບຂໍ້ມູນສຳເລັດ')
          if (editingId === taskId) clearForm()
          reloadTasks()
        }
      } catch (error) {
        Notific.error(getErrorMessage(error))
      }
    })
  }

  const selectedDateLabel = `${FULL_WEEKDAYS[selectedDateValue.getDay()]}, ວັນທີ ${selectedDateValue.getDate()} ${MONTHS[selectedDateValue.getMonth()]} ${selectedDateValue.getFullYear()}`
  const selectedLunarDate = getLaoLunarDate(selectedDateValue)

  const renderCalendarCell = (date: Date) => {
    const key = toDateKey(date)
    const dayMarkers = getMarkersForYear(date.getFullYear()).filter((marker) => marker.date === key)
    const dayTasks = tasks.filter((task) => isTaskOnDate(task, key))
    const lunarDate = getLaoLunarDate(date)

    return (
      <span className="day-content">
        <span className="lunar-date-row">
          <span>{lunarDate.phase === 'waxing' ? 'ຂຶ້ນ' : 'ແຮມ'} {lunarDate.phaseDay} ຄ່ຳ</span>
          <span className="lunar-month">ດ. {lunarDate.monthLabel}</span>
          {lunarDate.isWanPhra && (
            <span className="wan-phra-mark" title="ວັນພຣະ / ວັນສິນ" aria-label="ວັນພຣະ / ວັນສິນ">
              <img src="/assets/img/calendar/wan-phra-buddha.png" alt="" aria-hidden="true" />
            </span>
          )}
        </span>
        {dayMarkers.slice(0, 1).map((marker) => (
          <span key={`${marker.date}-${marker.title}`} className={`day-marker ${marker.type}`} title={marker.title}>
            {marker.title}
          </span>
        ))}
        {dayTasks.slice(0, 2).map((task) => (
          <span key={task.id} className={`day-task ${task.done ? 'done' : ''}`} title={task.title}>
            {task.title}
          </span>
        ))}
        {dayMarkers.length + dayTasks.length > 3 && (
          <span className="more-count">+{dayMarkers.length + dayTasks.length - 3} ລາຍການ</span>
        )}
      </span>
    )
  }

  const getCalendarCellClass = (date: Date) => {
    const dateMarkers = getMarkersForYear(date.getFullYear()).filter((marker) => marker.date === toDateKey(date))
    const lunarDate = getLaoLunarDate(date)
    return [
      date.getDay() === 0 || date.getDay() === 6 ? 'rsuite-calendar-weekend' : '',
      dateMarkers.some((marker) => marker.type === 'official') ? 'rsuite-calendar-official' : '',
      lunarDate.isWanPhra ? 'rsuite-calendar-wan-phra' : '',
    ].filter(Boolean).join(' ') || undefined
  }

  return (
    <div className="work-calendar-page ">
      <ol className="breadcrumb float-end calendar-breadcrumb">
        <li className="breadcrumb-item"><Link to="/">{t('home')}</Link></li>
        <li className="breadcrumb-item active">ປະຕິທິນ</li>
      </ol>

      <div className="calendar-page-heading">
        <span className="calendar-heading-kicker">WORK PLANNER</span>
        <h1 className="page-header">ປະຕິທິນແຜນວຽກ</h1>
        <p>ວາງແຜນລ່ວງໜ້າ, ບັນທຶກວຽກຍ້ອນຫຼັງ ແລະ ບໍ່ພາດວັນສຳຄັນ</p>
      </div>

      <div className={`calendar-layout${agendaExpanded ? ' agenda-expanded' : ''}`}>
        <section className="calendar-main-card">
          <header className="calendar-toolbar">
            <div className="month-navigation">
              <button type="button" className="icon-button" onClick={() => moveMonth(-1)} aria-label="ເດືອນກ່ອນ">
                <FiChevronLeft />
              </button>
              <div className="calendar-period-selectors" aria-live="polite">
                <div>
                  <span>ເດືອນ</span>
                  <InputPicker
                    block
                    cleanable={false}
                    searchable={false}
                    data={MONTH_PICKER_DATA}
                    value={currentMonth}
                    className="calendar-period-picker"
                    popupClassName="calendar-input-picker-menu"
                    aria-label="ເລືອກເດືອນ"
                    onChange={(value) => {
                      if (typeof value === 'number') selectMonth(value)
                    }}
                  />
                </div>
                <div>
                  <span>ປີ</span>
                  <InputPicker
                    block
                    cleanable={false}
                    data={YEAR_PICKER_DATA}
                    value={currentYear}
                    className="calendar-period-picker"
                    popupClassName="calendar-input-picker-menu"
                    aria-label="ເລືອກປີ"
                    onChange={(value) => {
                      if (typeof value === 'number') selectYear(value)
                    }}
                  />
                </div>
                <small>ພ.ສ. {currentYear + 543}</small>
              </div>
              <button type="button" className="icon-button" onClick={() => moveMonth(1)} aria-label="ເດືອນຖັດໄປ">
                <FiChevronRight />
              </button>
            </div>
            <button type="button" className="today-button" onClick={goToToday}>
              <span /> ກັບໄປມື້ນີ້
            </button>
          </header>

          <div className="calendar-grid-wrap">
            <Calendar
              bordered
              isoWeek
              className="work-rsuite-calendar"
              value={selectedDateValue}
              locale={LAO_CALENDAR_LOCALE}
              renderCell={renderCalendarCell}
              cellClassName={getCalendarCellClass}
              onSelect={handleDateSelect}
            />
          </div>

          <footer className="calendar-legend">
            <span><i className="lunar" /> ຂຶ້ນ/ແຮມ · ເດືອນລາວ</span>
            <span><img className="wan-phra-legend-icon" src="/assets/img/calendar/wan-phra-buddha.png" alt="" aria-hidden="true" /> ວັນພຣະ/ວັນສິນ</span>
            <span><i className="official" /> ວັນພັກທາງການ</span>
            <span><i className="important" /> ວັນສຳຄັນ</span>
            <span><i className="festival" /> ວັນບຸນປະເພນີ</span>
            {tasksSupported && <span><i className="task" /> ບັນທຶກໜ້າວຽກ</span>}
          </footer>

          <div className="month-important-section">
            <div className="section-title-row">
              <div>
                <span className="section-kicker">LAO DATES</span>
                <h3>ວັນສຳຄັນໃນເດືອນ{MONTHS[currentMonth]}</h3>
              </div>
              <span className="month-marker-count">{monthMarkers.length} ລາຍການ</span>
            </div>
            {monthMarkers.length ? (
              <div className="month-marker-list">
                {monthMarkers.map((marker) => (
                  <button type="button" key={`${marker.date}-${marker.title}`} onClick={() => handleDateSelect(dateFromKey(marker.date))}>
                    <span className={`marker-date ${marker.type}`}>{marker.date.slice(8, 10)}</span>
                    <span><strong>{marker.title}</strong><small>{marker.detail || markerLabel[marker.type]}</small></span>
                    <FiChevronRight />
                  </button>
                ))}
              </div>
            ) : <p className="empty-month-marker">ເດືອນນີ້ບໍ່ມີວັນພັກທາງການທີ່ກຳນົດໄວ້</p>}
          </div>
        </section>

        <aside className="calendar-agenda-card">
          <header
            className="agenda-date-header"
            role="button"
            tabIndex={0}
            title={agendaExpanded ? 'ຫຍໍ້ລົງ' : 'ຄິກເພື່ອຂະຫຍາຍໃຫ້ກວ້າງຂຶ້ນ'}
            onClick={() => setAgendaExpanded((open) => !open)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                setAgendaExpanded((open) => !open)
              }
            }}
          >
            <span className="agenda-day-number">{selectedDateValue.getDate()}</span>
            <div>
              <span>ລາຍການປະຈຳວັນ</span>
              <h2>{selectedDateLabel}</h2>
              <p className="agenda-lunar-date">
                {selectedLunarDate.phase === 'waxing' ? 'ຂຶ້ນ' : 'ແຮມ'} {selectedLunarDate.phaseDay} ຄ່ຳ · ເດືອນ {selectedLunarDate.monthLabel}
                {selectedLunarDate.isWanPhra && (
                  <strong className="agenda-wan-phra">
                    <img src="/assets/img/calendar/wan-phra-buddha.png" alt="" aria-hidden="true" /> ວັນພຣະ/ວັນສິນ
                  </strong>
                )}
              </p>
            </div>
            <span className="agenda-expand-hint" aria-hidden="true">
              {agendaExpanded ? <FiMinimize2 /> : <FiMaximize2 />}
            </span>
          </header>

          {selectedMarkers.length > 0 && (
            <div className="selected-markers">
              {selectedMarkers.map((marker) => (
                <div key={`${marker.date}-${marker.title}`} className={`selected-marker ${marker.type}`}>
                  <i />
                  <div><span>{markerLabel[marker.type]}</span><strong>{marker.title}</strong>{marker.detail && <small>{marker.detail}</small>}</div>
                </div>
              ))}
            </div>
          )}

          {tasksSupported && (<>
          <div className="agenda-list-heading">
            <div>
              <h3>ແຜນວຽກຂອງວັນນີ້</h3>
              <span>{doneCount}/{selectedTasks.length} ສຳເລັດ</span>
            </div>
            <button type="button" className="open-task-modal-button" onClick={openTaskModal}>
              <FiPlus /> 
            </button>
          </div>

          <div className="agenda-status-filter" role="group" aria-label="ຟິວເຕີສະຖານະ">
            {STATUS_FILTERS.map((item) => (
              <button
                type="button"
                key={item?.value}
                className={statusFilter === item?.value ? 'active' : ''}
                aria-pressed={statusFilter === item?.value}
                onClick={() => setStatusFilter(item?.value)}
              >
                {item?.label}
                <small>{statusCount[item?.value]}</small>
              </button>
            ))}
          </div>

          <div className="agenda-task-list">
            {visibleTasks.length === 0 ? (
              <div className="empty-agenda">
                <span><FiCalendar /></span>
                {isLoading ? (
                  <strong>ກຳລັງໂຫຼດຂໍ້ມູນ...</strong>
                ) : selectedTasks.length === 0 ? (
                  <>
                    <strong>ຍັງບໍ່ມີໜ້າວຽກ</strong>
                    <p>ກົດ “ເພີ່ມແຜນວຽກ” ເພື່ອບັນທຶກວຽກສຳລັບວັນດຽວ ຫຼືຫຼາຍວັນ</p>
                  </>
                ) : statusFilter === 'done' ? (
                  <>
                    <strong>ຍັງບໍ່ມີວຽກທີ່ສຳເລັດ</strong>
                    <p>ວຽກທີ່ຕິກສຳເລັດແລ້ວຈະມາສະແດງຢູ່ບ່ອນນີ້</p>
                  </>
                ) : (
                  <>
                    <strong>ວຽກຂອງມື້ນີ້ສຳເລັດໝົດແລ້ວ 🎉</strong>
                    <p>ກົດ “ທັງໝົດ” ຫຼື “ສຳເລັດແລ້ວ” ເພື່ອເບິ່ງລາຍການທີ່ເຮັດແລ້ວ</p>
                  </>
                )}
              </div>
            ) : visibleTasks.map((task) => (
              <article key={task.id} className={`agenda-task ${task.done ? 'done' : ''}`}>
                <button type="button" className="task-check" onClick={() => toggleTask(task)} aria-label={task.done ? 'ເປີດໜ້າວຽກຄືນ' : 'ໝາຍວ່າສຳເລັດ'}>
                  {task.done && <FiCheck />}
                </button>
                <div className="task-copy">
                  <div className="task-meta">
                    <span className="task-range"><FiCalendar /> {formatTaskRange(task)}</span>
                  </div>
                  <h4>{task.title}</h4>
                  {task.note && (
                    <p
                      className="task-note-clamp"
                      role="button"
                      tabIndex={0}
                      title="ກົດເພື່ອເບິ່ງລາຍລະອຽດທັງໝົດ"
                      onClick={() => viewTask(task)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          viewTask(task)
                        }
                      }}
                    >
                      {task.note}
                    </p>
                  )}
                </div>
                <div className="task-actions">
                  <button type="button" onClick={() => viewTask(task)} aria-label="ເບິ່ງລາຍລະອຽດ"><FiEye /></button>
                  <button type="button" onClick={() => editTask(task)} aria-label="ແກ້ໄຂ"><FiEdit3 /></button>
                  <button type="button" onClick={() => deleteTask(task.id)} aria-label="ລຶບ"><FiTrash2 /></button>
                </div>
              </article>
            ))}
          </div>
          </>)}

          <p className="calendar-source-note">
            ວັນບຸນຈັນທະຄະຕິຄຳນວນອັດຕະໂນມັດຕາມລະບົບສຸລິຍະຍາຕ ລາວ–ໄທ ສຳລັບປີທີ່ເລືອກ. ວັນພັກຊົດເຊີຍ ແລະກຳນົດງານທ້ອງຖິ່ນອາດປ່ຽນຕາມປະກາດຂອງທາງການ.
          </p>
        </aside>
      </div>

      <TaskViewModal
        open={Boolean(viewingTask)}
        task={viewingTask && {
          title: viewingTask.title,
          note: viewingTask.note,
          rangeLabel: formatTaskRange(viewingTask),
          days: countTaskDays(viewingTask),
          done: viewingTask.done,
        }}
        onClose={() => setViewingTask(null)}
        onEdit={() => { if (viewingTask) editTask(viewingTask) }}
      />

      <TaskPlanModal
        open={taskModalOpen}
        isEditing={Boolean(editingId)}
        saving={isSaving}
        title={title}
        note={note}
        dateRange={[dateFromKey(startDate), dateFromKey(endDate)]}
        dateRangeLabel={`${formatShortDate(startDate)}${startDate !== endDate ? ` – ${formatShortDate(endDate)}` : ''}`}
        onClose={closeTaskModal}
        onSubmit={handleSubmit}
        onDateRangeChange={(value) => {
          setStartDate(toDateKey(value[0]))
          setEndDate(toDateKey(value[1]))
        }}
        onTitleChange={setTitle}
        onNoteChange={setNote}
      />
    </div>
  )
}

export default CalendarPage
