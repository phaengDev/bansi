import React, { useState, useEffect } from 'react'
import PanelPage from './PanelPage';
import SearchIcon from '@rsuite/icons/Search';
import { Grid, Row, Col, Input, DatePicker, SelectPicker, Button, InputPicker, InputGroup, Loader, Placeholder } from 'rsuite';
import { Config, } from '../../config/connection';
import { useDepart,  usePage } from '../../config/selectOption';
import axios from 'axios';
import moment from 'moment';
import { Notification } from '../../utils/Notification';
function ReportLackWork() {
  const api = Config.API;
  const depart = useDepart();

  const [valeus, setValues] = useState({
    start_date: null,
    end_date: null,
    status_lack: '',
    status_off: 1,
    depart_id_fk: '',
  });

  const [isloading, setIsloading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [itemData, setItemData] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const page = usePage(totalItems);
  const [filteredData, setFilteredData] = useState([]);
  const fetchData = async () => {
    setIsloading(true);
    try {
      const response = await axios.post(api + 'lackwork/fetch', valeus);
      const jsonData = response.data;
      console.log(jsonData);
      setItemData(jsonData);
      setFilteredData(jsonData);
      setTotalItems(jsonData.length);
    } catch (error) {
      console.error("Error fetching data:", error); // Log errors for debugging
    }
    finally {
      setIsloading(false);
    }
  };

  const [titlestart, setTitlestart] = useState('');
  const [titleend, setTitleend] = useState('');
  const handleSearch = () => {
    if (valeus.start_date && valeus.end_date === null) {
      setTitlestart('');
      setTitleend('ກະລຸນາເລືອກຫາວັນທີ');
      return
    } else if (valeus.start_date === null && valeus.end_date) {
      setTitleend('');
      setTitlestart('ກະລຸນາເລືອກວັນທິ');
      return
    } else {
      setTitlestart('');
      setTitleend('');
    }
    fetchData();
  }

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


  const [selectedIds, setSelectedIds] = useState([]);
  const allIds = currentItems
    .filter((item) => item.status_off === 1)
    .map((item) => item.lack_work_id);

  const handleCheckAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(allIds); // Select all checkable IDs
    } else {
      setSelectedIds([]); // Clear selection
    }
  };

  const handleCheckboxChange = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  const handlestatus = async () => {
    try {
      const response = await axios.post(api + 'lackwork/status_off', { lack_work_id: selectedIds });
      console.log(response);
      if (response.status === 200) {
        Notification.success('ສໍາເລັດການອັບເດດການລາພັກວຽກ', 'ສໍາເລັດ');
        fetchData();
      }

    } catch (error) {
      Notification.error('ບັນທຶກຂໍ້ມູນຂາດວຽກບໍ່ສາມາດ', 'error');
    }
  };

