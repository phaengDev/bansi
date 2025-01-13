import React, { useState, useEffect } from 'react'
import { Modal, Button, Grid, Row, Col, Input, InputPicker, SelectPicker, DatePicker } from 'rsuite';
import { useTypeLeave, useStaff } from '../../config/selectOption';
import { Config } from '../../config/connection';
import axios from 'axios';
import {Notification} from '../../utils/Notification';
function FormLeave({ open, hancleClose, data,fetchData }) {
 const api=Config.API
    const typeLeave = useTypeLeave();
    const staff = useStaff();

    const [valeus, setValues] = useState({
        leaves_id: null,
        staff_id_fk: '',
        request_date: new Date(),
        start_date: new Date(),
        end_date: new Date(),
        days: 1,
        type_leave: '',
        confirm: 1,
        description: '',
        file_leave: null,
        files: null
    });
    const handleChange = (value, name) => {
        setValues({
            ...valeus, [name]: value
        })
    }
    

const handleChangeStart = (value) => {
    const adjustedEndDate = new Date(value);
    if (adjustedEndDate >= new Date(valeus.end_date)) {
        adjustedEndDate.setDate(adjustedEndDate.getDate() + 1); // Ensure end_date is at least one day ahead
    }
    setValues((prevValues) => ({
        ...prevValues,
        start_date: value,
        end_date: adjustedEndDate,
    }));
    calculateDays(value, adjustedEndDate);
};

const handleChangeEnd = (value) => {
    if(value < valeus.start_date){
        value = valeus.start_date
    }
    setValues((prevValues) => ({
        ...prevValues,
        end_date: value,
    }));
    calculateDays(valeus.start_date, value);
};

const calculateDays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end - start; // Difference in milliseconds
    const diffDays = diffTime > 0 ? Math.ceil(diffTime / (1000 * 60 * 60 * 24))+1 : 1; // Ensure at least 1 day
    setValues((prevValues) => ({
        ...prevValues,
        days: diffDays,
    }));
};
    const handleChangeFile = (value) => {
        const file = value.target.files[0];
        setValues({
            ...valeus, file_leave: file
        })
    }

    const hancleSumit = async (e) => {
        e.preventDefault();
        const formData = new FormData();
        for (const key in valeus) {
            formData.append(key, valeus[key]);
        }
        try {
            const res = await axios.post(api + 'leave/create', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            if (res.status === 200) {
                Notification.success('ການບັນທຶກຂໍ້ມູນສຳເລັດ', 'ແຈ້ງເຕືອນ');
                fetchData();
                hancleClose();
            }
        } catch (error) {
            Notification.error('ການບັນທຶກຂໍ້ມູນບໍ່ສຳເລັດ', 'ແຈ້ງເຕືອນ');
        }
    }
    useEffect(() => {
        if (data) {
            setValues({
                leaves_id: data.leaves_id,
                staff_id_fk: data.staff_id_fk,
                request_date: new Date(data.request_date),
                start_date: new Date(data.start_date),
                end_date: new Date(data.end_date),
                days: data.days,
                type_leave: data.type_leave,
                confirm: data.confirm,
                description: data.description,
                file_leave: null,
                files: data.file_leave
            })
        }
    }, [data])

    return (
        <Modal open={open} onClose={hancleClose}>
            <Modal.Header>
                <Modal.Title>{data ? 'ແກ້ໄຂຂໍ້ມູນລາພັກ' : 'ລົງຂໍ້ມູນລາພັກຂໍ້ມູນ'}</Modal.Title>
            </Modal.Header>
            <form onSubmit={hancleSumit}>
                <Modal.Body>
                    <Grid fluid>
                        <Row className="show-grid">
                            <Col xs={24} md={24} lg={24} className='mb-2'>
                                <div className="form-group">
                                    <label className='form-label fs-bold'>ພະນັກງານ</label>
                                    <SelectPicker value={valeus.staff_id_fk} data={staff} placeholder='ເລືອກພະນັກງານ' onChange={(value) => handleChange(value, 'staff_id_fk')} block />
                                </div>
                            </Col>
                            <Col xs={12} md={12} lg={12} className='mb-2'>
                                <div className="form-group">
                                    <label className='form-label fs-bold'>ວັນທີເລີມ</label>
                                    <DatePicker oneTap value={valeus.start_date} format='dd/MM/yyyy' onChange={(value) => handleChangeStart(value, 'start_date')} block />
                                </div>
                            </Col>
                            <Col xs={12} md={12} lg={12} className='mb-2'>
                                <div className="form-group">
                                    <label className='form-label fs-bold'>ວັນທີສຸດທ້າຍ</label>
                                    <DatePicker oneTap value={valeus.end_date} format='dd/MM/yyyy' onChange={(value) => handleChangeEnd(value, 'end_date')} block />
                                </div>
                            </Col>
                            <Col xs={24} md={24} lg={24} className='mb-2'>
                                <div className="form-group">
                                    <label className='form-label fs-bold'>ລາຍລະອຽດ</label>
                                    <Input as={'textarea'} value={valeus.description} onChange={(value) => handleChange(value, 'description')} placeholder='ລາຍລະອຽດ' block />
                                </div>
                            </Col>

                            <Col xs={12} md={12} lg={12} className='mb-2'>
                                <div className="form-group">
                                    <label className='form-label fs-bold'>ວັນສະເໜີ</label>
                                    <DatePicker oneTap value={valeus.request_date} format='dd/MM/yyyy' onChange={(value) => handleChange(value, 'request_date')} block />
                                </div>
                            </Col>
                            <Col xs={12} md={12} lg={12} className='mb-2'>
                                <div className="form-group">
                                    <label className='form-label fs-bold'>ປະເພດການລາພັກ</label>
                                    <SelectPicker value={valeus.type_leave} data={typeLeave} placeholder='ເລືອກປະເພດ' onChange={(value) => handleChange(value, 'type_leave')} block />
                                </div>
                            </Col>
                            <Col xs={12} md={12} lg={12} className='mb-2'>
                                <div className="form-group">
                                    <label className='form-label fs-bold'>ສະຖານະ</label>
                                    <InputPicker data={[{ label: 'ຄ້າງອະນຸມັດ', value: 1 }, { label: 'ອະນຸມັດແລ້ວ', value: 2 }]} value={valeus.confirm} onChange={(value) => handleChange(value, 'confirm')} block />
                                </div>
                            </Col>
                            <Col xs={12} md={12} lg={12} className='mb-2'>
                                <div className="form-group">
                                    <label className='form-label fs-bold'>ເອກະສານ</label>
                                    <input type="file" onChange={handleChangeFile} className='form-control' block />
                                </div>
                            </Col>
                        </Row>
                    </Grid>
                </Modal.Body>
                <Modal.Footer>
                    <Button type='submit' appearance="primary" >ບັນທຶກ</Button>
                    <Button onClick={hancleClose} appearance="primary" color='red'>Close</Button>
                </Modal.Footer>
            </form>
        </Modal>
    )
}

export default FormLeave