import { getLaoLunarDate } from './laoLunarCalendar'

export type MarkerType = 'official' | 'important' | 'festival'

export type CalendarMarker = {
  date: string
  title: string
  type: MarkerType
  detail?: string
}

type FixedDateMarker = Omit<CalendarMarker, 'date'> & { monthDay: string }

type LunarMarkerRule = Omit<CalendarMarker, 'date'> & {
  id: 'makha' | 'visakha' | 'padap-din' | 'khao-salak' | 'ork-phansa' | 'that-luang'
  lunarMonth: number
  phase: 'waxing' | 'waning'
  phaseDay: number
}

const FIXED_DATE_MARKERS: FixedDateMarker[] = [
  { monthDay: '01-01', title: 'ວັນປີໃໝ່ສາກົນ', type: 'official' },
  { monthDay: '01-20', title: 'ວັນສ້າງຕັ້ງກອງທັບປະຊາຊົນລາວ', type: 'important' },
  { monthDay: '03-08', title: 'ວັນແມ່ຍິງສາກົນ', type: 'official' },
  { monthDay: '03-22', title: 'ວັນສ້າງຕັ້ງພັກປະຊາຊົນປະຕິວັດລາວ', type: 'important' },
  { monthDay: '04-14', title: 'ບຸນປີໃໝ່ລາວ — ມື້ທີ 1', type: 'official' },
  { monthDay: '04-15', title: 'ບຸນປີໃໝ່ລາວ — ມື້ທີ 2', type: 'official' },
  { monthDay: '04-16', title: 'ບຸນປີໃໝ່ລາວ — ມື້ທີ 3', type: 'official' },
  { monthDay: '05-01', title: 'ວັນກຳມະກອນສາກົນ', type: 'official' },
  {
    monthDay: '05-02',
    title: 'ເລີ່ມຊ່ວງບຸນບັ້ງໄຟ',
    type: 'festival',
    detail: 'ວັນຈັດງານແຕ່ລະທ້ອງຖິ່ນອາດຕ່າງກັນ ກະລຸນາກວດປະກາດປະຈຳປີ',
  },
  { monthDay: '06-01', title: 'ວັນເດັກນ້ອຍສາກົນ ແລະ ວັນປູກຕົ້ນໄມ້ແຫ່ງຊາດ', type: 'important' },
  { monthDay: '07-13', title: 'ວັນເກີດປະທານ ສຸພານຸວົງ', type: 'important' },
  { monthDay: '07-20', title: 'ວັນສ້າງຕັ້ງສະຫະພັນແມ່ຍິງລາວ', type: 'official', detail: 'ວັນພັກສຳລັບພະນັກງານເພດຍິງ' },
  { monthDay: '08-15', title: 'ວັນປະກາດໃຊ້ລັດຖະທຳມະນູນ', type: 'important' },
  { monthDay: '10-07', title: 'ວັນຄູແຫ່ງຊາດ', type: 'important' },
  { monthDay: '10-22', title: 'ວັນເອກະລາດຂອງລາວ', type: 'important' },
  { monthDay: '12-02', title: 'ວັນຊາດ ສປປ ລາວ', type: 'official' },
  { monthDay: '12-13', title: 'ວັນເກີດປະທານ ໄກສອນ ພົມວິຫານ', type: 'important' },
]

