import React from 'react'
import { Link } from 'react-router-dom'
function CheckinCheckout() {
    const inserts=localStorage.getItem('inserts');
    const handleNew = () => {
        
    }
  return (
     <div id="content" class="app-content p-3 bg-component">
         <ol class="breadcrumb float-end">
           <li class="breadcrumb-item"><Link to={'/'}>ໜ້າຫຼັກ</Link></li>
           <li class="breadcrumb-item"><a href='javascript:;' onClick={handleNew} className={`text-blue ${inserts === '2' && 'disabled'}`}><i className='fas fa-plus'></i> ລົງຂໍ້ມູນເຂົ້າອອກ</a></li>
           <li class="breadcrumb-item active">ຂໍ້ມູນການເຂົ້າອອກປະຈຳວັນ</li>
         </ol>
         <h1 className='page-header'>ຂໍ້ມູນການເຂົ້າອອກປະຈຳວັນ</h1>
         </div>
  )
}

export default CheckinCheckout