import React, { useEffect, useState } from 'react'
import { Input, Modal, Button } from 'rsuite';
import axios from 'axios';
import { Config } from '../../config/connection';
import { Notification } from '../../utils/Notification';
const FromDepart = ({ open, handleClose, data,fetchData }) => {
    const api = Config.API;
    const [inputs, setInputs] = useState({
        departId: '',
        depart_name: '',
        depart_reamrk: ''
    })
    const handleChange = (name, value) => {
        setInputs({
            ...inputs, [name]: value
        })
    }

    const handleSumit = async (event) => {
        event.preventDefault();
        try {
            const respons = await axios.post(`${api}depart/create`, inputs);
            if (respons.status === 200) {
                Notification.success('ການບັນທຶກຂໍ້ມູນສຳເລັດ', 'ແຈ້ງເຕືອນ');
                handleClose();
                fetchData();
                setInputs({
                    departId: '',
                    depart_name: '',
                    depart_reamrk: ''
                })
            }
        } catch {
            Notification.error('ການບັນທຶກຂໍ້ມູນບໍ່ສຳເລັດ', 'ແຈ້ງເຕືອນ');
        }
    }

useEffect(()=>{
    if(data){
        setInputs({
            departId: data.department_id,
            depart_name: data.depart_name,
            depart_reamrk: data.depart_reamrk
        })
    }
},[data])

    return (
        <Modal open={open} onClose={handleClose}>
            <Modal.Header>
                <Modal.Title className='py-1'>ຟອມບັນທຶກພະແນກ</Modal.Title>
            </Modal.Header>
            <form onSubmit={handleSumit}>
                <Modal.Body>
                    <div className="form-group mb-2">
                        <label htmlFor="" className='form-label'>ຊື່ພະແນກ</label>
                        <Input placeholder='ຊື່ພະແນກ' value={inputs.depart_name} onChange={(e) => handleChange('depart_name', e)} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="" className='form-label'>ໝາຍເຫດ</label>
                        <Input as='textarea' value={inputs.depart_reamrk} onChange={(e) => handleChange('depart_reamrk', e)} placeholder='ໝາຍເຫດ' />
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button type='submit' appearance="primary">ບັນທຶກ </Button>
                    <Button onClick={handleClose} color='red' appearance="primary"> ຍົກເລີກ</Button>
                </Modal.Footer>
            </form>
        </Modal>
    )
}

export default FromDepart