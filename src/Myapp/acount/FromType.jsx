import React, { useEffect, useState } from 'react'
import { Modal, Button, SelectPicker, Input } from 'rsuite';
import { useType,useCurrency } from '../../config/selectOption';
import { Config } from '../../config/connection';
import axios from 'axios';
import { Notification } from '../../utils/Notification';
function FromType({ open, handleClose, data,fetchData }) {
    const api = Config.API;
    const itemType = useType();
    const itemCurrency = useCurrency();
    const [inputs, setInputs] = useState({
        type_listId: '',
        typeId_fk: '',
        type_codelist: '',
        acount_name: '',
        currency_id_fk: ''
    });

    const handleChange = (name, values) => {
        if (name === 'typeId_fk') {
            const data = itemType.find(item => item.value === values);
            setInputs({
                ...inputs, type_codelist: data.codes,
                typeId_fk:values
            })
        } else {
            setInputs({
                ...inputs, [name]: values
            })
        }
    }
    const handleSumit = async (event) => {
        event.preventDefault();
        try {
            const resp = await axios.post(api + 'type/create', inputs);
            if (resp.status === 200) {
                fetchData();
                handleClose();
                Notification.success('ການດຳເນີນງານສຳເລັດແລ້ວ','ແຈ້ງເຕືອນ');
                setInputs({
                    type_listId:'',
                    typeId_fk: '',
                    type_codelist: '',
                    acount_name: '',
                    currency_id_fk: ''
                })
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            Notification.error(error,'ແຈ້ງເຕືອນ')
        }
    }

    useEffect(()=>{
        if(data){
            setInputs({
                type_listId: data.type_treasury_id,
                typeId_fk: data.type_acount_id,
                type_codelist: data.treasury_code,
                acount_name: data.acount_name,
                currency_id_fk: data.currency_id_fk
            })
        }else{
            setInputs({
                type_listId: '',
                typeId_fk: '',
                type_codelist: '',
                acount_name: '',
                currency_id_fk: ''
            })
        }
    },[data])
    return (
        <Modal open={open} onClose={handleClose}>
            <Modal.Header>
                <Modal.Title className='py-1'>ປະເພດບັນຊີ</Modal.Title>
            </Modal.Header>
            <form onSubmit={handleSumit}>
                <Modal.Body>
                    <div className="row">
                        <div className="form-group col-sm-7 mb-2">
                            <label htmlFor="" className='form-label'>ໝວດບັນຊີ</label>
                            <SelectPicker data={itemType} value={inputs.typeId_fk} onChange={(e) => handleChange('typeId_fk', e)} block placeholder='ໝວດບັນຊີ' required />
                        </div>
                        <div className="form-group col-sm-5 mb-2">
                            <label htmlFor="" className='form-label'>ສະກຸນເງິນ</label>
                            <SelectPicker data={itemCurrency} value={inputs.currency_id_fk} onChange={(e) => handleChange('currency_id_fk', e)} block placeholder='ສະກຸນເງິນ' required />
                        </div>
                        <div className="form-group col-sm-4 mb-2">
                            <label htmlFor="" className='form-label'>ລະຫັດບັນຊີ</label>
                            <Input value={inputs.type_codelist} onChange={(e) => handleChange('type_codelist', e)} block placeholder='ລະຫັດບັນຊີ' readOnly />
                        </div>
                        <div className="form-group col-sm-8 mb-2">
                            <label htmlFor="" className='form-label'>ຊື່ປະເພດ</label>
                            <Input value={inputs.acount_name} onChange={(e) => handleChange('acount_name', e)} block placeholder='ຊື່ປະເພດ' required />
                        </div>
                       
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button type='submit' appearance="primary"> ບັນທຶກ </Button>
                    <Button onClick={handleClose} color='red' appearance="primary"> ຍົກເລີກ</Button>
                </Modal.Footer>
            </form>
        </Modal>
    )
}

export default FromType