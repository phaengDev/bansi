import React from 'react';
import { Button, Modal } from 'rsuite';
// import '../../assets/main-style.css'
function ViewIncome({open,handleClose,data}) {
  return (
    <>
    <Modal overflow={false} open={open} size='lg' onClose={handleClose}>
   <Modal.Header className='fs-bold'>ລາຍລະອຽດລາຍຮັບ</Modal.Header>
    <Modal.Body className='p-0'>
    <main className="main-wrapper position-relative">
        <div className="modern-invoice" >
            <div className="invoice-top">
                <div className="row align-items-center">
                    <div className="col-xl-6 col-lg-6 col-md-6 col-sm-6 text-center text-sm-start mb-3 mb-sm-1">
                        <img src="./assets/img/logo/plc2.png" className="img-fluid w-20" title="invoice" alt="invoice" />
                    </div>
                    <div className="col-xl-6 col-lg-6 col-md-6 col-sm-6 text-center text-sm-end mb-3 mb-sm-1">
                        <h4 className="text-35 text-uppercase mb-0 mt-0">No: 2432432 242
                            <div>Date: 12-12-2022</div>
                        </h4>
                    </div>
                </div>
            </div>
            <div className="invoice-details mt-20 pt-20">
                <div className="row">
                    <div className="col-sm-6 text-sm-end order-sm-1">
                        <strong className="text-18 mb-3 d-inline-block">ຮັບຈາກ: ໄພຳໄພຳໄ ໄພຳໄຫໄຳພໄຳ</strong>
                        <address className="mb-4">
                            initTheme<br />
                            1216 R. Dhaka, Bangladesh<br />
                            Bonani, OX Bokki<br />
                            contact@inittheme.com
                        </address>
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
                    <table className="table mb-0">
                    <thead className="card-header">
                        <tr className=''>
                            <td className="fs-bold">ລ/ດ</td>
                            <td className="fs-bold">ລາຍການ</td>
                            <td className="fs-bold">ປະເພດລາຍຮັບ</td>
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
                    <p>This is an electronic generated invoice so doesn't require any signature. </p>
                    <p>Please read all terms and polices on www.yourdomaon.com for returns, replacement and other issues.</p>
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

export default ViewIncome