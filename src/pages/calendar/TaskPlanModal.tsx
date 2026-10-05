import type { FormEvent } from 'react'
import { DateRangePicker, Input, Textarea } from 'rsuite'
import Modal from 'react-bootstrap/Modal'
import {
  FiArrowRight,
  FiCalendar,
  FiCheck,
  FiEdit3,
  FiFileText,
} from 'react-icons/fi'

type TaskPlanModalProps = {
  open: boolean
  isEditing: boolean
  saving?: boolean
  title: string
  note: string
  dateRange: [Date, Date]
  dateRangeLabel: string
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onDateRangeChange: (value: [Date, Date]) => void
  onTitleChange: (value: string) => void
  onNoteChange: (value: string) => void
}

const formatDate = (date: Date) => [
  String(date.getDate()).padStart(2, '0'),
  String(date.getMonth() + 1).padStart(2, '0'),
  date.getFullYear(),
].join('/')

const countCalendarDays = ([startDate, endDate]: [Date, Date]) => {
  const startUtc = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  const endUtc = Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
  return Math.max(1, Math.round((endUtc - startUtc) / 86_400_000) + 1)
}

const TaskPlanModal = ({
  open,
  isEditing,
  saving = false,
  title,
  note,
  dateRange,
  dateRangeLabel,
  onClose,
  onSubmit,
  onDateRangeChange,
  onTitleChange,
  onNoteChange,
}: TaskPlanModalProps) => {
  const numberOfDays = countCalendarDays(dateRange)

  return (
    <Modal
      show={open}
      onHide={onClose}
      size="lg"
      backdrop="static"
      className="calendar-task-modal"
    >
      <span className="task-modal-accent" aria-hidden="true" />

      <Modal.Header>
        <Modal.Title>
          <span className="task-modal-title-icon">
            {isEditing ? <FiEdit3 /> : <FiCalendar />}
          </span>
          <span className="task-modal-title-copy">
            <small>{isEditing ? 'EDIT WORK PLAN' : 'NEW WORK PLAN'}</small>
            <strong>{isEditing ? 'ແກ້ໄຂແຜນວຽກ' : 'ສ້າງແຜນວຽກໃໝ່'}</strong>
            <span>ກຳນົດຊ່ວງວັນທີ ແລະຂຽນສິ່ງທີ່ຈະເຮັດໃຫ້ຊັດເຈນ</span>
          </span>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className='p-2'>
        <form id="calendar-task-form" className="task-modal-form " onSubmit={onSubmit}>
          <section className="task-modal-section task-modal-date-section ">
            <header className="task-modal-section-heading">
              <span className="task-modal-step">01</span>
              <span>
                <strong>ຊ່ວງວັນທີ</strong>
                <small>ເລືອກວັນເລີ່ມຕົ້ນ ແລະວັນສິ້ນສຸດຂອງແຜນວຽກ</small>
              </span>
            </header>

            <div className=" task-modal-date-field">
              <span className="task-modal-field-label">ວັນທີເລີ່ມ – ວັນທີສິ້ນສຸດ</span>
              <DateRangePicker
                block
                size="lg"
                isoWeek
                cleanable={false}
                editable={false}
                ranges={[]}
                format="dd/MM/yyyy"
                character=" – "
                placement="auto"
                popupClassName="calendar-date-range-popup"
                placeholder="ເລືອກຊ່ວງວັນທີ"
                value={dateRange}
                onChange={(value) => {
                  if (value) onDateRangeChange(value)
                }}
              />
            </div>

            <div className="task-date-summary" aria-label={`ຊ່ວງແຜນວຽກ ${dateRangeLabel}`}>
              <span className="task-date-point">
                <small>ເລີ່ມຕົ້ນ</small>
                <strong>{formatDate(dateRange[0])}</strong>
              </span>
              <span className="task-date-arrow" aria-hidden="true"><FiArrowRight /></span>
              <span className="task-date-point">
                <small>ສິ້ນສຸດ</small>
                <strong>{formatDate(dateRange[1])}</strong>
              </span>
              <span className="task-date-duration">
                <strong>{numberOfDays}</strong>
                <small>ມື້</small>
              </span>
            </div>
          </section>

          <section className="task-modal-section task-modal-detail-section">
            <header className="task-modal-section-heading">
              <span className="task-modal-step">02</span>
              <span>
                <strong>ລາຍລະອຽດແຜນວຽກ</strong>
                <small>ຕັ້ງຊື່ສັ້ນໆ ແລະເພີ່ມຂໍ້ມູນທີ່ຈຳເປັນ</small>
              </span>
            </header>

            <label className="task-modal-field" htmlFor="task-plan-title">
              <span className="task-modal-field-label">
                <span>ຫົວຂໍ້ແຜນວຽກ <em>*</em></span>
                <small>{title.length}/120</small>
              </span>
              <span className="task-modal-control">
                <FiFileText aria-hidden="true" />
                <Input
                  id="task-plan-title"
                  value={title}
                  onChange={onTitleChange}
                  placeholder="ຕົວຢ່າງ: ປິດບັນຊີທ້າຍເດືອນ"
                  maxLength={120}
                  required
                  autoFocus
                />
              </span>
            </label>

            <label className="task-modal-field" htmlFor="task-plan-note">
              <span className="task-modal-field-label">
                <span>ລາຍລະອຽດເພີ່ມເຕີມ</span>
                <small>ບໍ່ບັງຄັບ</small>
              </span>
              <Textarea
                id="task-plan-note"
                value={note}
                onChange={onNoteChange}
                placeholder="ຂຽນສິ່ງທີ່ຕ້ອງເຮັດ, ເປົ້າໝາຍ ຫຼືຂໍ້ຄວນຈື່..."
                rows={5}
              />
            </label>
          </section>
        </form>
      </Modal.Body>

      <Modal.Footer className="task-modal-footer">
        <span className="task-modal-footer-note">
          <FiCheck aria-hidden="true" />
          ແຜນວຽກຈະສະແດງໃນທຸກວັນຂອງຊ່ວງທີ່ເລືອກ
        </span>
        <span className="task-modal-actions">
          <button type="button" className="task-modal-cancel" onClick={onClose} disabled={saving}>ຍົກເລີກ</button>
          <button type="submit" form="calendar-task-form" className="task-modal-save" disabled={saving}>
            <FiCheck />
            {saving ? 'ກຳລັງບັນທຶກ...' : (isEditing ? 'ບັນທຶກການແກ້ໄຂ' : 'ເພີ່ມໃສ່ປະຕິທິນ')}
          </button>
        </span>
      </Modal.Footer>
    </Modal>
  )
}

export default TaskPlanModal
