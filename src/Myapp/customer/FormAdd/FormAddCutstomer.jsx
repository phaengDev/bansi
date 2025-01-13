import React, { useEffect, useState } from 'react'
import { Modal, Button, Grid, Row, Col, SelectPicker, Input, InputGroup, InputPicker } from 'rsuite';
import PhoneFillIcon from '@rsuite/icons/PhoneFill';
import EmailFillIcon from '@rsuite/icons/EmailFill';
import WarningRoundIcon from '@rsuite/icons/WarningRound';
import { useProvince, useDistrict } from '../../../config/selectOption';
import { Config } from '../../../config/connection';
import axios from 'axios';
import { Notification } from '../../../utils/Notification';
import { use } from 'react';
function FormAddCutstomer({ open, handleClose, data }) {
    const api = Config.API;
    const img = Config.IMG;
    const province = useProvince();
    const [provinceId, setProvinceId] = useState(null);
    const district = useDistrict(provinceId);

    const [inputs, setInputs] = useState({
        customerId: '',
        profileImage: null,
        profileck: '',
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        province_id_fk: '',
        district_id_fk: '',
        customerVillage: '',
        customerType: 1,
        customerRemark: '',

    });
    const handleChange = (name, value) => {
        setInputs({
            ...inputs, [name]: value
        });
        if (name === 'province_id_fk') {
            setProvinceId(value)
        }
    }

    const [selectFile, setSelectFile] = useState(null);
    const handleFileChange = (e) => {
        const file = e.target.files[0]; // Get the selected file
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setInputs({
                    ...inputs,
                    profileImage: file, // Base64 string for preview
                });
                setSelectFile(event.target.result);
            };
            reader.readAsDataURL(file); // Convert the file to Base64
        }
    };

    const handleMove = () => {
        setSelectFile(null)
        setInputs({
            ...inputs, profileImage: null
        });
    }

    const handleSumit = async (event) => {
        event.preventDefault();
        const formData = new FormData();
        for (const key in inputs) {
            formData.append(key, inputs[key]);
        }
        try {
            const resp = await axios.post(`${api}customer/create`, formData);
            if (resp.status === 200) {
                Notification.success('ການບັນທຶກຂໍ້ມູນສຳເລັດ', 'ແຈ້ງເຕືອນ');
                handleClose();
            }
        } catch {
            Notification.error('ການບັນທຶກຂໍ້ມູນບໍ່ສຳເລັດ', 'ແຈ້ງເຕືອນ');
        }
    }
    useEffect(() => {
        if (data) {
            setInputs({
                ...inputs,
                customerId: data.customerId,
                profileck: data.profileImage,
                customerName: data.customerName,
                customerPhone: data.customerPhone,
                customerEmail: data.customerEmail,
                province_id_fk: data.province_id_fk,
                district_id_fk: data.district_id_fk,
                customerVillage: data.customerVillage,
                customerType: data.customerType,
                customerRemark: data.customerRemark,
            });
        }
    })
    return (
        <Modal size='md' open={open} onClose={handleClose}>
            <Modal.Header>
                <Modal.Title className='py-1 fs-blold'>ເພີ່ມຂໍ້ມູນລູກຄ້າ</Modal.Title>
            </Modal.Header>
            <form onSubmit={handleSumit}>
                <Modal.Body>
                    <Grid fluid>
                        <div className='text-center'>
                            <div className='w-150px w-xs-100px mx-auto con-tainer'>
                                <label className='cursor-pointer'>
                                    <img src={selectFile || './assets/img/icon/icon-user.jpg'} className='w-100 rounded-4' alt="" />
                                    <input type="file" onChange={e => handleFileChange(e)} className='d-none' />
                                </label>
                                {selectFile &&
                                    <span role='button' onClick={handleMove} className='top-right mt-1'><WarningRoundIcon color='red' className='fs-3' /></span>
                                }
                            </div>
                        </div>
                        <Row>
                            <Col xs={24} md={24} className='mb-2'>
                                <label htmlFor="" className='form-label fs-bold'>ຊື່ລູກຄ້າ</label>
                                <Input value={inputs.customerName} onChange={e => handleChange('customerName', e)} placeholder='ຊື່ລູກຄ້າ' required />
                            </Col>
                            <Col xs={24} md={12} className='mb-2'>
                                <label htmlFor="" className='form-label fs-bold'>ເບີໂທລູກຄ້າ</label>
                                <InputGroup inside>
                                    <InputGroup.Addon><PhoneFillIcon /></InputGroup.Addon>
                                    <Input type='tel' value={inputs.customerPhone} onChange={e => handleChange('customerPhone', e)} placeholder='020 9999 9999 ' required />
                                </InputGroup>
                            </Col>
                            <Col xs={24} md={12} className='mb-2'>
                                <label htmlFor="" className='form-label fs-bold'>Email</label>
                                <InputGroup inside>
                                    <InputGroup.Addon><EmailFillIcon /></InputGroup.Addon>
                                    <Input value={inputs.customerEmail} onChange={e => handleChange('customerEmail', e)} placeholder='****@gmail.com' />
                                </InputGroup>
                            </Col>
                            <Col xs={24} md={12} className='mb-2'>
                                <label htmlFor="" className='form-label fs-bold'>ແຂວງ</label>
                                <SelectPicker data={province} value={inputs.province_id_fk} onChange={e => handleChange('province_id_fk', e)} placeholder='ເລືອກແຂວງ' block required />
                            </Col>
                            <Col xs={24} md={12} className='mb-2'>
                                <label htmlFor="" className='form-label fs-bold'>ເມື່ອງ</label>
                                <SelectPicker data={district} value={inputs.district_id_fk} onChange={e => handleChange('district_id_fk', e)} placeholder='ເລືອກເມື່ອງ' block required />
                            </Col>

                            <Col xs={24} md={12} className='mb-2'>
                                <label htmlFor="" className='form-label fs-bold'>ບ້ານ</label>
                                <Input value={inputs.customerVillage} onChange={e => handleChange('customerVillage', e)} placeholder='ບ້ານ ...' block required />
                            </Col>
                            <Col xs={24} md={12} className='mb-2'>
                                <label htmlFor="" className='form-label fs-bold'>ປະເພດ</label>
                                <InputPicker data={[{ label: 'ລູກຄ້າໃຊ້ບໍລິການ', value: 1 }, { label: 'ລູກຄ້າກຳລັງພັດທະນາ', value: 2 }, { label: 'ລູກຄ້າກມຸງວັງ', value: 3 }]} value={inputs.customerType} onChange={e => handleChange('customerType', e)} placeholder='ປະເພດ' block />
                            </Col>
                            <Col xs={24} md={24} className='mb-2'>
                                <label htmlFor="" className='form-label fs-bold'>ໝາຍເຫດ</label>
                                <Input as={'TextArea'} value={inputs.customerRemark} onChange={e => handleChange('customerRemark', e)} placeholder='ໝາຍເຫດ...' block />
                            </Col>
                        </Row>
                    </Grid>
                </Modal.Body>
                <Modal.Footer>
                    <Button type='submit' appearance='primary' onClick={handleClose}>ບັນທຶກ</Button>
                    <Button onClick={handleClose} appearance='primary' color='red'>ຍົກເລີກ</Button>
                </Modal.Footer>
            </form>
        </Modal>
    )
}

export default FormAddCutstomer