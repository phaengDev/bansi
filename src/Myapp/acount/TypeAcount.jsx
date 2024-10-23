import React, { useState,useEffect } from 'react'
import { Link } from 'react-router-dom';
import { Input, SelectPicker, InputGroup } from 'rsuite';
import FromType from './FromType';
import { Config } from '../../config/connection';
function TypeAcount() {
  const api=Config.API;
const del=localStorage.getItem('deletes');
const edit=localStorage.getItem('edits');
const inserts=localStorage.getItem('inserts');

  const [open, setOpen] = React.useState(false);
  const [data,setData]=useState({});
const handleNew=()=>{
  setOpen(true)
  setData({})
}
const handleEdit=(item)=>{
  setOpen(true)
  setData(item)
}

const [filter, setFilter] = useState([]);
const [itemTypeList,setItemTypeList]=useState([]);
const showTypeList = async () => {
  try {
    const response = await fetch(api + 'type/list');
    const jsonData = await response.json();
    setItemTypeList(jsonData);
    setFilter(jsonData)
  } catch (error) {
    console.error('Error fetching data:', error);
  }
};

const handleFilter=(value)=>{
  const filteredData = filter.filter((item) => {
    return (
      item.type_code.toLowerCase().includes(value.toLowerCase()) || 
      item.code_list.toLowerCase().includes(value.toLowerCase()) || 
      item.type_list_name.toLowerCase().includes(value.toLowerCase())
    );
  });

  setItemTypeList(filteredData);
}


useEffect(()=>{
  showTypeList();
},[])
  return (
    <div id="content" class="app-content p-3 bg-component">

      <ol class="breadcrumb float-end">
        <li class="breadcrumb-item"><Link to={'/'}>ໜ້າຫຼັກ</Link></li>
        <li class="breadcrumb-item"><a href='javascript:;' onClick={handleNew} className={`text-blue ${inserts ==='2' &&'disabled'}`}><i className='fas fa-plus'></i> ເພີ່ມປະເພດ</a></li>
        <li class="breadcrumb-item active">ຂໍ້ມູນປະເພດບັນຊີ</li>
      </ol>
      <h1 class="page-header">ຂໍ້ມູນປະເພດບັນຊີ </h1>

      <div className="row mb-3">
        <div className="col-sm-9"></div>
        <div className="col-sm-3">
          <label htmlFor="" className='form-label'>ຄົນຫາ</label>
          <InputGroup inside >
            <InputGroup.Addon>
              <i className='fas fa-search' />
            </InputGroup.Addon>
            <Input onChange={(e)=>handleFilter(e)} placeholder='ຄົ້ນຫາ...' />
          </InputGroup>
        </div>
      </div>
      
      <div className="table-responsive">
        <table class="table table-striped table-bordered align-middle text-nowrap">
          <thead>
            <tr>
              <th className='text-center w-2'>ລ/ດ</th>
              <th className='text-center w-10' >ໝວດບັນຊີ</th>
              <th className='text-center w-10' >ລະຫັດບັນຊີ</th>
              <th>ຊື່ປະເພດ</th>
              <th className='text-center w-5'>ການຕັ້ງຄ່າ</th>
            </tr>
          </thead>
          <tbody className='fs-14px'>
            {itemTypeList.map((item,index)=>(
            <tr>
              <td className='text-center'>{index+1}</td>
              <td>{item.type_code} / {item.type_name}</td>
              <td className='text-center'>{item.code_list}</td>
              <td>{item.type_list_name}</td>
              <td className='text-center'>
                <button onClick={()=>handleEdit(item)} className={`btn btn-xs btn-blue me-2 ${edit==='2' &&'disabled'}`}><i class="fa-solid fa-pen-to-square"/></button>
                <button className={`btn btn-xs btn-red me-2 ${del==='2' &&'disabled'}`}><i class="fa-solid fa-trash"/></button>
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



      <FromType
      open={open}
      handleClose={()=>setOpen(false)}
      data={data}
      fetchData={showTypeList}
      />
    </div>
  )
}

export default TypeAcount