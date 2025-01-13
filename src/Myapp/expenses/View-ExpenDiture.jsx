import React from 'react'
import { Button, Modal } from 'rsuite';
import moment from 'moment';
function ViewExpenDiture({open,handleClose,data}) {
  return (
    <>
    <Modal overflow={false} open={open} size='lg' onClose={handleClose}>
   <Modal.Header className='fs-bold'>ລາຍລະອຽດລາຍຈ່າຍ</Modal.Header>
    <Modal.Body className='p-0'>
    <main className="main-wrapper position-relative">
        <div className="modern-invoice" >
            <div className="invoice-top">
                <div className="row align-items-center">
                    <div className="col-xl-6 col-lg-6 col-md-6 col-sm-6 text-center text-sm-start mb-3 mb-sm-1">
                        <img src="./assets/img/logo/plc2.png" className="img-fluid w-20" title="invoice" alt="invoice" />
                    </div>
                    <div className="col-xl-6 col-lg-6 col-md-6 col-sm-6 text-center text-sm-end mb-3 mb-sm-1">
                        <h4 className="text-35 mb-0 mt-0">No: {data.expenditure_no}
                            <div className='fw-normal'>Date: {moment(data.expenditure_date).format('DD/MM/YYYY')}</div>
                        </h4>
                    </div>
                </div>
            </div>
            <div className="invoice-details mt-20 pt-20">
                <div className="row">
                    <div className="col-sm-6  order-sm-1">
                        <table className='w-100 text-nowrap'>
                        <tr>
                            <td className='text-end'><span className='me-1 fs-bold'>ຫົວຂໍ້ລາຍຈ່າຍ:</span></td>
                            <td className='w-30'>{data.expenditure_name}</td>
                        </tr>
                        <tr>
                            <td className='text-end'><span className='me-1 fs-bold'>ປະເພດລາຍຈ່າຍ:</span></td>
                            <td className='w-30'>{data.in_ex_name}</td>
                        </tr>
                        <tr>
                            <td className='text-end'><span className='me-1 fs-bold'>ປະເພດບັນຊີ:</span></td>
                            <td className='w-30'>{data.type_name}</td>
                        </tr>
                        <tr>
                            <td className='text-end'><span className='me-1 fs-bold'>ບັນຊີເງິນຄັງ:</span></td>
                            <td className='w-30'>{data.acount_number} {data.currency}</td>
                        </tr>
                        </table>
                        
                    </div>
                    <div className="col-sm-6 order-sm-0">
                        <strong className="text-18 mb-3 d-inline-block">Invoiced To:</strong>
                        <address className="mb-4">
                            Rafsan Jani<br/>
                            16/10 A Banasree<br/>
                            1508C uttor AN<br/>
                            kolkata , india
                        </address>
                    </div>
                </div>
            </div>
            <div className="card mb-3 border-0">
                <div className="card-body p-0">
                    <div className="table-responsive">
                    <table className="table mb-0 text-nowrap">
                    <thead className="card-header">
                        <tr className=''>
                            <td className="fs-bold">ລ/ດ</td>
                            <td className="fs-bold">ລາຍການ</td>
                            <td className="fs-bold">ປະເພດລາຍຈ່າຍ</td>
                            <td className="fs-bold text-end">ຍອດເງິນ</td>
                            <td className="fs-bold text-center">ອາກອນ</td>
                            <td className="fs-bold text-end">ລວມເງິນ</td>
                        </tr>
                    </thead>
                        <tbody>
                            <tr>
                                <td className="">1</td>
                                <td className="">PHP Develop</td>
                                <td className="text-center">$100.00</td>
                                <td className="text-center">5</td>
                                <td className="text-end">$500.00</td>
                                <td className="text-end">$500.00</td>
                            </tr>
                            <tr>
                                <td>2</td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td>-</td>
                            </tr>
                            <tr>
                                <td>3</td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td>-</td>
                            </tr>
                        </tbody>
                        <tfoot>
                            <tr  className="">
                                <td colspan="5" className="text-end border-bottom-0 fs-bold">ທັງໝົດຍ່ອຍ:</td>
                                <td className="text-end bg-gray-200">$2150.00</td>
                            </tr>
                            <tr>
                                <td colspan="5" className="text-end border-bottom-0 fs-bold">ອາກອນ:</td>
                                <td className="text-end">$215.00</td>
                            </tr>
                            <tr>
                                <td colspan="5" className="text-end border-bottom-0 fs-bold">ລວມທັງໝົດ:</td>
                                <td className="text-end border-bottom-0">$2365.00</td>
                            </tr>
                        </tfoot>
                    </table>
                    </div>
                </div>
            </div>
            <div className="row">
                <div className="col-sm-12 mb-10">
                    <h5 className="mb-2 text-title font-700"> ລາຍລະອຽດ: </h5>
                    <p>{data.description} </p>
                </div>
            </div>
            <div className="footer-shape">
                <svg viewBox="0 0 500 200">
                    <path d="M 0 50 C 150 50 300 0 500 80 L 500 0 L 0 0" fill="#f73e4c"></path>
                    <path d="M 0 50 C 100 50 330 -30 500 50 L 500 0 L 0 0" fill="#014584" ></path>
                <path d="M 0 50 C 215 50 250 0 500 100 L 500 0 L 0 0" fill="#07cef6" opacity="0.1"></path>
                </svg>
            </div>
        </div>
       
    </main>
    </Modal.Body>
    </Modal>
    </>
  )
}

export default ViewExpenDiture