const LUNAR_MARKER_RULES: LunarMarkerRule[] = [
  { id: 'makha', lunarMonth: 3, phase: 'waxing', phaseDay: 15, title: 'ບຸນມາຄະບູຊາ / ບຸນເຂົ້າຈີ່', type: 'festival' },
  { id: 'visakha', lunarMonth: 6, phase: 'waxing', phaseDay: 15, title: 'ບຸນວິສາຂະບູຊາ', type: 'festival' },
  { id: 'padap-din', lunarMonth: 9, phase: 'waning', phaseDay: 14, title: 'ບຸນຫໍ່ເຂົ້າປະດັບດິນ', type: 'festival' },
  { id: 'khao-salak', lunarMonth: 10, phase: 'waxing', phaseDay: 15, title: 'ບຸນເຂົ້າສະຫຼາກ', type: 'festival' },
  { id: 'ork-phansa', lunarMonth: 11, phase: 'waxing', phaseDay: 15, title: 'ບຸນອອກພັນສາ', type: 'festival' },
  {
    id: 'that-luang',
    lunarMonth: 12,
    phase: 'waxing',
    phaseDay: 15,
    title: 'ມື້ສຳຄັນບຸນພະທາດຫຼວງ',
    type: 'festival',
    detail: 'ຊ່ວງຈັດງານ 3–7 ວັນອາດປ່ຽນຕາມປະກາດຂອງທາງການ',
  },
]

const pad = (value: number) => String(value).padStart(2, '0')

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const addDays = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount)

const markerCache = new Map<number, CalendarMarker[]>()

const getLunarMarkersForYear = (year: number): CalendarMarker[] => {
  const daysInYear = new Date(year, 1, 29).getMonth() === 1 ? 366 : 365
  const calendarDays = Array.from({ length: daysInYear }, (_, index) => {
    const date = new Date(year, 0, index + 1)
    return { date, lunar: getLaoLunarDate(date) }
  })

  const markers: CalendarMarker[] = []

  // In an intercalary year there are two eighth lunar months. Buddhist Lent
  // starts on the full moon of the second eighth month; otherwise use the
  // only eighth-month full moon.
  const eighthMonthFullMoons = calendarDays.filter(({ lunar }) =>
    lunar.month === 8 && lunar.phase === 'waxing' && lunar.phaseDay === 15,
  )
  const khaoPhansaDay = eighthMonthFullMoons.find(({ lunar }) => lunar.isSecondEighthMonth)
    || eighthMonthFullMoons.at(-1)

  if (khaoPhansaDay) {
    markers.push({
      date: toDateKey(khaoPhansaDay.date),
      title: 'ວັນອາສາລະຫະບູຊາ ແລະ ບຸນເຂົ້າພັນສາ',
      type: 'festival',
    })
  }

  LUNAR_MARKER_RULES.forEach((rule) => {
    const matchedDay = calendarDays.find(({ lunar }) =>
      lunar.month === rule.lunarMonth
      && lunar.phase === rule.phase
      && lunar.phaseDay === rule.phaseDay,
    )
    if (!matchedDay) return

    const { id: _id, lunarMonth: _lunarMonth, phase: _phase, phaseDay: _phaseDay, ...marker } = rule
    markers.push({ ...marker, date: toDateKey(matchedDay.date) })

    if (rule.id === 'ork-phansa') {
      markers.push({
        date: toDateKey(addDays(matchedDay.date, 1)),
        title: 'ບຸນໄຫຼເຮືອໄຟ ແລະ ບຸນຊ່ວງເຮືອ',
        type: 'festival',
        detail: 'ກຳນົດການບຸນຊ່ວງເຮືອອາດປ່ຽນຕາມແຕ່ລະທ້ອງຖິ່ນ',
      })
    }
  })

  return markers
}

export const getMarkersForYear = (year: number): CalendarMarker[] => {
  const cached = markerCache.get(year)
  if (cached) return cached

  const fixedMarkers = FIXED_DATE_MARKERS.map(({ monthDay, ...marker }) => ({
    ...marker,
    date: `${year}-${monthDay}`,
  }))
  const markers = [...fixedMarkers, ...getLunarMarkersForYear(year)]
    .sort((first, second) => first.date.localeCompare(second.date) || first.title.localeCompare(second.title))

  markerCache.set(year, markers)
  return markers
}

export const markerLabel: Record<MarkerType, string> = {
  official: 'ວັນພັກທາງການ',
  important: 'ວັນສຳຄັນ',
  festival: 'ວັນບຸນປະເພນີ',
}
