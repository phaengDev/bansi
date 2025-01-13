import React, { useState, useEffect } from 'react'
import { Modal, Button, Grid, Row, Col, Input, InputPicker } from 'rsuite'
import { useStatus } from '../../config/selectOption'
import { Config } from '../../config/connection';
import { Notification } from '../../utils/Notification';
import axios from 'axios';
function FromIncomExpenses({ open, handleClose, data, fetchData }) {
    const api = Config.API;
    const status = useStatus();
    const [inputs, setInputs] = useState({
        type_in_exId: '',
        status_id_fk: '',
        in_ex_name: '',
        typeCode: ''
    })

    const handleChange = (name, value) => {
        const item = status.find(item => item.value === value);
        setInputs({
            ...inputs, [name]: value
        })
        if (name === 'status_id_fk') {
            setInputs({
                ...inputs,
                status_id_fk: value,
                typeCode: item.codes
            })
        }
    }

    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            const resp = await axios.post(`${api}inex/create`, inputs);
            if (resp.status === 200) {
                Notification.success( 'ການດຳເນີນງານສຳເລັດແລ້ວ', 'ແຈ້ງເຕືອນ');
                fetchData();
                handleClose();
                setInputs({
                    type_in_exId: '',
                    status_id_fk: '',
                    in_ex_name: '',
                    typeCode: ''
                });
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            Notification.error( 'ແຈ້ງເຕືອນ','An error occurred');
        }
    };

    useEffect(() => {
        if (data) {
            setInputs({
                type_in_exId: data.type_in_ex_Id,
                status_id_fk: data.status_id_fk,
                in_ex_name: data.in_ex_name,
                typeCode: data.typeCode
            })
        }else{
            setInputs({
                type_in_exId: '',
                status_id_fk: '',
                in_ex_name: '',
                typeCode: ''
            })
        }
    }, [data])
    return (
        <Modal appearance="picker" keyboard={false} open={open} onClose={handleClose}>
            <Modal.Header>
                <Modal.Title className='my-2'>ຟອມເພີ່ມປະເພດລາຍຮັບລາຍຈ່າຍ</Modal.Title>
            </Modal.Header>
            <form onSubmit={handleSubmit}>
                <Modal.Body>
                    <Grid fluid>
                        <Row>
                            <Col sm={24} className='mb-2'>
                                <label htmlFor="" className='form-label fs-bold'>ປະເພດ <span className='text-red'>*</span></label>
                                <InputPicker data={status} value={inputs.status_id_fk} onChange={(e) => handleChange('status_id_fk', e)} required block />
                            </Col>
                            <Col sm={24}>
                                <label htmlFor="in_ex_name" className='form-label fs-bold'>ຊື່ປະເພດລາຍຮັບ ລາຍຈ່າຍ <span className='text-red'>*</span></label>
                                <Input value={inputs.in_ex_name} onChange={(e) => handleChange('in_ex_name', e)} placeholder='ຊື່ປະເພດລາຍຮັບ ລາຍຈ່າຍ' required />
                            </Col>
                        </Row>
                    </Grid>
                </Modal.Body>
                <Modal.Footer>
                    <Button type='submit' appearance="primary"> ບັນທຶກ </Button>
                    <Button onClick={handleClose} appearance="subtle"> ຍົກເລີກ</Button>
                </Modal.Footer>
            </form>
        </Modal>
    )
}

export default FromIncomExpenses