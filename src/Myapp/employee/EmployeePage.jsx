import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom';
import { Input, SelectPicker, InputGroup } from 'rsuite';
import { Config, UrlImg } from '../../config/connection';
import moment from 'moment';
import axios from 'axios';
import { useDepart,useProvince } from '../../config/selectOption';
import UserPages from './UserPages';
import ViewProfile from './ViewProfile';
function EmployeePage() {
  const api = Config.API;
  const img = UrlImg.URL;
const depart=useDepart();
const province=useProvince(); 
  const [values, setValues] = useState({
    district_id_fk: '',
    province_id_fk: '',
    depart_id_fk: ''
  })

  const handleSearch = (name, value) => {
    setValues({
      ...values, [name]: value
    })
  }

  const [itemEmployee, setItemEmployee] = useState([]);
  const [filter, setFilter] = useState([]);
  const [loading, setLoading] = useState(true)
   const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage,setItemsPerPage] =useState(50);
  const fetchEmployee = async () => {
    setLoading(true)
    try {
      const response = await axios.post(api + 'staff/fetch', values);
      const jsonData = await response.data;
      setItemEmployee(jsonData);
      setFilter(jsonData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }


  const totalPages = Math.ceil(itemEmployee.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = itemEmployee.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
      setCurrentPage(page);
  };

  const [open, setOpen] = React.useState(false);
  const imgUser = './assets/img/icon/user.png';
  const [data, setData] = useState({})
  const viewUsers = (data) => {
    setData(data)
    setOpen(true)
  }

  const [openView, setOpenView] = React.useState(false);
  const [dataView, setDataView] = useState({})
const viewProfile=(data)=>{
  setDataView(data)
  setOpenView(true)
}

  useEffect(() => {
    fetchEmployee();
  }, [])
  return (

    <div id="content" class="app-content p-3 bg-component">

      <ol class="breadcrumb float-end">
        <li class="breadcrumb-item"><Link to={'/'}>ໜ້າຫຼັກ</Link></li>
        <li class="breadcrumb-item"><Link to={'/form-em'} className='text-blue'><i className='fas fa-plus'></i> ເພີ່ມພະນັກງານ</Link></li>
        <li class="breadcrumb-item active">ຂໍ້ມູນພະນັກງານ</li>
      </ol>
      <h1 class="page-header">ຂໍ້ມູນພະນັກງານ </h1>

      <div className="row mb-3">
        <div className="col-sm-3 mb-2">
          <label htmlFor="" className='form-label'>ພະແນກ</label>
          <SelectPicker block data={depart} value={values.depart_id_fk} onChange={(e) => handleSearch('depart_id_fk', e)} placeholder='ເລືອກ' />
        </div>
        <div className="col-sm-3 col-6 mb-2">
          <label htmlFor="" className='form-label'>ແຂວງ</label>
          <SelectPicker block data={province} value={values.province_id_fk} onChange={(e) => handleSearch('province_id_fk', e)} placeholder='ເລືອກ' />
        </div>
        <div className="col-sm-3 col-6  mb-2">
          <label htmlFor="" className='form-label'>ເມືອງ</label>
          <SelectPicker block value={values.district_id_fk} onChange={(e) => handleSearch('district_id_fk', e)} />
        </div>
        <div className="col-sm-3  mb-2">
          <label htmlFor="" className='form-label'>ຄົນຫາ</label>
          <InputGroup inside >
            <InputGroup.Addon>
              <i className='fas fa-search' />
            </InputGroup.Addon>
            <Input placeholder='ຄົ້ນຫາ...' />
          </InputGroup>
        </div>
      </div>
      <div className="table-responsive">
        <table class="table table-striped table-bordered align-middle text-nowrap">
          <thead className='fs-12px'>
            <tr>
              <th className='text-center w-2'>ລ/ດ</th>
              <th className='text-center w-2' >ຮູບ</th>
              <th className='text-center w-5' >ລະຫັດ</th>
              <th>ຊື່ ແລະ ນາມສະກຸນ</th>
              <th>ວັນເດືອນປິເກີດ</th>
              <th>ເບີໂທລະສັບ</th>
              <th>ອີເມວ</th>
              <th className='text-center' colSpan={3}>ຂໍ້ມູນທີ່ຢູ່ປະຈຸບັນ</th>
              <th>ພະແນກ</th>
              <th className='text-center'>ເອກະສານ</th>
              <th className='text-center'><i class="fa-solid fa-user-lock" /></th>
              <th className='text-center'>ການຕັ້ງຄ່າ</th>
            </tr>
          </thead>
          <tbody className='fs-14px'>
            {currentItems.map((item, index) => (
              <tr>
                <td className='text-center'>{item.id}</td>
                <td className='text-center with-img'><img src={item.profile !== '' ? img + 'profile/' + item.profile : imgUser} onClick={() => viewProfile(item)} class="rounded h-30px my-n1 mx-n1" role='button' /></td>
                <td className='text-center'>{item.code_id}</td>
                <td>{item.first_name + ' ' + item.last_name}</td>
                <td>{moment(item.birthday).format('DD/MM/YYYY')}</td>
                <td>{item.mobile_phone}</td>
                <td>{item.email}</td>
                <td>{item.village_name}</td>
                <td>{item.district_name}</td>
                <td>{item.province_name}</td>
                <td>{item.depart_name} </td>
                <td className='text-center'><a href="javascript:;"><i class="fa-solid fa-cloud-arrow-down text-red fs-4" /></a></td>
                <td className='text-center'>
                  <a href="javascript:;" onClick={() => viewUsers(item)}><i class="fa-solid fa-user-pen fs-4"></i></a>
                </td>
                <td className='text-center'>
                  <button className='btn btn-xs btn-blue me-1'><i class="fa-solid fa-pen-to-square" /></button>
                  <button className='btn btn-xs btn-red'><i class="fa-solid fa-trash" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="d-md-flex align-items-center">
              <div className="me-md-auto text-md-left text-center mb-2 mb-md-0">
                ສະແດງ {startIndex + 1} ຫາ
                {Math.min(endIndex, itemEmployee.length)} ຈາກທັງໝົດ {itemEmployee.length} ລາຍການ
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



      <UserPages
        open={open}
        handleClose={() => setOpen(false)}
        data={data}
      />

      <ViewProfile
        open={openView}
        handleClose={() => setOpenView(false)}
        data={dataView}
      />
    </div>
  )
}

export default EmployeePage