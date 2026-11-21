import React, { useMemo, useState } from 'react'
import { Calendar, InputPicker } from 'rsuite'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import './calendar.css'
import { getMarkersForYear, markerLabel } from './calendarMarkers'
import { getLaoLunarDate } from './laoLunarCalendar'

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

const CalendarPage: React.FC = () => {
  const today = useMemo(() => new Date(), [])
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(today))

  const currentYear = visibleMonth.getFullYear()
  const currentMonth = visibleMonth.getMonth()
  const markers = useMemo(() => getMarkersForYear(currentYear), [currentYear])
  const todayKey = toDateKey(today)

  const selectedDateValue = dateFromKey(selectedDate)
  const monthMarkers = markers.filter((marker) => Number(marker.date.slice(5, 7)) === currentMonth + 1)

  const handleDateSelect = (date: Date) => {
    const dateKey = toDateKey(date)
    setSelectedDate(dateKey)
    if (date.getMonth() !== currentMonth || date.getFullYear() !== currentYear) {
      setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    }
  }

  const moveMonth = (amount: number) => {
    const next = new Date(currentYear, currentMonth + amount, 1)
    setVisibleMonth(next)
    setSelectedDate(toDateKey(next))
  }

  const selectMonth = (month: number) => {
    const next = new Date(currentYear, month, 1)
    setVisibleMonth(next)
    setSelectedDate(toDateKey(next))
  }

  const selectYear = (year: number) => {
    const next = new Date(year, currentMonth, 1)
    setVisibleMonth(next)
    setSelectedDate(toDateKey(next))
  }

  const goToToday = () => {
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDate(todayKey)
  }

  const renderCalendarCell = (date: Date) => {
    const key = toDateKey(date)
    const dayMarkers = getMarkersForYear(date.getFullYear()).filter((marker) => marker.date === key)
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
        {dayMarkers.length > 1 && (
          <span className="more-count">+{dayMarkers.length - 1} ລາຍການ</span>
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
    <div className="work-calendar-page">
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
    </div>
  )
}

export default CalendarPage
