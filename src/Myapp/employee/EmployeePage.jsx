import React,{useState,useEffect} from 'react'
import { Link } from 'react-router-dom';
import { Input, SelectPicker, InputGroup } from 'rsuite';
import { Config,UrlImg } from '../../config/connection';
import moment from 'moment';
import axios from 'axios';
import UserPages from './UserPages';
function EmployeePage() {
const api=Config.API;
const img=UrlImg.URL;

const [values,setValues]=useState({
  district_id_fk:'',
  province_id_fk:'',
  depart_id_fk:''
})

const handleSearch=(name,value)=>{
  setValues({
    ...values,[name]:value
  })
}

const [itemEmployee,setItemEmployee]=useState([]);
const [filter,setFilter]=useState([]);
const [loading,setLoading]=useState(true)
const fetchEmployee=async()=>{
  setLoading(true)
  try {
    const response = await axios.post(api + 'staff/fetch', values);
    setItemEmployee(response.data);
    setFilter(response.data)
} catch (error) {
    console.error('Error fetching data:', error);
} finally {
    setLoading(false);
}
}

const [open, setOpen] = React.useState(false);
const imgUser='./assets/img/icon/user.png';
const [data,setData]=useState({})
const viewUsers=(data)=>{
  setData(data)
  setOpen(true)
}

useEffect(()=>{
  fetchEmployee();
},[])
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
          <SelectPicker block value={values.depart_id_fk} onChange={(e)=>handleSearch('depart_id_fk',e)} placeholder='ເລືອກ' />
        </div>
        <div className="col-sm-3 col-6 mb-2">
          <label htmlFor="" className='form-label'>ແຂວງ</label>
          <SelectPicker block value={values.province_id_fk} onChange={(e)=>handleSearch('province_id_fk',e)} />
        </div>
        <div className="col-sm-3 col-6  mb-2">
          <label htmlFor="" className='form-label'>ເມືອງ</label>
          <SelectPicker block value={values.district_id_fk} onChange={(e)=>handleSearch('district_id_fk',e)} />
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
              <th className='text-center'><i class="fa-solid fa-user-lock"/></th>
              <th className='text-center'>ການຕັ້ງຄ່າ</th>
            </tr>
          </thead>
          <tbody className='fs-14px'>
            {itemEmployee.map((item,index)=>(
            <tr>
              <td className='text-center'>{item.id}</td>
              <td className='text-center with-img'><img src={item.profile !=='' ? img+'profile/'+item.profile:imgUser} class="rounded h-30px my-n1 mx-n1" /></td>
              <td className='text-center'>{item.code_id}</td>
              <td>{item.first_name+' '+item.last_name}</td>
              <td>{moment(item.birthday).format('DD/MM/YYYY')}</td>
              <td>{item.mobile_phone}</td>
              <td>{item.email}</td>
              <td>{item.village_name}</td>
              <td>{item.district_name}</td>
              <td>{item.province_name}</td>
              <td>{item.depart_name}</td>
              <td className='text-center'><a href="javascript:;"><i class="fa-solid fa-cloud-arrow-down text-red fs-4"/></a></td>
              <td className='text-center'>
              <a href="javascript:;" onClick={()=>viewUsers(item)}><i class="fa-solid fa-user-pen fs-4"></i></a>
              </td>
              <td className='text-center'>
              <button className='btn btn-xs btn-blue me-1'><i class="fa-solid fa-pen-to-square"/></button>
              <button className='btn btn-xs btn-red'><i class="fa-solid fa-trash"/></button>
              </td>
            </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div class="d-md-flex align-items-center">
        <div class="me-md-auto text-md-left text-center mb-2 mb-md-0">
          Showing 1 to 10 of 57 entries
        </div>
        <ul class="pagination mb-0 justify-content-center">
          <li class="page-item disabled"><a class="page-link">ກ່ອນຫນ້ານີ້</a></li>
          <li class="page-item active"><a class="page-link" href="javascript:;">1</a></li>
          <li class="page-item"><a class="page-link" href="javascript:;">2</a></li>
          <li class="page-item"><a class="page-link" href="javascript:;">3</a></li>
          <li class="page-item"><a class="page-link" href="javascript:;">4</a></li>
          <li class="page-item"><a class="page-link" href="javascript:;">5</a></li>
          <li class="page-item"><a class="page-link" href="javascript:;">6</a></li>
          <li class="page-item"><a class="page-link" href="javascript:;">ໜ້າຕໍ່ໄປ</a></li>
        </ul>
      </div>



      <UserPages
      open={open}
      handleClose={()=>setOpen(false)}
      data={data}
      />
    </div>
  )
}

export default EmployeePage