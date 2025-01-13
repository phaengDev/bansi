import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom';
import { Input, SelectPicker, Grid, Row, Col, DatePicker, InputPicker, Accordion, Uploader, InputGroup, Button } from 'rsuite';
import numeral from 'numeral';
import { useType, useTypeInXep, useAcount } from '../../config/selectOption';
import { Config } from '../../config/connection';
import axios from 'axios';
import { Notification } from '../../utils/Notification';
function FromExpenditure() {
    const api = Config.API
    const itemType = useType();
    const navigate = useNavigate();
    const handleBack = () => {
        navigate(-1)
    }
    const userId = localStorage.getItem('userid')

    const itemExpenditure = useTypeInXep(240002)

    const [idType, setIdType] = useState(null)
    const itemAcount = useAcount(idType);
    const [stskam, setStskam] = useState(1)
    const handleShowAcount = (values) => {
        setIdType(values)
        const data = itemType.find(item => item.value === values);
        setStskam(data.status_type)
        setInputs({
            ...inputs,
            status_pays: 1
        });
        setChecked(false)
    }

    const [inputs, setInputs] = useState({
        expenditure_name: '',
        type_expenditure_fk: '',
        treasury_id_fk: '',
        balance_total: '0',
        balance_discount: '0',
        balance_tax: '0',
        balance_pays: '0',
        expenditure_date: new Date(),
        description: '',
        file_doc: null,
        user_create: '',
        status_pays: '1',
        detailPays: []
    })


    const handleChange = (name, value) => {
        setInputs({
            ...inputs, [name]: value
        })
    }



    const [rows, setRows] = useState([]);
    const handleAddRow = () => {
        const newRow = { id: rows.length, item: '', quantity: '', price: '', discount: '', tax: '', total: '' };
        setRows([...rows, newRow]);
    };

    const handleDeleteRow = (id) => {
        const updatedRows = rows.filter((row) => row.id !== id);
        setRows(updatedRows);
    };

    const handleInputChange = (value, id, field) => {
        setRows((prevRows) =>
            prevRows.map((row) => {
                if (row.id === id) {
                    const updatedRow = { ...row, [field]: value };

                    if (field === "tax") {
                        updatedRow.tax = Math.min(parseFloat(value) || 0, 10);
                    }

                    if (field === "quantity") {
                        updatedRow.quantity = Math.min(parseFloat(value) || 0);
                    }
                    // Convert all fields to numbers for calculation
                    const quantity = parseFloat(updatedRow.quantity) || 0;
                    const price = parseFloat(updatedRow.price) || 0;
                    const discount = parseFloat(updatedRow.discount) || 0;
                    const tax = parseFloat(updatedRow.tax) || 0;

                    // Calculate the total
                    updatedRow.total = quantity * price - discount + ((quantity * price - discount) * tax / 100);

                    return updatedRow;
                }
                return row;
            })
        );
    };
    const totalPrice = rows.reduce((sum, row) => sum + (parseFloat(row.price) || 0) * (parseFloat(row.quantity) || 0), 0);
    const totalDiscount = rows.reduce((sum, row) => sum + (parseFloat(row.discount) || 0), 0);
    const totalBalancetax = rows.reduce((sum, row) => {
        const priceAfterDiscount = (parseFloat(row.price) || 0) * (parseFloat(row.quantity) || 0) - (parseFloat(row.discount) || 0);
        return sum + ((priceAfterDiscount * (parseFloat(row.tax) || 0)) / 100);
    }, 0);
    const totalAmount = rows.reduce((sum, row) => sum + (parseFloat(row.total) || 0), 0);




    const handleSubmit = async (event) => {
        event.preventDefault();
        const formData = new FormData();
        for (const key in inputs) {
            if (key !== 'detailPays') {
                formData.append(key, inputs[key]);
            }
        }
        formData.append('detailPays', JSON.stringify(inputs.detailPays));
        try {
            const response = await axios.post(api + 'expenditure/create', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data', // Set header for FormData
                },
            });
            
            if (response.status === 200) {
                Notification.success('ການລຶບຂໍ້ມູນສຳເລັດ', 'ແຈ້ງເຕືອນ');
                navigate('/cost');
            }
        } catch (error) {
            Notification.error('ການລຶບຂໍ້ມູນບໍ່ສຳເລັດ', 'ແຈ້ງເຕືອນ');
            console.error('Error inserting data:', error);
        }
    }


    const [selectFile, setSelectFile] = useState(null)
    const handleFileChange = (fileList) => {
        setSelectFile(fileList)
        setInputs({
            ...inputs, file_doc: fileList
        })
    };
    const handleMove = () => {
        setSelectFile(null)
        setInputs({
            ...inputs, file_doc: null
        })
    }

    const [checked, setChecked] = useState(false)
    const handleCheckboxChange = () => {
        setChecked(!checked);
        setInputs({
            ...inputs, status_pays: !checked ? '2' : '1'
        })

    }

    useEffect(() => {
        setInputs({
            ...inputs,
            detailPays: rows,
            user_create: userId,
            balance_total: totalPrice,
            balance_discount: totalDiscount,
            balance_tax: totalBalancetax,
            balance_pays: totalAmount
        })

    }, [userId, rows, totalAmount, totalBalancetax, totalDiscount, totalPrice])

    return (
        <div id="content" class="app-content p-0 bg-component">
            <div class="app-content-padding py-3">
                <ol class="breadcrumb float-end ">
                    <li class="breadcrumb-item"><Link to={'/'}>ໜ້າຫຼັກ</Link></li>
                    <li class="breadcrumb-item"><a href='javascript:;' onClick={handleBack} >ລາຍການລາຍຈ່າຍ</a></li>
                    <li class="breadcrumb-item active">ຟອມລົງບັນທຶກລາຍຈ່າຍ</li>
                </ol>
                <h1 class="page-header"><Link to={'/cost'}><i class="fa-solid fa-circle-arrow-left fs-3 text-red" /> </Link> ຟອມລົງບັນທຶກລາຍຈ່າຍ </h1>
                <div class="panel panel-inverse p-0">
                    <div class="panel-body p-0">
                        <form onSubmit={handleSubmit}>
                            <Grid fluid>
                                <Row>
                                    <Col xs={24} className='mb-2'>
                                        <label htmlFor="" className='form-label fs-bold'>ຫົວຂໍ້ລາຍຈ່າຍ</label>
                                        <Input value={inputs.expenditure_name} onChange={(e) => handleChange('expenditure_name', e)} placeholder='ຫົວຂໍ້ລາຍຈ່າຍ' required />
                                    </Col>
                                    <Col xs={12} className='mb-2'>
                                        <label htmlFor="" className='form-label fs-bold'>ວັນທີ່ຈ່າຍ</label>
                                        <DatePicker oneTap format='dd/MM/yyyy' value={inputs.expenditure_date} onChange={(e) => handleChange('expenditure_date', e)} placeholder='ວັນທີ່ຈ່າຍ' block />
                                    </Col>
                                    <Col xs={12} className='mb-2'>
                                        <label htmlFor="" className='form-label fs-bold'>ປະເພດລາຍຈ່າຍ</label>
                                        <SelectPicker data={itemExpenditure} value={inputs.type_expenditure_fk} onChange={(e) => handleChange('type_expenditure_fk', e)} placeholder='ປະເພດລາຍຈ່າຍ' block />
                                    </Col>
                                    <Col xs={12} className='mb-2'>
                                        <label htmlFor="" className='form-label fs-bold'>ຈຳນວນເງິນ</label>
                                        <input class="border-0 w-100 fs-35px" value={numeral(inputs.balance_pays).format('0,00')} onChange={(e) => handleChange('balance_pays', e.target.value)} autocomplete="off" sautoComplete="off"
                                            style={{ outline: 'none' }} placeholder="0,000" />
                                    </Col>
                                    <Col xs={5} className='mb-2'>
                                        <label htmlFor="" className='form-label fs-bold'>ປະເພດບັນຊີ</label>
                                        <InputPicker data={itemType} onChange={(e) => handleShowAcount(e)} block />
                                    </Col>
                                    <Col xs={7} className='mb-2'>
                                        <label htmlFor="" className='form-label fs-bold'>ບັນຊີເງິນຄັງ</label>
                                        <SelectPicker data={itemAcount} value={inputs.treasury_id_fk} onChange={(e) => handleChange('treasury_id_fk', e)} block />
                                    </Col>
                                </Row>

                                <Row>
                                    <Col xl={24}>

                                        <div class="accordion" >
                                            <div class="accordion-item border-0">
                                                <div class="accordion-header">
                                                    <span class="accordion-button bg-white px-3 py-10px pointer-cursor fs-5" type="button" data-bs-toggle="collapse" data-bs-target="#collapseOne">
                                                        <i class="fa fa-plus fa-fw text-blue me-2 fs-5" /> ເພີ່ມລາຍລະອຽດ...
                                                    </span>
                                                </div>
                                                <div id="collapseOne" class="accordion-collapse bg-white collapse " data-bs-parent="#accordion">
                                                    <div class="accordion-body p-0 ">
                                                        <div class="table-responsive mt-2">
                                                            <table class="table table-sm">
                                                                <thead>
                                                                    <tr>
                                                                        <th className='text-center w-1'>#</th>
                                                                        <th className='w-39'>ລາຍການ</th>
                                                                        <th className='w-10 text-center'>ຈຳນວນ</th>
                                                                        <th className='w-15 text-end'>ລາຄາ</th>
                                                                        <th className='w-10 text-end'>ສວນຫຼຸດ</th>
                                                                        <th className='w-10 text-end'>ອາກອນ</th>
                                                                        <th className='w-15 text-end'>ເປັນເງິນ</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {
                                                                        rows.length > 0 && (
                                                                            <>
                                                                                {rows.map((row, index) => (
                                                                                    <tr key={row.id}>
                                                                                        <td className='text-center'><button type='button' onClick={() => handleDeleteRow(row.id)} className='btn btn-xs btn-red'><i class="fa-solid fa-trash" /></button></td>
                                                                                        <td><Input size='sm' value={row.item} onChange={(e) => handleInputChange(e, row.id, 'item')} placeholder='ລາຍການ' /> </td>
                                                                                        <td><Input size='sm' value={row.quantity || 0} onChange={(e) => handleInputChange(e, row.id, 'quantity')} placeholder='ຈຳນວນ' /> </td>
                                                                                        <td><Input size='sm' value={row.price || 0} onChange={(e) => handleInputChange(e, row.id, 'price')} className='text-end' placeholder='ລາຄາ' /></td>
                                                                                        <td><Input size='sm' value={row.discount || 0} onChange={(e) => handleInputChange(e, row.id, 'discount')} className='text-end' placeholder='ສ່ວນຫຼຸດ' /></td>
                                                                                        <td>
                                                                                            <InputGroup inside size='sm'>
                                                                                                <Input value={row.tax || 0} onChange={(e) => handleInputChange(e, row.id, 'tax')} className='text-end' placeholder='ອາກອນ' />
                                                                                                <InputGroup.Addon>%</InputGroup.Addon>
                                                                                            </InputGroup>
                                                                                        </td>
                                                                                        <td><Input size='sm' value={numeral(row.total || 0).format('0,00.00')} onChange={(e) => handleInputChange(e, row.id, 'total')} placeholder='ເປັນເງິນ' className='text-end' readOnly /></td>
                                                                                    </tr>
                                                                                ))}
                                                                                <tr>
                                                                                    <td colSpan={3} className='text-end'>ລວມຍອດທັງໝົດ</td>
                                                                                    <td className="text-end fs-bold">{numeral(totalPrice).format('0,0.00')}</td>
                                                                                    <td className="text-end fs-bold">{numeral(totalDiscount).format('0,0.00')}</td>
                                                                                    <td className="text-end fs-bold">{numeral(totalBalancetax).format('0,0.00')}</td>
                                                                                    <td className="text-end fs-bold">{numeral(totalAmount).format('0,0.00')}</td>
                                                                                </tr>
                                                                            </>
                                                                        )}
                                                                    <tr>
                                                                        <td><button type='button' onClick={handleAddRow} className='btn btn-xs btn-green'><i class="fa-solid fa-square-plus" /></button></td>
                                                                        <td colSpan={6} className='text-center'> ເພີ່ມລາຍການທີ່ໄດ້ຈ່າຍ ....... </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Col>

                                    <Col xs={24} className='mb-2 '>
                                        <label htmlFor="" className='form-label'>ລາຍລະອຽດ</label>
                                        <Input as='textarea' value={inputs.description} onChange={(e) => handleChange('description', e)} placeholder='ລາຍລະອຽດ.....' />
                                    </Col>
                                    <Col xs={12} className='mb-2 mt-2'>
                                        {stskam === 2 &&
                                            <div class="form-check">
                                                <input class="form-check-input" type="checkbox" id="checkbox" onChange={(e) => handleCheckboxChange(e.target.checked)} checked={checked} />
                                                <label class="form-check-label" for="checkbox"> ຍອດໄດ້ມີການເຄມຄືນແລ້ວບໍ່?</label>
                                            </div>
                                        }
                                    </Col>
                                    <Col xs={12} className='mb-2 '>
                                        <label htmlFor="" className='form-label'>ເອກະສານ</label>
                                        <div>
                                            <label className='btn btn-blue'>
                                                <input type="file" className='hide' onChange={(e) => handleFileChange(e.target.files[0])} />
                                                <i className="fa-solid fa-paperclip me-2" /> ເລືອກເອກະສານ...
                                            </label>

                                            {selectFile && (
                                                <div class="alert alert-success alert-dismissible fade show mt-2">
                                                    <strong> <i class="fa-solid fa-paperclip me-2"></i>{selectFile.name}!</strong>
                                                    <button type="button" class="btn-close" onClick={() => handleMove()}></button>
                                                </div>
                                            )}
                                            </div>
                                    </Col>
                                </Row>
                            </Grid>


                            <Grid fluid className='mt-4'>
                                <Row>
                                    <Col xs={12}>
                                        <Button type='rest' appearance="primary" color='red' block>ຍົກເລີກ</Button>
                                    </Col>
                                    <Col xs={12}>
                                        <Button type='submit' appearance="primary" color='blue' block>ບັນທຶກລາຍຈ່າຍ</Button>
                                    </Col>
                                </Row>
                            </Grid>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default FromExpenditure