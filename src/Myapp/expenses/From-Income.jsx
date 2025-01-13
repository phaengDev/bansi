import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Input, SelectPicker, Grid, Row, Col, DatePicker, InputPicker, Message, Loader, InputGroup, Button } from 'rsuite';
import numeral from 'numeral';
import { useType, useTypeInXep, useAcount } from '../../config/selectOption';
import { Config } from '../../config/connection';
import axios from 'axios';
import { Notification } from '../../utils/Notification';
import { set } from 'lodash';
function FromIncome() {
    const api = Config.API;

    const { id } = useParams();

    const inserts = localStorage.getItem('inserts');
    const userId = localStorage.getItem('userid');
    const itemTypein = useTypeInXep(240001);
    const itemType = useType();
    const navigate = useNavigate();
    const handleBack = () => {
        navigate(-1)
    }

    const [idType, setIdType] = useState(null)
    const itemAcount = useAcount(idType)
 
    const [inputs, setInputs] = useState({
        incom_uuid: '',
        type_incom_fk: '',
        acount_id_fk: '',
        incom_title: '',
        balance_total: 0,
        tax: 0,
        balance_tax: 0,
        balance_incom: 0,
        description: '',
        date_incom: new Date(),
        user_byid: userId,
        file_incom: null,
        type_id_fk: '',
        feile_check: ''
    });

    const handleShowAcount = (value) => {
        setIdType(value)
        setInputs({
            ...inputs,
            type_id_fk: value
        })
    }

    const [genus, setGenus] = useState('₭');
    const selectAcount = (name, value) => {
        const data = itemAcount.find(item => item.value === value);
        if (data) {
            setGenus(data.genus)
        }
        setInputs({
            ...inputs, [name]: value
        })
    }


    const handleChange = (name, value) => {
        if (name === 'balance_total') {
            let cleanedValue = value.replace(/[^0-9.]/g, '');
            if (cleanedValue.includes('.')) {
                const [integerPart, decimalPart] = cleanedValue.split('.');
                cleanedValue = `${integerPart}.${decimalPart.slice(0, 2)}`; // Limit to 2 decimal places
            }
            // Calculate the balance based on the current tax rate
            const parsedBalance = parseFloat(cleanedValue) || 0;
            const taxAmount = (parsedBalance * inputs.tax) / 100; // Calculate tax based on the current percentage
            const totalBalance = parsedBalance - taxAmount;

            setInputs({
                ...inputs,
                balance_total: cleanedValue,
                balance_tax: numeral(taxAmount).format('0,0.00'),
                balance_incom: numeral(totalBalance).format('0,0.00'),
            });
        } else if (name === 'tax') {
            // Update the tax percentage and recalculate balance
            const taxPercentage = parseFloat(value) || 0;
            const parsedBalance = parseFloat(inputs.balance_total.replace(/,/g, '')) || 0;
            const taxAmount = (parsedBalance * taxPercentage) / 100;
            const totalBalance = parsedBalance - taxAmount;
            setInputs({
                ...inputs,
                tax: taxPercentage,
                balance_tax: numeral(taxAmount).format('0,0.00'),
                balance_incom: numeral(totalBalance).format('0,0.00'),
            });
        } else {
            // Generic change handler for other input fields
            setInputs({
                ...inputs,
                [name]: value,
            });
        }
    };

    const handleBlur = () => {
        const rawValue = inputs.balance_total;
        if (rawValue) {
            const formattedValue = numeral(parseFloat(rawValue)).format('0,0.00');
            const parsedBalance = parseFloat(formattedValue.replace(/,/g, '')) || 0;
            const taxAmount = (parsedBalance * inputs.tax) / 100;
            const totalBalance = parsedBalance - taxAmount;

            setInputs({
                ...inputs,
                balance_total: formattedValue,
                balance_tax: numeral(taxAmount).format('0,0.00'),
                balance_incom: numeral(totalBalance).format('0,0.00'),
            });
        }
    };


    const [checked, setChecked] = useState(false);
    const handleChecked = () => {
        setChecked(!checked);
        if (checked) {

            setInputs({
                ...inputs, tax: 0,
                balance_tax: 0,
            })
        }
    }
const [selectFile, setSelectFile] = useState(null);
    const handleFileChange = (fileList) => {
        setSelectFile(fileList.name)
        setInputs({
            ...inputs,
           file_incom: fileList // Update fileList with the uploaded files
        });
    };
    const [loading, setLoading] = useState(false);
    const handleSubmit = async (event) => {
        event.preventDefault();
        const formData = new FormData();
        for (const key in inputs) {
            formData.append(key, inputs[key]);
        }
        const totalBalance = parseFloat(inputs.balance_total.replace(/,/g, '')) || 0;
    if(totalBalance > 0){
        setLoading(true)
        try {
           const resp = await axios.post(`${api}incom/create`, formData);
            if (resp.status === 200) {
                Notification.success('ການລຶບຂໍ້ມູນສຳເລັດ', 'ແຈ້ງເຕືອນ');
                navigate('/incom')
            }
        } catch (error) {
            Notification.error('ບັນທຶກຂໍ້ມູນລາຍຮັບຜິດພາດ','ຜິດພາດ');
            console.error(error);
        }
        finally {
            setLoading(false)
        }
    }else{
        Notification.warning('ກະລຸນາປ້ອນຍອດລາຍຮັບກອນ','ແຈ້ງເຕືອນ', );
    }
    }
    

    const closable = () => {
        setSelectFile(null);
        setInputs({
            ...inputs,
           file_incom: null // Update fileList with the uploaded files
        });
    }

    useEffect(() => {
        if (inserts === '2') {
            navigate('/incom')
        }
if(id){ 
    const fetchData = async () => {
        try {
            const response = await axios.get(api + 'incom/single/' + id);
            const data = await response.data;
            setInputs({
                ...inputs,
                incom_uuid: data.incom_uuid,
                type_incom_fk: data.type_incom_fk,
                acount_id_fk: data.acount_id_fk,
                incom_title: data.incom_title,
                balance_total: data.balance_total,
                tax: data.tax,
                balance_tax: data.balance_tax,
                balance_incom: data.balance_incom,
                description: data.description,
                date_incom: new Date(data.date_incom),
                user_byid: userId,
                file_incom: null,
                feile_check: data.file_incom,
                type_id_fk: data.typeId_fk
            });
            setIdType(data.typeId_fk)
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };
    fetchData();
}

    }, [inserts, userId,id]);
    return (
        <div id="content" class="app-content p-3 bg-component">
            <ol class="breadcrumb float-end">
                <li class="breadcrumb-item"><Link to={'/'}>ໜ້າຫຼັກ</Link></li>
                <li class="breadcrumb-item"><a href='javascript:;' onClick={handleBack} >ລາຍການລາຍຮັບ</a></li>
                <li class="breadcrumb-item active">ຟອມລົງບັນທຶກລາຍຮັບ</li>
            </ol>
            <h1 class="page-header"><Link to={'/incom'}><i class="fa-solid fa-circle-arrow-left fs-3 text-red" /> </Link> ຟອມລົງບັນທຶກລາຍຮັບ </h1>
          <form onSubmit={handleSubmit}>
            <div className="row px-4">
                <div className="col-12">
                    <Grid fluid>
                        <Row>
                            <Col xs={24} className='mb-2'>
                                <label htmlFor="" className='form-label fs-bold'>ຫົວຂໍ້ລາຍຮັບ</label>
                                <Input placeholder='ຫົວຂໍ້ລາຍຮັບ' value={inputs.incom_title} onChange={(e) => handleChange('incom_title', e)} required />
                            </Col>
                            <Col xs={12} className='mb-2'>
                                <label htmlFor="" className='form-label fs-bold'>ວັນທີ່ຮັບ</label>
                                <DatePicker oneTap format='dd/MM/yyyy' value={inputs.date_incom} onChange={(e) => handleChange('date_incom', e)} placeholder='ວັນທີ່ຮັບ' block />
                            </Col>
                            <Col xs={12} className='mb-2'>
                                <label htmlFor="" className='form-label fs-bold'>ປະເພດລາຍຮັບ </label>
                                <SelectPicker data={itemTypein} value={inputs.type_incom_fk} onChange={(e) => handleChange('type_incom_fk', e)} placeholder='ປະເພດລາຍຮັບ' block required />
                            </Col>
                            <Col xs={12} className='mb-2'>
                                <label htmlFor="" className='form-label fs-bold'>ຈຳນວນເງິນ</label>
                                <input class="border-0 w-100 fs-35px" type="tel" value={genus + ' ' + inputs.balance_total} onChange={(e) => handleChange('balance_total', e.target.value)}
                                    onBlur={handleBlur}
                                    autocomplete="off" sautoComplete="off"
                                    style={{ outline: 'none' }} placeholder="00,000" />
                            </Col>
                            <Col xs={5} className='mb-2'>
                                <label htmlFor="" className='form-label fs-bold'>ປະເພດບັນຊີ  {inputs.type_id_fk}</label>
                                <InputPicker data={itemType} value={inputs.type_id_fk} onChange={(e) => handleShowAcount(e)} block />
                            </Col>
                            <Col xs={7} className='mb-2'>
                                <label htmlFor="" className='form-label fs-bold'>ບັນຊີເງິນຄັງ</label>
                                <SelectPicker data={itemAcount} value={inputs.acount_id_fk} onChange={(e) => selectAcount('acount_id_fk', e)} block required />
                            </Col>
                        </Row>

                        <Row>
                            <Col xs={24} className='mb-2 mt-2'>
                                <div class="panel panel-default" data-sortable-id="ui-widget-11">
                                    <div class="panel-heading ui-sortable-handle">
                                        <h4 class="panel-title fs-18px">ລາຍລະອຽດເພີ່ມເຕີມ</h4>
                                        <div class="panel-heading-btn ">
                                            <div class="form-check form-switch">
                                                <input class="form-check-input" type="checkbox" onChange={handleChecked} id="default" name='' checked={checked} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`panel-body ${!checked && 'd-none'}`}>
                                        <Row>
                                            <Col xs={12} lg={6} xl={6} className='mb-2'>
                                                <label htmlFor="" className='form-label'>ອາກອນມູນຄ່າເພີ່ມ</label>
                                                <InputGroup inside>
                                                    <InputGroup.Addon>%</InputGroup.Addon>
                                                    <Input type='number' value={inputs.tax} onChange={(e) => handleChange('tax', e)} placeholder='ອາກອນ' />
                                                </InputGroup>
                                            </Col>
                                            <Col xs={12} lg={6} xl={6} className='mb-2'>
                                                <label htmlFor="" className='form-label'>ຍອດເງິນ</label>
                                                <InputGroup inside>
                                                    <InputGroup.Addon>{genus}</InputGroup.Addon>
                                                    <Input placeholder='0,00' value={inputs.balance_tax} readOnly block />
                                                </InputGroup>
                                            </Col>
                                            <Col xs={24} lg={12} xl={12} className='mb-2'>
                                                <label htmlFor="" className='form-label'>ຍອດຮັບຕົວຈີງ</label>
                                                <InputGroup inside className='bg-dark'>
                                                    <InputGroup.Addon className=' text-white fs-5'>{genus}</InputGroup.Addon>
                                                    <Input placeholder='0,00' value={inputs.balance_incom} className='bg-dark text-white fs-4' readOnly block />
                                                </InputGroup>
                                            </Col>
                                        </Row>
                                    </div>

                                </div>
                            </Col>

                        </Row>

                        <Row>
                            <Col xs={24} className='mb-2'>
                                <label htmlFor="" className='form-label'>ລາຍລະອຽດ</label>
                                <Input as='textarea' value={inputs.description} onChange={(e) => handleChange('description', e)} placeholder='ລາຍລະອຽດ.....' />
                            </Col>
                            <Col xs={23} lg={12} className='mb-2 '>
                                <label htmlFor="" className='form-label me-2'>ເອກະສານ :</label>
                                <label className='btn btn-primary'>
                                    <input type="file" className='d-none' onChange={(e) => handleFileChange(e.target.files[0])} />
                                    <span><i class="fa-solid fa-paperclip me-2"></i>ເລືອກເອກະສານ</span>
                                </label>
                                {selectFile &&  (
                                <Message  closable onClick={closable} type="info"  className='mt-2'>
                                <strong><i class="fa-solid fa-paperclip"></i>:</strong> {selectFile}
                                </Message>
                                )}
                            </Col>
                        </Row>
                    </Grid>
                </div>
                <div className="col-6">
                    <Button color='red' appearance="primary" onClick={''} block>ຍົກເລີກ</Button>
                </div>
                <div className="col-6">
                <Button color='blue' type='submit' appearance="primary" disabled={loading} block>{loading ? (<Loader content="ກຳລັງດຳເນີນງານ..." />) : 'ບັນທຶກ'}</Button>
                </div>
            </div>
            </form>
        </div>
    )
}

export default FromIncome