import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom';
import { Grid, Row, Col, SelectPicker, DatePicker, Button, Pagination, Loader, Placeholder, Input, InputGroup } from 'rsuite';
import { useTypeInXep } from '../../config/selectOption';
import { Config } from '../../config/connection';
import axios from 'axios';
import moment from 'moment/moment';
import numeral from 'numeral';
import ViewIncome from './View-Income';
function IncomePage() {
  const api = Config.API;
  const inserts = localStorage.getItem('inserts');
  const deletes = localStorage.getItem('deletes');
  const edits = localStorage.getItem('edits');

  const itemIncome = useTypeInXep(240001)
  const navigate = useNavigate();
  const handleNew = () => {
    navigate('/from-incom')
  }

  const [values, setValues] = useState({
    start_date: new Date(),
    end_date: new Date(),
    type_incom_fk: '',
    acount_id_fk: ''
  })
  const handleChange = (name, value) => {
    setValues({
      ...values, [name]: value
    })
  }
  const [itemsData, setItemsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetchData = async () => {
    setLoading(true)
    try {
      const response = await axios.post(api + 'incom/read', values);
      const data = await response.data;
      setItemsData(data);
      setTotal(data.length);

    }
    catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };
  const handleDelete = async (id) => {
    try {
      const response = await axios.delete(api + 'incom/delete/' + id);
      fetchData();
    }
    catch (error) {
      console.error('Error fetching data:', error);
    }
  };
  const handleEdit = async (id) => {
    try {
      navigate('/edit-incom/' + id);
    }
    catch (error) {
      console.error('Error fetching data:', error);
    }
  }
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState({});
  const handleView = async (data) => {
    setData(data)
    setOpen(true);
  }

  const handleSearch = async () => {
    fetchData();
  }

  const limitOptions = [50, 100, 250, 500, 1000];
  const [activePage, setActivePage] = React.useState(1);
  const [maxButtons, setMaxButtons] = React.useState(5);
  const [total, setTotal] = React.useState(0);
  const [layout, setLayout] = React.useState(['total', '-', 'limit', '|', 'pager']);
  const [limit, setLimit] = React.useState(50);
  const startIndex = (activePage - 1) * limit;
  const paginatedItems = itemsData.slice(startIndex, startIndex + limit);


  const totalsByGenus = paginatedItems.reduce((acc, item) => {
    const key = item.currency_id_fk;
    // If the group doesn't exist, initialize it
    if (!acc[key]) {
        acc[key] = {
            balance_total: 0,
            balance_incom: 0,
            genus_laos: item.genus_laos,
            genus: item.genus // Preserve genus_laos for this group
        };
    }
    const treasury = parseFloat(item.balance_total) || 0;
    const unable = parseFloat(item.balance_incom) || 0;

    acc[key].balance_total += treasury;
    acc[key].balance_incom += unable;
    return acc;
}, {});


  useEffect(() => {
    fetchData();
  }, []);
  return (
    <div id="content" class="app-content bg-white">
      <ol class="breadcrumb float-end">
        <li class="breadcrumb-item"><Link to={'/'}>ໜ້າຫຼັກ</Link></li>
        <li class="breadcrumb-item"><a href='javascript:;' onClick={handleNew} className={`text-blue ${inserts === '2' && 'disabled'}`}><i className='fas fa-plus'></i> ເພີ່ມລາຍຮັບ</a></li>
        <li class="breadcrumb-item active">ຂໍ້ມູນລາຍຮັບ</li>
      </ol>
      <h1 class="page-header">ຂໍ້ມູນລາຍຮັບ </h1>

      <div class="panel">
        <div class="panel-body p-0">
          <Grid fluid>
            <Row className="show-grid">
              <Col xs={12} sm={8} md={5} className='mb-2'>
                <label htmlFor="" className='form-label fs-bold'>ວັນທີ່ຮັບ</label>
                <DatePicker oneTap value={values.start_date} onChange={(e) => handleChange('start_date', e)} format='dd/MM/yyyy' block />
              </Col>
              <Col xs={12} sm={8} md={5} className='mb-2'>
                <label htmlFor="" className='form-label fs-bold'>ວັນທີ່ຮັບ</label>
                <DatePicker oneTap value={values.end_date} onChange={(e) => handleChange('end_date', e)} format='dd/MM/yyyy' block />
              </Col>
              <Col xs={24} sm={8} md={6} lg={6} className='mb-2'>
                <label htmlFor="" className='form-label fs-bold'>ປະເພດລາຍຮັບ</label>
                <SelectPicker data={itemIncome} value={values.type_incom_fk} onChange={(e) => handleChange('type_incom_fk', e)} block placeholder='ເລືອກປະເພດ' />
              </Col>
              <Col xs={18} sm={8} md={6} className='mb-2'>
                <label htmlFor="" className='form-label fs-bold'>ບັນຊີເງິນຄັງ</label>
                <SelectPicker data={[]} value={values.acount_id_fk} onChange={(e) => handleChange('acount_id_fk', e)} block placeholder='ເລືອກບັນຊີ' />
              </Col>
              <Col xs={2} className='mb-2'>
                <Button appearance="primary" onClick={handleSearch} className='mt-4'><i className="fas fa-search me-1"></i>ຄົ້ນຫາ</Button>
              </Col>
            </Row>
          </Grid>

          {
            loading ? (
              <div className='text-center mt-5'>
                <Placeholder.Grid rows={5} columns={6} active />
                <Loader center size='lg' vertical content="ກຳລັງໂຫຼດຂໍ້ມູນ....." />
              </div>
            ) : (
              paginatedItems.length > 0 ? (
                <>
                  <div className="row mt-3">
                    <div className="col-sm-9 col-4" />
                    <div className="col-sm-3 col-8">
                      <InputGroup inside>
                        <InputGroup.Addon><i className="fa fa-search"></i></InputGroup.Addon>
                        <Input placeholder='ຄົ້ນຫາ...' />
                      </InputGroup>
                    </div>
                  </div>
                  <div class="table-responsive mt-2">
                    <table class="table table table-striped table-bordered table-hover text-nowrap">
                      <thead>
                        <tr>
                          <th className='text-center'>ລ/ດ</th>
                          <th className='text-center'>ວັນທີ່ຮັບ</th>
                          <th className='text-center'>ເລກທີ່ບິນ</th>
                          <th className=''>ລາຍການ</th>
                          <th className=''>ປະເພດລາຍຮັບ</th>
                          <th className=''>ບັນຊີເງິນຄັງ</th>
                          <th className='text-end'>ຍອດເງິນ</th>
                          <th className='text-end'>ອາກອນ</th>
                          <th className='text-end'>ຍອດຮັບຕົວຈີງ</th>
                          <th>ລາຍລະອຽດ</th>
                          <th className='text-center'>ສະຖານະ</th>
                          <th className='text-center'>#</th>
                          <th className='text-center'>ຕັ້ງຄ່າ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedItems.map((item, index) => (
                          <tr key={index}>
                            <td className='text-center'>{index + 1}</td>
                            <td className='text-center'>{moment(item.date_incom).format('DD/MM/YYYY')}</td>
                            <td className=''>{item.incom_number}</td>
                            <td className=''>{item.incom_title}</td>
                            <td className=''>{item.in_ex_name}</td>
                            <td className=''>{item.acountName}</td>
                            <td className='text-end'>{numeral(item.balance_total).format('0,0.00')} {item.genus}</td>
                            <td className='text-center'>{item.tax}%</td>
                            <td className='text-end'>{numeral(item.balance_incom).format('0,0.00')} {item.genus}</td>
                            <td className=''>{item.description}</td>
                            <td className='text-center'>
                              {item.status_confrim === 1 ? (
                                <span className="badge bg-danger">ຄ້າງປິດ</span>
                              ) : (
                                <span className="badge bg-success"><i class="fa-solid fa-check" /> ປິດຍອດແລ້ວ</span>
                              )}
                            </td>
                            <td className='text-center'>
                              <button type="button" onClick={() => handleView(item)} className="btn btn-xs btn-orange me-1" ><i class="fa-solid fa-eye" /></button>
                              {item.file_incom && (
                                <button type="button" className="btn btn-xs btn-success" ><i class="fa-solid fa-cloud-arrow-down" /></button>
                              )}
                            </td>
                            <td className='text-center'>
                              {item.status_confrim === 1 && (<>
                          <button type="button" className="btn btn-xs btn-primary me-1" onClick={() => handleEdit(item.incom_uuid)} disabled={edits === '2' ? true : false} ><i className="fas fa-edit" /></button>
                          <button type="button" className="btn btn-xs btn-danger" onClick={() => handleDelete(item.incom_uuid)} disabled={deletes === '2' ? true : false}><i className="fas fa-trash-alt" /></button>
                          </>)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                      {Object.keys(totalsByGenus).map((key, index) => (
                                    <tr key={index}>
                                        <td className="text-end fs-bold" colSpan={6}>ລວມຍອດລາຍຮັບສະກຸນເງິນ {totalsByGenus[key].genus_laos}</td>
                                        <td className="text-end fs-bold">
                                            {numeral(totalsByGenus[key].balance_total).format('0,0.00')} {totalsByGenus[key].genus}
                                        </td>
                                        <td className=""></td>
                                        <td className="text-end fs-bold text-green">
                                            {numeral(totalsByGenus[key].balance_incom).format('0,0.00')} {totalsByGenus[key].genus}
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
              ) : (<div className='text-center'>
                <img src="src/assets/icon/001020.jpeg" className="w-30 mx-auto p-3" alt="" />
              </div>)
            )}
        </div>
      </div>

      <ViewIncome open={open} handleClose={() => setOpen(false)} data={data} />
    </div>
  )
}

export default IncomePage