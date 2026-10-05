import Modal from 'react-bootstrap/Modal'
import {
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiEdit3,
  FiFileText,
} from 'react-icons/fi'

export type TaskViewData = {
  title: string
  note: string
  rangeLabel: string
  days: number
  done: boolean
}

type TaskViewModalProps = {
  open: boolean
  task: TaskViewData | null
  onClose: () => void
  onEdit: () => void
}

const TaskViewModal = ({ open, task, onClose, onEdit }: TaskViewModalProps) => (
  <Modal
    show={open && Boolean(task)}
    onHide={onClose}
    size="lg"
    className="calendar-task-modal calendar-task-view-modal"
  >
    <span className="task-modal-accent" aria-hidden="true" />

    <Modal.Header closeButton>
      <Modal.Title>
        <span className="task-modal-title-icon">
          <FiFileText />
        </span>
        <span className="task-modal-title-copy">
          <small>WORK PLAN DETAIL</small>
          <strong>{task?.title}</strong>
          <span>ລາຍລະອຽດແຜນວຽກທັງໝົດ</span>
        </span>
      </Modal.Title>
    </Modal.Header>

    <Modal.Body className="p-2">
      <div className="task-view-meta">
        <span className="task-view-chip">
          <FiCalendar aria-hidden="true" /> {task?.rangeLabel}
        </span>
        <span className="task-view-chip">
          <FiClock aria-hidden="true" /> {task?.days} ມື້
        </span>
        <span className={`task-view-chip status ${task?.done ? 'done' : ''}`}>
          <FiCheckCircle aria-hidden="true" /> {task?.done ? 'ສຳເລັດແລ້ວ' : 'ຍັງບໍ່ສຳເລັດ'}
        </span>
      </div>

      <div className="task-view-section">
        <span className="task-view-label">ລາຍລະອຽດ</span>
        {task?.note
          ? <p className="task-view-note">{task.note}</p>
          : <p className="task-view-empty">ບໍ່ມີລາຍລະອຽດເພີ່ມເຕີມ</p>}
      </div>
    </Modal.Body>

    <Modal.Footer className="task-modal-footer">
      <span className="task-modal-footer-note">
        <FiFileText aria-hidden="true" />
        ກົດ “ແກ້ໄຂ” ເພື່ອປັບປຸງແຜນວຽກນີ້
      </span>
      <span className="task-modal-actions">
        <button type="button" className="task-modal-cancel" onClick={onClose}>ປິດ</button>
        <button type="button" className="task-modal-save" onClick={onEdit}>
          <FiEdit3 /> ແກ້ໄຂ
        </button>
      </span>
    </Modal.Footer>
  </Modal>
)

export default TaskViewModal
