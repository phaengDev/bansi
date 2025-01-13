import React from 'react'
import { Modal } from 'rsuite';
import { UrlImg } from '../../config/connection';
function ViewProfile({ open, handleClose, data }) {
    const img = UrlImg.URL;
    const imgUser = './assets/img/icon/icon-user.jpg';
    return (
        <Modal overflow={false} size='xs' className='con-tainer ' open={open} onClose={handleClose}>
            <div className='top-right' role='button' onClick={handleClose}><i class="fa-solid fa-circle-xmark fs-3 text-orange" /></div>
            <img src={data.profile !== '' ? img + 'profile/' + data.profile : imgUser} className="w-100 p-0" alt="" />
        </Modal>
    )
}

export default ViewProfile