useEffect(() => {
  fetchData();
}, []);

  return (
    <div id="content" class="app-content p-3 bg-component">
      <PanelPage type={'lack'} data={totalItems} />

      <div className="panel">
        <div class="panel-heading py-2">
          <h4 class="panel-title fs-bold fs-4">ລາຍການພະນັກງານຂາດວຽກ</h4>
          <div class="panel-heading-btn">
            <a href="javascript:;" class="btn btn-xs btn-icon btn-default" data-toggle="panel-expand"><i class="fa fa-expand"></i></a>
          </div>
        </div>
        <div className="panel-body">
          <Grid fluid className='mb-2'>
            <Row>
              <Col xs={12} md={8} lg={4} className='mb-2'>
                <div className="form-group">
                  <label className='form-label'>ວັນທີລາພັກ</label>
                  <DatePicker oneTap value={valeus.start_date} format='dd/MM/yyyy' onChange={(e) => setValues({ ...valeus, start_date: e })} block />
                  <span className='text-red fs-11px'>{titlestart}</span>
                </div>
              </Col>
              <Col xs={12} md={8} lg={4} className='mb-2'>
                <div className="form-group">
                  <label className='form-label'>ຫາວັນທີ</label>
                  <DatePicker oneTap value={valeus.end_date} format='dd/MM/yyyy' onChange={(e) => setValues({ ...valeus, end_date: e })} block />
                  <span className='text-red fs-11px'>{titleend}</span>
                </div>
              </Col>
              <Col xs={24} md={8} lg={5} className='mb-2'>
                <div className="form-group">
                  <label className='form-label'>ພະແນກ</label>
                  <SelectPicker data={depart} value={valeus.depart_id_fk} onChange={(e) => setValues({ ...valeus, depart_id_fk: e })} block placeholder='ທັງໝົດ' />
                </div>
              </Col>
              <Col xs={24} md={8} lg={4} className='mb-2'>
                <div className="form-group">
                  <label className='form-label'>ປະເພດ</label>
                  <SelectPicker data={[{ label: 'ເຕັ້ມມື້', value: 1 }, { label: 'ເຄິງມື້', value: 2 }]} value={valeus.status_lack} onChange={(e) => setValues({ ...valeus, status_lack: e })} block placeholder='ທັງໝົດ' />
                </div>
              </Col>
              <Col xs={18} md={6} lg={4} className='mb-2'>
                <div className="form-group">
                  <label className='form-label'>ສະຖານະ</label>
                  <InputPicker data={[
                    { label: 'ຄ້າງປິດ', value: 1 },
                    { label: 'ປິດແລ້ວ', value: 2 },
                  ]} value={valeus.status_off} placeholder='ທັງໝົດ' onChange={(e) => setValues({ ...valeus, status_off: e })} block />
                </div>
              </Col>
              <Col xs={4} md={4} lg={2} className='mb-2'>
                <Button type='button' appearance="primary" onClick={handleSearch} className='mt-4' >ຄົ້ນຫາ</Button>
              </Col>
            </Row>

            <Row className=" mt-2">
              <Col xs={6} md={4} lg={2} className='mb-2'>
                <InputPicker data={page} value={itemsPerPage} onChange={(valeus) => setItemsPerPage(valeus)} placeholder='ສະແດງ' block />
              </Col>

              <Col xs={12} xsPush={6} md={10} mdPush={10} lg={6} lgPush={16}>
                <InputGroup inside>
                  <InputGroup.Addon><SearchIcon /></InputGroup.Addon>
                  <Input onChange={(value) => handleFillter(value)} placeholder='ຄົ້ນຫາ...' block />
                </InputGroup>
              </Col>
            </Row>
          </Grid>
          <div className="table-responsive">
            <table className={`table table-bordered  text-nowrap ${itemData.length > 0 && 'table-striped'}`}>
              <thead>
                <tr>
                  <th className='text-center w-5'>ລ/ດ</th>
                  <th className='text-center w-1'>
                    <input class="form-check-input is-valid"
                      type="checkbox" onChange={handleCheckAll} checked={selectedIds.length === allIds.length} /></th>
                    <th>ວັນທີ</th>
                    <th>ພະນັກງານ</th>
                    <th>ພະແນກ</th>
                    <th className='text-center'>ປະເພດ</th>
                    <th>ລາຍລະອຽດ</th>
                </tr>
              </thead>
              <tbody>
                {isloading ? (<tr className='border-0'>
                  <td colSpan='12' className='text-center border-0 bg-white'>
                    <Placeholder.Grid rows={5} columns={6} active />
                    <Loader center size='lg' content="ກຳລັງໂຫລດ...." vertical />
                  </td>
                </tr>) : (
                  <>
                    {currentItems.length > 0 ?
                      currentItems.map((item, index) => (
                        <tr key={index}>
                          <td className='text-center'>{index + 1}</td>
                          <td className='text-center'>
                            {item.status_off === 1 ? (
                              <input class="form-check-input is-valid" type="checkbox"
                                checked={selectedIds.includes(item.lack_work_id)}
                                onChange={() => handleCheckboxChange(item.lack_work_id)} />
                            ) : (
                              <i class="fa-solid fa-check text-green fs-4" />
                            )}
                          </td>
                          <td>{moment(item.lack_date).format('DD/MM/YYYY')}</td>
                          <td>{item.first_name + ' ' + item.last_name}</td>
                          <td>{item.depart_name}</td>
                          <td className='text-center'>{item.status_lack === 1 ? 'ເຕັ້ມມື້' : 'ເຄິງມື້'}</td>
                          <td>{item.description}</td>
                          
                        </tr>
                      ))
                      : (
                        <tr className='border-0'>
                          <td colSpan='12' className='text-center border-0'>
                            <img src={'../assets/img/icon/notSearch.png'} className='w-20' />
                            <p className='text-red'>ບໍ່ພົບຂໍ້ມູນຂອງການຂາດວຽກ....</p>
                          </td>
                        </tr>
                      )}
                  </>
                )}
              </tbody>
            </table>
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
                      }`}  >
                    <button
                      type="button"
                      className="page-link"
                      onClick={() => handlePageChange(index + 1)}  >
                      {index + 1}
                    </button>
                  </li>
                ))}
                <li className={`page-item ${currentPage === totalPages && 'disabled'
                  }`}  >
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
      {selectedIds.length > 0 && (
        <button type='button' onClick={handlestatus} class="sidebar-toggler" >
          <i class="fa-solid fa-check fs-4" />
        </button>
      )}

    </div>
  )
}

export default ReportLackWork