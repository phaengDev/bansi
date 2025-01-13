import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom';
import SearchIcon from '@rsuite/icons/Search';
import FormLackWork from './Form-LackWork';
import { Config } from '../../config/connection';
import { Grid, Row, Col, Input, DatePicker, SelectPicker, Button, InputPicker, InputGroup, Loader, Placeholder } from 'rsuite';
import { useDepart, usePage } from '../../config/selectOption';
import axios from 'axios';
import moment from 'moment';

function LackWork() {
  const api = Config.API;
  const inserts = parseInt(localStorage.getItem('inserts') || '0', 10);
  const edits = parseInt(localStorage.getItem('edits') || '0', 10);
  const deletes = parseInt(localStorage.getItem('deletes') || '0', 10);
  const depart = useDepart();

  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const handleNew = () => {
    setOpen(true);
    setData(null);
  }
  const [values, setValues] = useState({
    start_date: new Date(),
    end_date: new Date(),
    status_lack: '',
    depart_id_fk: '',
  });
  const [total, setTotal] = useState(0);
  const page = usePage(total);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [itemData, setItemData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const fetchData = async () => {
    setIsLoading(true)
    try {
      const response = await axios.post(api + 'lackwork/query', values);
      const jsonData = response.data;
      setItemData(jsonData);
      setFilteredData(jsonData);
      setTotal(jsonData.length);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    finally {
      setIsLoading(false);
    }
  };
  const handleFillter = (value) => {
    const dateFilter = filteredData.filter((item) => {
      return (
        item.first_name.toLowerCase().includes(value.toLowerCase()) ||
        item.last_name.toLowerCase().includes(value.toLowerCase())
      );
    });
    setItemData(dateFilter);
  }



  const totalPages = Math.ceil(itemData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = itemData.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleEdit = (item) => {
    setOpen(true);
    setData(item);
  }

  useEffect(() => {
    fetchData();
  }, [])
  return (
    <div id="content" class="app-content p-3 bg-component">
      <ol class="breadcrumb float-end">
        <li class="breadcrumb-item"><Link to={'/'}>ໜ້າຫຼັກ</Link></li>
        <li class="breadcrumb-item"><a href='javascript:;' onClick={handleNew} className={`text-blue ${inserts === '2' && 'disabled'}`}><i className='fas fa-plus'></i> ລົງຂໍ້ມູນຂາດວຽກ</a></li>
        <li class="breadcrumb-item active">ຂໍ້ມູນການຂາດວຽກ</li>
      </ol>
      <h1 className='page-header'>ຂໍ້ມູນການຂາດວຽກປະຈຳວັນ</h1>
      <div className="panel">
        <div className="panel-body">
          <Grid fluid className='mb-2'>
            <Row>
              <Col xs={12} md={8} lg={5} className='mb-2'>
                <div className="form-group">
                  <label className='form-label'>ວັນທີລາພັກ</label>
                  <DatePicker oneTap value={values.start_date} format='dd/MM/yyyy' onChange={(e) => setValues({ ...values, start_date: e })} block />
                </div>
              </Col>
              <Col xs={12} md={8} lg={5} className='mb-2'>
                <div className="form-group">
                  <label className='form-label'>ວັນທີລາພັກ</label>
                  <DatePicker oneTap value={values.end_date} format='dd/MM/yyyy' onChange={(e) => setValues({ ...values, end_date: e })} block />
                </div>
              </Col>
              <Col xs={24} md={8} lg={6} className='mb-2'>
                <div className="form-group">
                  <label className='form-label'>ພະແນກ</label>
                  <SelectPicker data={depart} value={values.depart_id_fk} onChange={(e) => setValues({ ...values, depart_id_fk: e })} block placeholder='ທັງໝົດ' />
                </div>
              </Col>
              <Col xs={18} md={6} lg={4} className='mb-2'>
                <div className="form-group">
                  <label className='form-label'>ສະຖານະ</label>
                  <InputPicker data={[
                    { label: 'ເຕັ້ມມື້', value: 1 },
                    { label: 'ເຄິງມື້', value: 2 },
                  ]} value={values.status_lack} placeholder='ທັງໝົດ' onChange={(e) => setValues({ ...values, status_lack: e })} block />
                </div>
              </Col>
              <Col xs={4} md={4} lg={2} className='mb-2'>
                <Button type='button' appearance="primary" onClick={fetchData} className='mt-4' >ຄົ້ນຫາ</Button>
              </Col>
            </Row>

            <Row className=" mt-2">
              <Col xs={6} md={4} lg={2} className='mb-2'>
                <InputPicker data={page} value={itemsPerPage} onChange={(values) => setItemsPerPage(values)} block />
              </Col>

              <Col xs={12} xsPush={6} md={10} mdPush={10} lg={6} lgPush={16}>
                <InputGroup inside>
                  <InputGroup.Addon><SearchIcon /></InputGroup.Addon>
                  <Input onChange={(event) => handleFillter(event)} placeholder='ຄົ້ນຫາ...' block />
                </InputGroup>
              </Col>
            </Row>
          </Grid>
          <div className="table-responsive">
            {isLoading ? (
              <div className="text-center">
                <Placeholder.Grid rows={5} columns={6} active />
                <Loader center size='lg' content="ກຳລັງໂຫລດ...." vertical />
              </div>
            ) : (
              <table className="table table-bordered text-nowrap">
                <thead>
                  <tr>
                    <th className='text-center w-10'>ລໍາດັບ</th>
                    <th>ວັນທີ</th>
                    <th>ພະນັກງານ</th>
                    <th>ພະແນກ</th>
                    <th className='text-center'>ປະເພດ</th>
                    <th>ລາຍລະອຽດ</th>
                    <th className='text-center w-10'>ຕັ້ງຄ່າ</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.length > 0 ?
                    itemData.map((item, index) => (
                      <tr key={index}>
                        <td className='text-center'>{index + 1}</td>
                        <td>{moment(item.lack_date).format('DD/MM/YYYY')}</td>
                        <td>{item.first_name + ' ' + item.last_name}</td>
                        <td>{item.depart_name}</td>
                        <td className='text-center'>{item.status_lack === 1 ? 'ເຕັ້ມມື້' : 'ເຄິງມື້'}</td>
                        <td>{item.description}</td>
                        <td className='text-center'>
                        {item.status_off === 1 && (
                          <>
                          {edits === 1 && (
                            <button type='button' onClick={() => handleEdit(item)} className='btn btn-xs btn-primary me-1'><i className='fas fa-edit'></i> </button>
                          )}
                          {deletes === 1 && (
                            <button type='button' className='btn btn-xs btn-danger'><i className='fas fa-trash'></i> </button>
                          )}
                          </>
                        )}
                        </td>
                      </tr>
                    ))
                    : (
                      <tr className='border-0'>
                        <td colSpan='11' className='text-center border-0 '>
                          <img src={'../assets/img/icon/notSearch.png'} className='w-20' />
                          <p className='text-red'>ບໍ່ພົບຂໍ້ມູນຂອງການລາພັກ....</p>
                        </td>
                      </tr>
                    )}
                </tbody>
              </table>
            )}
          </div>
          {currentItems.length > 0 && (
            <div className="d-md-flex align-items-center">
              <div className="me-md-auto text-md-left text-center mb-2 mb-md-0">
                ສະແດງ {startIndex + 1} ຫາ
                {Math.min(endIndex, itemData.length)} ຈາກທັງໝົດ {itemData.length} ລາຍການ
              </div>
              <ul className="pagination mb-0 justify-content-center">
                <li className={`page-item ${currentPage === 1 && 'disabled'}`}>
                  <button
                    type="button"
                    className="page-link"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    ກ່ອນໜ້ານີ້
                  </button>
                </li>
                {Array.from({ length: totalPages }, (_, index) => (
                  <li
                    key={index}
                    className={`page-item ${currentPage === index + 1 ? 'active' : ''
                      }`}
                  >
                    <button
                      type="button"
                      className="page-link"
                      onClick={() => handlePageChange(index + 1)}
                    >
                      {index + 1}
                    </button>
                  </li>
                ))}
                <li
                  className={`page-item ${currentPage === totalPages && 'disabled'
                    }`}
                >
                  <button
                    type="button"
                    className="page-link"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    ໜ້າຕໍ່ໄປ
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>


      {open && (
        <FormLackWork open={open} hancleClose={() => setOpen(false)} data={data} fetchData={fetchData} />
      )}
    </div>
  )
}

export default LackWork