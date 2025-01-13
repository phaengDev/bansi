import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom';
import { Grid, Row, Col, SelectPicker, DatePicker, Input, Button, InputPicker, InputGroup, Loader, Placeholder, Pagination } from 'rsuite';
import { usePage, useTypeInXep } from '../../config/selectOption';
import { Config } from '../../config/connection';
import axios from 'axios';
import moment from 'moment/moment';
import numeral from 'numeral';
import ViewExpenditure from './View-Expenditure';
function ExpenditurePage() {
  const api = Config.API;
  const inserts = localStorage.getItem('inserts');
  const edits = localStorage.getItem('edits');
  const deletes = localStorage.getItem('deletes');
  const itemIncome = useTypeInXep(240002);
  const dataPage = usePage(100);
  const navigate = useNavigate();
  const handleNew = () => {
    navigate('/from-exp')
  }
  const status = [
    {
      label: 'ຄ້າງປິດຍອດ',
      value: '1'
    },
    {
      label: 'ປິດຍອດແລ້ວ',
      value: '2'
    }
  ]

  const [values, setValues] = useState({
    start_date: new Date(),
    end_date: new Date(),
    type_expenditure_fk: '',
    treasury_id_fk: '',
    status_confirm: '1'
  })
  const handleSearch = (name, value) => {
    setValues({
      ...values, [name]: value
    })
  }

  const [itemsData, setItemsData] = useState([]);
  const [isLoading, setLoading] = useState(true);
  const fetchData = async () => {
    setLoading(true)
    try {
      const response = await axios.post(api + 'expenditure/fetch', values);
      const data = await response.data;
      setTotal(data.length);
      setItemsData(data);
    }
    catch (error) {
      console.error('Error fetching data:', error);
    }
    finally {
      setLoading(false);
    }
  };

  const limitOptions = [50, 100, 250, 500, 1000];
  const [activePage, setActivePage] = React.useState(1);
  const [maxButtons, setMaxButtons] = React.useState(5);
  const [total, setTotal] = React.useState(0);
  const [layout, setLayout] = React.useState(['total', '-', 'limit', '|', 'pager']);
  const [limit, setLimit] = React.useState(50);
  const startIndex = (activePage - 1) * limit;
  const paginatedItems = itemsData.slice(startIndex, startIndex + limit);

  const [isHovered, setIsHovered] = useState(false);

  const [data, setData] = useState({});
  const [open, setOpen] = useState(false);
  const handleView = (item) => {
    setData(item);
    setOpen(true);
  }


  const totalsByGenus = paginatedItems.reduce((acc, item) => {
    const key = item.currency_id_fk;
    // If the group doesn't exist, initialize it
    if (!acc[key]) {
        acc[key] = {
            balance_total: 0,
            balance_discount: 0,
            balance_tax: 0,
            balance_pays: 0,
            currency: item.currency,
            genus: item.genus // Preserve genus_laos for this group
        };
    }
    const total = parseFloat(item.balance_total) || 0;
    const discount = parseFloat(item.balance_discount) || 0;
    const tax = parseFloat(item.balance_tax) || 0;
    const pays = parseFloat(item.balance_pays) || 0;

    acc[key].balance_total += total;
    acc[key].balance_discount += discount;
    acc[key].balance_tax += tax;
    acc[key].balance_pays += pays;
    return acc;
}, {});


  useEffect(() => {
    fetchData();
    usePage(itemsData.length);
  }, [activePage, limit]);

  return (
    <div id="content" class="app-content p-3 bg-component">
      <ol class="breadcrumb float-end">
        <li class="breadcrumb-item"><Link to={'/'}>ໜ້າຫຼັກ</Link></li>
        <li class="breadcrumb-item"><a href='javascript:;' onClick={handleNew} className={`text-blue ${inserts === '2' && 'disabled'}`}><i className='fas fa-plus'></i> ລົງຂໍ້ມູນລາຍຈ່າຍ</a></li>
        <li class="breadcrumb-item active">ລົງຂໍ້ມູນລາຍຈ່າຍ</li>
      </ol>
      <h1 class="page-header">ຂໍ້ມູນລາຍຈ່າຍປະຈຳວັນ</h1>
      <div class="panel">
        <div class="panel-body p-0">
          <Grid fluid>
            <Row className="show-grid">
              <Col xs={12} sm={8} md={6} lg={4} className='mb-2'>
                <label htmlFor="" className='form-label fs-bold'>ວັນທີ່ຈ່າຍ</label>
                <DatePicker oneTap value={values.start_date} onChange={(value) => handleSearch('start_date', value)} format='dd/MM/yyyy' block />
              </Col>
              <Col xs={12} sm={8} md={6} lg={4} className='mb-2'>
                <label htmlFor="" className='form-label fs-bold'>ວັນທີ່ຈ່າຍ</label>
                <DatePicker oneTap value={values.end_date} onChange={(value) => handleSearch('end_date', value)} format='dd/MM/yyyy' block />
              </Col>
              <Col xs={24} sm={8} md={12} lg={5} className='mb-2'>
                <label htmlFor="" className='form-label fs-bold'>ປະເພດລາຍຈ່າຍ</label>
                <SelectPicker data={itemIncome} value={values.type_expenditure_fk} onChange={(value) => handleSearch('type_expenditure_fk', value)} placeholder='--ທັງໝົດ--' block />
              </Col>
              <Col xs={24} sm={8} md={12} lg={5} className='mb-2'>
                <label htmlFor="" className='form-label fs-bold'>ບັນຊີເງິນຄັງ</label>
                <SelectPicker value={values.treasury_id_fk} onChange={(value) => handleSearch('treasury_id_fk', value)} placeholder='--ທັງໝົດ--' block />
              </Col>
              <Col xs={16} sm={4} md={8} lg={4} className='mb-2'>
                <label htmlFor="" className='form-label fs-bold'>ສະຖານະ</label>
                <InputPicker data={status} value={values.status_confirm} onChange={(value) => handleSearch('status_confirm', value)} placeholder='--ທັງໝົດ--' block />
              </Col>
              <Col xs={6} sm={4} md={2} className='mb-2'>
                <Button appearance="primary" onClick={fetchData} className='mt-4'><i className="fas fa-search me-2"></i> ຄົ້ນຫາ </Button>
              </Col>
            </Row>
          </Grid>

          {
            paginatedItems.length > 0 ? (
              <>
                <div className='mt-3'>
                  <ol class="breadcrumb float-end">
                    <InputGroup inside>
                      <InputGroup.Addon> <i className="fas fa-search" /></InputGroup.Addon>
                      <Input placeholder='ຄົ້ນຫາ...' />
                    </InputGroup>
                  </ol>
                  <div class="page-header">
                    <InputPicker data={dataPage} value={limit} onChange={(value) => setLimit(value)} className='w-sm-100px w-100px ' />
                  </div>
                </div>
                <div class="table-responsive">
                  <table class="table table table-striped table-bordered table-hover text-nowrap">
                    <thead>
                      <tr>
                        <th className='text-center'>ລ/ດ</th>
                        <th className='text-center'>ວັນທີ່ຈ່າຍ</th>
                        <th className='text-center'>ເລກທີ່</th>
                        <th className=''>ລາຍການ</th>
                        <th className=''>ປະເພດລາຍຈ່າຍ</th>
                        <th className=''>ບັນຊີເງິນຄັງ</th>
                        <th className='text-end'>ຍອດເງິນ</th>
                        <th className='text-end'>ສວນຫຼຸດ</th>
                        <th className='text-end'>ອາກອນ</th>
                        <th className='text-end'>ຍອດຈ່າຍ</th>
                        <th className=''>ລາຍລະອຽດ</th>
                        <th className='text-center'>ສະຖານະ</th>
                        <th className='text-center'>ສະຖານະຈ່າຍ</th>
                        <th className='text-center'>ຕັ້ງຄ່າ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {
                        isLoading ? (
                          <div className='mt-4'>
                            <Placeholder.Grid rows={5} columns={6} active />
                            <Loader center size='lg' vertical content="ກຳລັງໂຫຼດຂໍ້ມູນ....." />
                          </div>
                        ) : (
                          paginatedItems.map((item, index) => (
                            <tr key={index}>
                              <td className='text-center w-1'>{item.id}</td>
                              <td className='text-center'>{moment(item.expenditure_date).format('DD/MM/YYYY')}</td>
                              <td className='text-center'>
                                <span  className={`${isHovered === item.id ? 'btn btn-xs btn-primary' : ''}`}
                                onMouseEnter={() => setIsHovered(item.id)}
                                onMouseLeave={() => setIsHovered(null)}
                                role="button" onClick={() => handleView(item)}>{item.expenditure_no}</span>
                              </td>
                              <td>{item.expenditure_name}</td>
                              <td>{item.in_ex_name}</td>
                              <td> {item.status_pays === 1 ? item.acount_number + ' (' + item.currency + ' )' : item.type_name} </td>
                              <td className='text-end'>{numeral(item.balance_total).format('0,0.00')} {item.genus}</td>
                              <td className='text-end'>{numeral(item.balance_discount).format('0,0.00')} </td>
                              <td className='text-end'>{numeral(item.balance_tax).format('0,0.00')} </td>
                              <td className='text-end'>{numeral(item.balance_pays).format('0,0.00')} {item.genus}</td>
                              <td>{item.description}</td>
                              <td className='text-center'><span class={`px-2 rounded ${item.status_confirm === 1 ? 'bg-orange' : 'bg-green'}`}>{item.status_confirm === 1 ? 'ຄ້າງປິດ' : 'ປິດຍອດແລ້ວ'}</span></td>
                              <td className={`text-center ${item.status_pays === 1 ? 'text-green' : item.status_pays === 2 ? 'text-orange' : 'text-green'}`}>
                                {item.status_pays === 1 ? <><i class="fa-solid fa-check"></i> ເງິນບໍລິສັດ</> :
                                  item.status_pays === 2 ? <><i class="fa-solid fa-circle-exclamation" /> ເງິນນອກ ຄ້າງສົ່ງຄືນ</> :
                                    (<><i class="fa-solid fa-circle-check fs-5" /> ຈ່າຍແລ້ວ</>)} </td>
                              <td className='text-center'>
                                <button className='btn btn-xs btn-primary me-1' onClick={() => handleEdit(item)}  disabled={item.status_confirm === 1 && edits===1 ? true : false} ><i class="fa-solid fa-pen-to-square" /> </button>
                                <button className='btn btn-xs btn-danger' onClick={() => handleDeleete(item.id)} disabled={item.status_confirm === 1 && deletes===1 ? true : false}><i class="fa-solid fa-trash" /></button>
                              </td>
                            </tr>
                          ))
                        )
                      }
                    </tbody>
                    <tfoot>
                      {Object.keys(totalsByGenus).map((key, index) => (
                                    <tr key={index}>
                                        <td className="text-end fs-bold" colSpan={6}>ລວມຍອດລາຍຮັບສະກຸນເງິນ {totalsByGenus[key].currency}</td>
                                        <td className="text-end fs-bold">
                                            {numeral(totalsByGenus[key].balance_total).format('0,0.00')} {totalsByGenus[key].genus}
                                        </td>
                                        <td className="text-end fs-bold">
                                            {numeral(totalsByGenus[key].balance_discount).format('0,0.00')} {totalsByGenus[key].genus}
                                        </td>
                                        <td className="text-end fs-bold">
                                            {numeral(totalsByGenus[key].balance_tax).format('0,0.00')} {totalsByGenus[key].genus}
                                        </td>
                                        <td className="text-end fs-bold text-green">
                                            {numeral(totalsByGenus[key].balance_pays).format('0,0.00')} {totalsByGenus[key].genus}
                                        </td>
                                        <td colSpan={4}></td>
                                    </tr>
                                ))}
                      </tfoot>
                  </table>
                </div>
                <Pagination
                  layout={layout}
                  size="sm"
                  prev
                  next
                  first
                  last
                  ellipsis
                  boundaryLinks
                  total={total}
                  limit={limit}
                  limitOptions={limitOptions}
                  maxButtons={maxButtons}
                  activePage={activePage}
                  onChangePage={setActivePage}
                  // onChangeLimit={setLimit}
                  onChangeLimit={(value) => {
                    setLimit(value);
                    setActivePage(1);
                  }}
                />
              </>
            ) : (
              <div className='text-center'>
                <img src="src/assets/icon/001020.jpeg" className="w-30 mx-auto p-3" alt="" />
              </div>
            )
          }
        </div>
      </div>
<ViewExpenditure open={open} handleClose={()=>setOpen(false)} data={data} />
    </div>
  )
}

export default ExpenditurePage