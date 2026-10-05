/**
 * Lao/Thai civil lunisolar calendar conversion (Suriyayatra system).
 *
 * Laos and Thailand share the same Chulasakarat-based lunar arithmetic for
 * waxing/waning days, numbered lunar months and intercalation. The integer
 * algorithm is adapted from KranaxALT/thailunar and hmmbug/pythaidate (MIT).
 * UI wording remains Lao and intentionally exposes only the fields this page
 * needs.
 */

export type LaoLunarDate = {
  phase: 'waxing' | 'waning'
  phaseDay: number
  month: number
  monthLabel: string
  isSecondEighthMonth: boolean
  isWanPhra: boolean
}

type CalendarYearType = 'A' | 'B' | 'C' | 'c'

type LunarSolarYear = {
  horakhun: number
  kammacapon: number
  avoman: number
  tithi: number
  weekday: number
  langsak: number
  newYearDay: number
  nextNewYearDay: number
  leapDay: boolean
  calendarType: CalendarYearType
  offset: boolean
}

type ResolvedCalendarYear = LunarSolarYear & { offsetDays: number }
type InternalLunarDate = { month: number; day: number; horakhun: number }

const DAYS_IN_800_YEARS = 292207
const TIME_UNITS_IN_ONE_DAY = 800
const EPOCH_OFFSET = 373
const CS_JULIAN_DAY_OFFSET = 1954167
const LUNAR_MONTHS = [0, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 8, 88, 5, 6]

const floorMod = (value: number, divisor: number) => {
  const remainder = value % divisor
  return remainder < 0 ? remainder + divisor : remainder
}

const gregorianToJulianDay = (year: number, month: number, day: number) => {
  const yearPrime = month <= 2 ? year - 1 : year
  const monthPrime = month <= 2 ? month + 12 : month
  let correction = 0

  if (year > 1582 || (year === 1582 && month > 10) || (year === 1582 && month === 10 && day >= 15)) {
    const century = Math.trunc(yearPrime / 100)
    correction = 2 - century + Math.trunc(century / 4)
  }

  let yearDays = Math.trunc(365.25 * yearPrime)
  if (yearPrime < 0) yearDays = Math.trunc(365.25 * yearPrime - 0.75)
  const monthDays = Math.trunc(30.6001 * (monthPrime + 1))

  return Math.trunc(correction + yearDays + monthDays + day + 1720995)
}

const makeLunarSolarYear = (year: number): LunarSolarYear => {
  const horakhun = Math.trunc((year * DAYS_IN_800_YEARS + EPOCH_OFFSET) / TIME_UNITS_IN_ONE_DAY) + 1
  const kammacapon = TIME_UNITS_IN_ONE_DAY - floorMod(year * DAYS_IN_800_YEARS + EPOCH_OFFSET, TIME_UNITS_IN_ONE_DAY)
  const avomanQuotient = Math.trunc((horakhun * 11 + 650) / 692)
  let avoman = floorMod(horakhun * 11 + 650, 692)
  if (avoman === 0) avoman = 692

  let tithi = floorMod(avomanQuotient + horakhun, 30)
  if (avoman === 692) tithi -= 1

  const weekday = floorMod(horakhun, 7)
  const nextHorakhun = Math.trunc(((year + 1) * DAYS_IN_800_YEARS + EPOCH_OFFSET) / TIME_UNITS_IN_ONE_DAY) + 1
  const nextQuotient = Math.trunc((nextHorakhun * 11 + 650) / 692)
  const nextTithi = floorMod(nextQuotient + nextHorakhun, 30)
  const langsak = Math.max(tithi, 1)
  const newYearOffset = langsak < 6 ? langsak + 29 : langsak
  const newYearDay = floorMod(weekday - newYearOffset + 36, 7)
  const leapDay = kammacapon <= 207

  let calendarType: CalendarYearType = 'A'
  if (tithi > 24 || tithi < 6) calendarType = 'C'
  if (tithi === 25 && nextTithi === 5) calendarType = 'A'
  if ((leapDay && avoman <= 126) || (!leapDay && avoman <= 137)) {
    calendarType = calendarType === 'C' ? 'c' : 'B'
  }

  let nextNewYearDay = newYearDay
  if (calendarType === 'A') nextNewYearDay = floorMod(newYearDay + 4, 7)
  if (calendarType === 'B') nextNewYearDay = floorMod(newYearDay + 5, 7)
  if (calendarType === 'C' || calendarType === 'c') nextNewYearDay = floorMod(newYearDay + 6, 7)

  return {
    horakhun,
    kammacapon,
    avoman,
    tithi,
    weekday,
    langsak,
    newYearDay,
    nextNewYearDay,
    leapDay,
    calendarType,
    offset: false,
  }
}

