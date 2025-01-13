import React, { useState, useEffect } from 'react'
import { Modal, Button, Grid, Row, Col, Input, InputPicker, SelectPicker, DatePicker } from 'rsuite';
import { Config } from '../../config/connection';
import axios from 'axios';
import { Notification } from '../../utils/Notification';
import { useStaff } from '../../config/selectOption';
function FormLackWork({ open, hancleClose, data, fetchData }) {
    const api = Config.API
    const  userId=localStorage.getItem('userid');
    const staff = useStaff();

    const [inputs, setInputs] = useState({
        lack_work_id: null,
        lack_date: new Date(),
        status_lack: 1,
        staff_id_fk: '',
        description: '',
        user_create: userId,
    });

    const handleSumit = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post(api + 'lackwork/create', inputs);
            if (res.status === 200) {
                Notification.success(res.data.message,'ຢືນຢັນ');
                fetchData();
                hancleClose();
            }else if(res.status === 201){
                Notification.warning(res.data.message,'ຢືນຢັນ');
            }
        } catch (error) {
            Notification.error('ບັນທຶກຂໍ້ມູນຂາດວຽກບໍ່ສາມາດ','error');
        }
    }

    useEffect(() => {
        if (data) {
            setInputs({
                lack_work_id: data.lack_work_id,
                lack_date: new Date(data.lack_date),
                status_lack: data.status_lack,
                staff_id_fk: data.staff_id_fk,
                description: data.description,
                user_create: userId,
            });
        }
    }, [data,userId]);

    return (
        <Modal open={open} onClose={hancleClose}>
            <Modal.Header>
                <Modal.Title className='py-1'>{data ? 'ແກ້ໄຂຂໍ້ມູນຂາດວຽກ' : 'ບັນທຶກຂໍ້ມູນຂາດວຽກ'}</Modal.Title>
            </Modal.Header>
            <form onSubmit={handleSumit}>
            <Modal.Body>
                <Grid fluid>
                    <Row>
                        <Col xs={24} className='mb-2'>
                            <div className="form-group">
                                <label className='form-label fs-bold'>ພະນັກງານ</label>
                                <SelectPicker data={staff} value={inputs.staff_id_fk} onChange={value => setInputs({ ...inputs, staff_id_fk: value })} placeholder="ພະນັກງານ" block required />
                            </div>
                        </Col>
                        <Col xs={24} md={12} lg={12} className='mb-2'>
                            <div className="form-group">
                                <label className='form-label fs-bold'>ວັນທີຂາດວຽກ</label>
                                <DatePicker oneTap value={inputs.lack_date} format='dd/MM/yyyy' onChange={value => setInputs({ ...inputs, lack_date: value })} placeholder="ວັນທີ" block required />
                            </div>
                        </Col>
                        <Col xs={24} md={12} lg={12} className='mb-2'>
                            <div className="form-group">
                                <label className='form-label fs-bold'>ປະເພດ</label>
                                <InputPicker data={[{ label: 'ຕັ້ມມື້', value: 1 }, { label: 'ເຄີງມື້', value: 2 }]} value={inputs.status_lack} onChange={value => setInputs({ ...inputs, status_lack: value })} placeholder="ປະເພດ" block />
                            </div>
                        </Col>
                        <Col xs={24} md={24} lg={24} className='mb-2'>
                            <div className="form-group">
                                <label className='form-label fs-bold'>ລາຍລະອຽດ</label>
                                <Input as={'textarea'} value={inputs.description} onChange={value => setInputs({ ...inputs, description: value })} placeholder="ລາຍລະອຽດ" block />
                            </div>
                        </Col>
                    </Row>
                </Grid>
            </Modal.Body>
            <Modal.Footer>
                <Button type='submit' appearance="primary"> ບັນທຶກ </Button>
                <Button onClick={hancleClose} color='red' appearance="primary"> ຍົກເລີກ  </Button>
            </Modal.Footer>
            </form>
        </Modal>
    )
}

export default FormLackWork