import React, { useState,useEffect } from 'react'
import { Link } from 'react-router-dom';
import { Input, InputGroup } from 'rsuite';
import FromDepart from './FromDepart';
import { Config } from '../../config/connection';
import axios from 'axios';
import { Notification } from '../../utils/Notification';
function Department() {
const api=Config.API;
  const [open, setOpen] = React.useState(false);
  const [data,setData]=useState({})
const handleOpen=()=>{
  setOpen(true)
}
const handleEdit=(item)=>{
  setData(item)
  setOpen(true)
}

const [itemDepart,setItemDepart]=useState([]);
const fetchDepart=async()=>{
  try {
    const response = await fetch(api + 'depart');
    const jsonData = await response.json();
    setItemDepart(jsonData);
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

const handleDeleete=(id)=>{
  axios.delete(api+'depart/'+id)
  .then(function(resp){
    if(resp.status===200){
      Notification.success('ການລຶບຂໍ້ມູນສຳເລັດ', 'ແຈ້ງເຕືອນ');
      fetchDepart()
    }
  }).catch((error) => {  // Fixed the syntax error here
    Notification.error('ການລຶບຂໍ້ມູນບໍ່ສຳເລັດ', 'ແຈ້ງເຕືອນ');
          });
}

useEffect(()=>{
  fetchDepart()
},[])
  return (
    <div id="content" class="app-content p-3 bg-component">

      <ol class="breadcrumb float-end">
        <li class="breadcrumb-item"><Link to={'/'}>ໜ້າຫຼັກ</Link></li>
        <li class="breadcrumb-item"><a href='javascript:;' onClick={handleOpen} className='text-blue'><i className='fas fa-plus'></i> ເພີ່ມພະແນກ</a></li>
        <li class="breadcrumb-item active">ຂໍ້ມູນພະແນກ</li>
      </ol>
      <h1 class="page-header">ຂໍ້ມູນພະແນກ </h1>

      <div className="row mb-3">
        <div className="col-sm-9"></div>
        <div className="col-sm-3">
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
          <thead>
            <tr>
              <th className='text-center w-2'>ລ/ດ</th>
              <th>ຊື່ພະແນກ</th>
              <th>ໝາຍເຫດ</th>
              <th className='text-center w-5'>ການຕັ້ງຄ່າ</th>
            </tr>
          </thead>
          <tbody className='fs-14px'>
            {itemDepart.map((item,index)=>(
            <tr>
              <td className='text-center'>{index+1}</td>
              <td>{item.depart_name}</td>
              <td>{item.depart_reamrk}</td>
              <td className='text-center'>
              <button type='button' onClick={()=>handleEdit(item)} className='btn btn-xs btn-blue me-1'><i class="fa-solid fa-pen-to-square"/></button>
              <button type='button' onClick={()=>handleDeleete(item.department_id)} className='btn btn-xs btn-red'><i class="fa-solid fa-trash"/></button>
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



      <FromDepart
      open={open}
      handleClose={()=>setOpen(false)}
      data={data}
      fetchData={fetchDepart}
 />
    </div>
  )
}

export default Department