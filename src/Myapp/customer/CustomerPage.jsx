import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom';
import { Grid, Row, Col, Button, SelectPicker, Input } from 'rsuite';
import FormAddCutstomer from './FormAdd/FormAddCutstomer';
function CustomerPage() {
    const inserts = localStorage.getItem('inserts');
    const [open, setOpen] = useState(false);
    const [data, setData] = useState(null);
    const handleNew = () => {
        setOpen(true);
        setData(null);
    }
    return (
        <div id="content" class="app-content p-3 bg-component">
            <ol class="breadcrumb float-end">
                <li class="breadcrumb-item"><Link to={'/'}>ໜ້າຫຼັກ</Link></li>
                <li class="breadcrumb-item"><a href='javascript:;' onClick={handleNew} className={`text-blue ${inserts === '2' && 'disabled'}`}><i className='fas fa-plus'></i> ລົງຂໍ້ມູນເຂົ້າອອກ</a></li>
                <li class="breadcrumb-item active">ຂໍ້ມູນການລູກຄ້າ</li>
            </ol>
            <h1 className='page-header'>ຂໍ້ມູນລູກຄ້າ</h1>
            <div className="panel">
                <div className="panel-body">
                    <Grid fluid>
                        <Row>
                            <Col xs={12} sm={8} md={5} >
                                <label htmlFor="" className='form-label fs-bold'>ແຂວງ</label>
                                <SelectPicker data={[]} placeholder='ເລືອກແຂວງ' block />
                            </Col>
                            <Col xs={12} sm={8} md={5} >
                                <label htmlFor="" className='form-label fs-bold'>ເມື່ອງ</label>
                                <SelectPicker data={[]} placeholder='ເລືອກເມືອງ' block />
                            </Col>
                            <Col xs={12} sm={6} md={5} >
                                <label htmlFor="" className='form-label fs-bold'>ປະເພດ</label>
                                <SelectPicker data={[]} placeholder='ເລືອກເມືອງ' block />
                            </Col>
                            <Col xs={12} sm={6} md={6} >
                                <label htmlFor="" className='form-label fs-bold'>ຄົ້ນຫາ</label>
                                <Input placeholder='ເລືອກເມືອງ' block />
                            </Col>
                            <Col xs={3} sm={2} md={2} >
                                <Button color='blue' appearance="primary" className='mt-4'>ຄົ້ນຫາ</Button>
                            </Col>
                        </Row>
                    </Grid>
                    <div className="table-responsive mt-3">
                        <table className="table table-striped table-bordered text-nowrap">
                            <thead>
                                <tr>
                                    <th className='text-center w-5'>ລ/ດ</th>
                                    <th className='text-center w-5'>ໂລໂກ</th>
                                    <th>ລະຫັດ</th>
                                    <th>ຊື່ການລູກຄ້າ</th>
                                    <th>ເບີໂທລະສັບ</th>
                                    <th>ອີເມວ</th>
                                    <th>ບ້ານ</th>
                                    <th>ເມື່ອງ</th>
                                    <th>ແຂວງ</th>
                                    <th>ປະເພດ</th>
                                    <th>ສະຖານະ</th>
                                    <th className='text-center w-10'>ຕັ້ງຄ່າ</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className='text-center'>1</td>
                                    <td>ຊື່ການລູກຄ້າ</td>
                                    <td>ບ້ານຜູ້ລູກຄ້າ</td>
                                    <td>ບ້ານຜູ້ອອກ</td>
                                    <td>ບ້ານຜູ້ຕົກລູກຄ້າ</td>
                                    <td>ບ້ານຜູ້ຕົກອອກ</td>
                                    <td>ບ້ານຜູ້ຕົກອອກ</td>
                                    <td>ບ້ານຜູ້ຕົກອອກ</td>
                                    <td>ບ້ານຜູ້ຕົກອອກ</td>
                                    <td>ບ້ານຜູ້ຕົກອອກ</td>
                                    <td>ບ້ານຜູ້ຕົກອອກ</td>
                                    <td></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <FormAddCutstomer open={open} handleClose={() => setOpen(false)} data={data} />
        </div>
    )
}

export default CustomerPage