import React, { useEffect, useState } from 'react'
import { Modal, Input, SelectPicker, InputGroup, Button, Grid, Row, Col, InputNumber } from 'rsuite';
import { useType, useCurrency, useTypeList, useBank } from '../../config/selectOption';
import { Config } from '../../config/connection';
import { Notification } from '../../utils/Notification';
import axios from 'axios';
import { use } from 'react';
function FormAddAcount({ open, handleClose, data, fetchData }) {
  const api = Config.API;
  const userId=localStorage.getItem('userid');
  const itemType = useType();
  const itemCurrency = useCurrency();
  const itemBank = useBank();

  const [idType, setIdType] = useState(null);
  const itemTypelist = useTypeList(idType);
  const showTypeList = (value) => {
    setIdType(value);
    if (value === 240001) {
      setInputs({
        ...inputs, bank_id_fk: '',
      })
    }
  }
  const [inputs, setInputs] = useState({
    treasuryId: '',
    typeId_fk: '',
    type_acount_id_fk: '',
    acountName: '',
    acount_number: '',
    bank_id_fk: '',
    balance_treasury: '0',
    balance_unable: '0',
    status_use: 1,
    userId: userId
  })

  const [genus, setGenus] = useState('₭')

  const handleChange = (name, values) => {
    setInputs({
      ...inputs, [name]: values
    })

    if(name==='type_acount_id_fk'){
      const data = itemTypelist.find(item => item.value === values);
      setGenus(data.genus)
    }
  }

  const handleUse = (e) => {
    setInputs((prevState) => ({
      ...prevState,
      status_use: prevState.status_use === 1 ? 2 : 1, 
    }));
  };

  const handleSumit = async (event) => {
    event.preventDefault();
    try {
      const resp = await axios.post(api + 'acounts/create', inputs);
      if (resp.status === 200) {
        fetchData();
        handleClose();
        Notification.success('ການດຳເນີນງານສຳເລັດແລ້ວ', 'ແຈ້ງເຕືອນ');
      }
    } catch (error) {
      // console.error('Error fetching data:', error);
      Notification.error('ການດຳເນີນງານບໍ່ສຳເລັດ', 'ແຈ້ງເຕືອນ')
    }
  }

  function toThousands(value) {
    return value ? `${value}`.replace(/\d{1,3}(?=(\d{3})+(\.\d*)?$)/g, '$&,') : value;
  }
useEffect(() => {
  if (data !=='') {
    setInputs({
      ...inputs,
      treasuryId: data.treasury_id,
      typeId_fk: data.typeId_fk,
      type_acount_id_fk: data.type_treasury_id,
      acountName: data.acountName,
      acount_number: data.acount_number,
      bank_id_fk: data.bank_id_fk,
      balance_treasury: data.balance_treasury,
      balance_unable: data.balance_unable,
      userId: userId,
      status_use: data.status_use
    });
    setIdType(data.typeId_fk);
  }
}, [data,userId])

  return (
    <Modal backdrop="static" role="alertdialog" open={open} onClose={handleClose} size={'lg'}>
      <Modal.Header>
        <Modal.Title className='py-2'>ຟອມເພີ່ມບິນຊີເງິນຄັງ</Modal.Title>
      </Modal.Header>
      <form onSubmit={handleSumit}>
        <Modal.Body>
          <Grid fluid>
            <Row>
              <Col xs={10}>
                <div className="from-group">
                  <label htmlFor="" className='form-label fs-bold'>ປະເພດບັນຊີ</label>
                  <SelectPicker data={itemType} value={inputs.typeId_fk} onChange={(e) => showTypeList(e)} placeholder='ປະເພດບັນຊີ' block />
                </div>
              </Col>
              <Col xs={14}>
                <div className="from-group">
                  <label htmlFor="" className='form-label fs-bold'>ຊື່ບັນຊີ</label>
                  <SelectPicker data={itemTypelist} value={inputs.type_acount_id_fk} onChange={(e) => handleChange('type_acount_id_fk', e)} placeholder='ຊື່ບັນຊີ' block />
                </div>
              </Col>
              <Col xs={12} className='mt-2'>
                <div className="from-group">
                  <label htmlFor="" className='form-label fs-bold'>ຊື່ບັນຊີ</label>
                  <Input placeholder='ຊື່ບັນຊີ...' value={inputs.acountName} onChange={(e) => handleChange('acountName', e)} block required />
                </div>
              </Col>
              <Col xs={12} className='mt-2'>
                <div className="from-group">
                  <label htmlFor="" className='form-label fs-bold'>ເລກບັນຊີ</label>
                  <Input placeholder='XXX-XXXX-XXXXX' value={inputs.acount_number} onChange={(e) => handleChange('acount_number', e)} block required />
                </div>
              </Col>
              
              <Col xs={8} className='mt-2'>
                <div className="from-group ">
                  <label htmlFor="" className='form-label fs-bold'>ຍອດເງິນທີ່ໃຊ້ໄດ້</label>
                  <InputGroup inside >
                    <InputGroup.Addon>{genus}</InputGroup.Addon>
                    <InputNumber placeholder='0,00' formatter={toThousands} value={inputs.balance_treasury} onChange={(e) => handleChange('balance_treasury', e)} className='fs-bold' required />
                  </InputGroup>
                </div>
              </Col>
              <Col xs={8} className='mt-2'>
                <div className="from-group ">
                  <label htmlFor="" className='form-label fs-bold text-red'>ຍອດເງິນທີ່ໃຊ້ບໍ່ໄດ້</label>
                  <InputGroup inside >
                    <InputGroup.Addon>{genus}</InputGroup.Addon>
                    <InputNumber placeholder='0,00' formatter={toThousands} value={inputs.balance_unable} onChange={(e) => handleChange('balance_unable', e)} className='fs-bold' required />
                  </InputGroup>
                </div>
              </Col>
              <Col xs={8} className='mt-2'>
                <div className="from-group">
                  <label htmlFor="" className='form-label fs-bold'>ທະນາຄານ</label>
                  <SelectPicker data={itemBank} value={inputs.bank_id_fk} onChange={(e) => handleChange('bank_id_fk', e)} placeholder='ເລືອກທະນາຄານ' readOnly={idType === 240002 ? false : true} block />
                </div>
              </Col>

              <Col xs={24} className='mt-4'>
              <div class="form-check form-switch mb-2">
											<input class="form-check-input form-check-input-xs" type="checkbox" 
                      checked={inputs.status_use === 1 ? true : false}
                      onChange={handleUse} id="sts" />
											<label class="form-check-label" for="sts">{inputs.status_use === 2 ? 'ປິດການໃຊ້ງານບັນຊີ' : 'ເປີດການໃຊ້ງານບັນຊີ'}  {inputs.status_use}</label>
										</div></Col>
            </Row>
          </Grid>
        </Modal.Body>
        <Modal.Footer>
          <Button type='submit' appearance="primary"> ບັນທຶກ </Button>
          <Button onClick={handleClose} appearance="primary" color='red'> ຍົກເລີກ</Button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}

export default FormAddAcount