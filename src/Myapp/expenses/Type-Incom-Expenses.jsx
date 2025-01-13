import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import FromIncomExpenses from './From-Incom-Expenses'
import { Config } from '../../config/connection'
import { Input,InputGroup,InputPicker } from 'rsuite'
import { usePage } from '../../config/selectOption'
function TypeIncomExpenses() {
  const api = Config.API;
  const inserts = localStorage.getItem('inserts');
  const deletes = localStorage.getItem('deletes');
  const edits = localStorage.getItem('edits');
  const [open, setOpen] = React.useState(false);
  const [data, setData] = useState({})
  const handleNew = () => {
    setOpen(true);
    setData({});
  }
  const handleEdit = (item) => {
    setOpen(true)
    setData(item)
  }

  const [pages,setPages]=useState(0);

  const [itemType, setItemType] = useState([]);
  const [dataFilter, setDataFilter] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const fetchData = async () => {
    try {
      const response = await fetch(api + 'inex');
      const jsonData = await response.json();
      setItemType(jsonData);
      setDataFilter(jsonData)
      setPages(jsonData.length);

    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleFilter=(value)=>{
    const filteredData = dataFilter.filter((item) => {
      return (
        item.type_code.toLowerCase().includes(value.toLowerCase()) || 
        item.in_ex_name.toLowerCase().includes(value.toLowerCase())
      );
    });
    setItemType(filteredData);
  }


  const handleShowLimit = (value) => {
    const limit = parseInt(value, 25);
    setItemsPerPage(limit > 0 ? limit : pages); 
  };


  const totalPages = Math.ceil(itemType.length / itemsPerPage);
  const paginatedItems = itemType.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);


  useEffect(() => {
    fetchData();
  }, []);

const dataPage=usePage(pages)
  return (
    <div id="content" class="app-content p-3 bg-component">
      <ol class="breadcrumb float-end">
        <li class="breadcrumb-item"><Link to={'/'}>ໜ້າຫຼັກ</Link></li>
        <li class="breadcrumb-item"><a href='javascript:;' onClick={handleNew} className={`text-blue ${inserts === '2' && 'disabled'}`}><i className='fas fa-plus'></i> ເພີ່ມປະເພດ</a></li>
        <li class="breadcrumb-item active">ປະເພດລາຍຮັບ ລາຍຈ່າຍ</li>
      </ol>
      <h1 class="page-header">ປະເພດລາຍຮັບ ລາຍຈ່າຍ </h1>
      <div>
      <div class="d-lg-flex align-items-center mb-3">
					<div class="d-lg-flex d-none align-items-center text-nowrap">
					ສະແດງ:
          <select onChange={(e) => handleShowLimit(e.target.value)} class="form-select form-select-sm ms-2 border-blue">
            {dataPage.map((data)=>
							<option value={data.value}>{data.label}</option>
            )}
						</select>
					</div>
					<div class="d-lg-block d-none ms-2 text-body text-opacity-50">
					ລາຍການ 
					</div>
					
					<div class="pagination pagination-sm mb-0 ms-auto justify-content-center">
            <InputGroup inside>
            <InputGroup.Addon> <i className="fas fa-search"></i> </InputGroup.Addon>
						<Input onChange={(e)=>handleFilter(e)} placeholder='ຄົ້ນຫາ...'/>
            </InputGroup>
					</div>
				</div>
        <div class="table-responsive">
          <table class="table table-bordered align-middle table-striped table-hover text-nno text-nowrap">
            <thead>
              <tr>
                <th className='text-center w-5'>ລ/ດ</th>
                <th className='w-15'>ສະຖານະ</th>
                <th className='text-center w-15'>ລະຫັດປະເພດ</th>
                <th className=''>ຊື່ປະເພດ</th>
                <th className='text-center w-10'>ຕັ້ງຄ່າ</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item, index) => (
                <tr key={index}>
                  <td className='text-center'>{index + 1}</td>
                  <td>{item.statusCode ===1001 ? (<i class="fa-solid fa-sort-down fs-4 text-green"/>):(<i class="fa-solid fa-caret-up fs-4 text-red"/>)}: {item.statusName}</td>
                  <td className='text-center'>{item.type_code}</td>
                  <td>{item.in_ex_name}</td>
                  <td className='text-center'>
                    <button type='button' onClick={() => handleEdit(item)} className='btn btn-xs btn-blue me-2' disabled={edits === '2' ? true:false}><i class="fa-solid fa-pen-to-square" /></button>
                    <button type='button' className='btn btn-xs btn-red' disabled ={deletes=== '2' ? true:false}><i class="fa-solid fa-trash" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div class="d-md-flex align-items-center">
        <div className="me-md-auto text-md-left text-center mb-2 mb-md-0">
          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, itemType.length)} of {itemType.length} entries
        </div>
        <ul className="pagination mb-0 justify-content-center">
          <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
            <a className="page-link" onClick={() => setCurrentPage(currentPage - 1)}>Previous</a>
          </li>
          {[...Array(totalPages)].map((_, index) => (
            <li className={`page-item ${currentPage === index + 1 ? 'active' : ''}`} key={index}>
              <a className="page-link" onClick={() => setCurrentPage(index + 1)}>{index + 1}</a>
            </li>
          ))}
          <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
            <a className="page-link" onClick={() => setCurrentPage(currentPage + 1)}>Next</a>
          </li>
        </ul>
        </div>
      </div>
      <FromIncomExpenses
        open={open}
        handleClose={() => setOpen(false)}
        data={data}
        fetchData={fetchData}
      />
    </div>
  )
}

export default TypeIncomExpenses