const resolveCalendarYear = (year: number): ResolvedCalendarYear => {
  const years = [-2, -1, 0, 1, 2].map((offset) => makeLunarSolarYear(year + offset))

  if (years[2].tithi === 24 && years[3].tithi === 6) {
    years.forEach((item) => {
      item.calendarType = 'C'
      item.nextNewYearDay = floorMod(item?.nextNewYearDay + 2, 7)
    })
  }

  for (let index = 1; index <= 3; index += 1) {
    if (years[index].calendarType === 'c') {
      const target = years[index].newYearDay === years[index - 1].nextNewYearDay ? index + 1 : index - 1
      years[target].calendarType = 'B'
      years[target].nextNewYearDay = floorMod(years[target].nextNewYearDay + 1, 7)
    }
  }

  for (let index = 1; index <= 3; index += 1) {
    if (
      years[index - 1].nextNewYearDay !== years[index].newYearDay
      && years[index].nextNewYearDay !== years[index + 1].newYearDay
    ) {
      years[index].offset = true
      years[index].langsak += 1
      years[index].newYearDay = floorMod(years[index].newYearDay + 6, 7)
      years[index].nextNewYearDay = floorMod(years[index].nextNewYearDay + 6, 7)
    }
  }

  const resolved = years[2]
  if (resolved.calendarType === 'c') resolved.calendarType = 'C'

  let offsetDays = resolved.langsak
  const extraDay = resolved.offset ? 1 : 0
  if (offsetDays < 6 + extraDay) offsetDays += 29

  return { ...resolved, offsetDays }
}

const findLunarDate = (calendarType: CalendarYearType, elapsedDays: number) => {
  const yearSlots: Record<'A' | 'B' | 'C', Array<[number, number]>> = {
    A: [[383, 16], [354, 15], [324, 12], [295, 11], [265, 10], [236, 9], [206, 8], [177, 7], [147, 6], [118, 5], [88, 4], [59, 3], [29, 2]],
    B: [[384, 16], [355, 15], [325, 12], [296, 11], [266, 10], [237, 9], [207, 8], [178, 7], [148, 6], [119, 5], [89, 4], [59, 3], [29, 2]],
    C: [[384, 15], [354, 12], [325, 11], [295, 10], [266, 9], [236, 8], [207, 7], [177, 6], [148, 5], [118, 14], [88, 13], [59, 3], [29, 2]],
  }
  const slots = yearSlots[calendarType === 'c' ? 'C' : calendarType]

  for (const [boundary, monthSlot] of slots) {
    if (elapsedDays > boundary) {
      return { month: LUNAR_MONTHS[monthSlot], day: elapsedDays - boundary }
    }
  }

  return { month: LUNAR_MONTHS[1], day: elapsedDays }
}

const fromCalendarYearAndDays = (year: number, elapsedDays: number): InternalLunarDate => {
  let currentYear = year
  let currentDays = elapsedDays
  let resolvedYear = resolveCalendarYear(currentYear)
  let daysInSolarYear = resolvedYear.leapDay ? 366 : 365

  while (currentDays > daysInSolarYear) {
    currentYear += 1
    currentDays -= daysInSolarYear
    resolvedYear = resolveCalendarYear(currentYear)
    daysInSolarYear = resolvedYear.leapDay ? 366 : 365
  }

  const lunar = findLunarDate(resolvedYear.calendarType, resolvedYear.offsetDays + currentDays)
  return { ...lunar, horakhun: resolvedYear.horakhun + currentDays }
}

const fromJulianDay = (julianDay: number): InternalLunarDate => {
  const horakhun = julianDay - CS_JULIAN_DAY_OFFSET
  if (horakhun < 1) throw new RangeError('Date precedes the Chulasakarat epoch')

  let year = Math.trunc((horakhun * TIME_UNITS_IN_ONE_DAY - EPOCH_OFFSET) / DAYS_IN_800_YEARS)
  let elapsedDays: number

  if (floorMod(horakhun, DAYS_IN_800_YEARS) === 95333) {
    year -= 1
    elapsedDays = 365
  } else {
    elapsedDays = horakhun - resolveCalendarYear(year).horakhun
  }

  return fromCalendarYearAndDays(year, elapsedDays)
}

export const getLaoLunarDate = (date: Date): LaoLunarDate => {
  const julianDay = gregorianToJulianDay(date.getFullYear(), date.getMonth() + 1, date.getDate())
  const lunar = fromJulianDay(julianDay)
  const nextDay = fromJulianDay(julianDay + 1)
  const phase = lunar.day > 15 ? 'waning' : 'waxing'
  const phaseDay = lunar.day > 15 ? lunar.day - 15 : lunar.day
  const isWanPhra = lunar.day === 8 || lunar.day === 15 || lunar.day === 23 || nextDay.month !== lunar.month
  const isSecondEighthMonth = lunar.month === 88
  const month = isSecondEighthMonth ? 8 : lunar.month

  return {
    phase,
    phaseDay,
    month,
    monthLabel: isSecondEighthMonth ? '8 ຫຼັງ' : String(month),
    isSecondEighthMonth,
    isWanPhra,
  }
}

