import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom';
import SearchIcon from '@rsuite/icons/Search';
import { Grid, Row, Col, Input, DatePicker, SelectPicker, Button, InputPicker, InputGroup, Loader, Placeholder } from 'rsuite';
import FormLeave from './Form-Leave';
import { Config, UrlImg } from '../../config/connection';
import { useDepart, useTypeLeave,usePage } from '../../config/selectOption';
import axios from 'axios';
import moment from 'moment';
import FileDownloadIcon from '@rsuite/icons/FileDownload';
function RequestLeave() {
    const api = Config.API;
    const url = UrlImg.URL;
    const inserts = parseInt(localStorage.getItem('inserts') || '0', 10);
    const edits = parseInt(localStorage.getItem('edits') || '0', 10);
    const deletes = parseInt(localStorage.getItem('deletes') || '0', 10);

    const depart = useDepart();
    const typeLeave = useTypeLeave();
    const [open, setOpen] = useState(false);
    const [data, setData] = useState(null);
    const handleNew = () => {
        setOpen(true);
        setData(null);
    }
    const handleEdit = (data) => {
        setOpen(true);
        setData(data);
    }

    const [valeus, setValues] = useState({
        start_date: new Date(),
        end_date: new Date(),
        type_leave: '',
        confirm: '',
        depart_id_fk: '',
    });

    const [isloading, setIsloading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage,setItemsPerPage] =useState(50);
    const [itemData, setItemData] = useState([]);
    const [totalItems, setTotalItems] = useState(0);
    const page = usePage(totalItems);
    const [filteredData, setFilteredData] = useState([]);
    const fetchData = async () => {
        setIsloading(true);
        try {
            const response = await axios.post(api + 'leave/fetch', valeus);
            const jsonData = response.data;
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

    const handleFillter=(value)=>{
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
    const handleDownload = async (fileName) => {
        const filePath = url + 'document/' + fileName; 
        try {
            const response = await fetch(filePath); // Replace with your server URL
            if (!response.ok) {
                throw new Error('File download failed');
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (error) {
            Notification.error('Failed to download the file. Please try again.','Error');
        }
    };
       

    useEffect(() => {
        fetchData();
    }, []);
    return (
        <div id="content" class="app-content p-3 bg-component">
            <ol class="breadcrumb float-end">
                <li class="breadcrumb-item"><Link to={'/'}>ໜ້າຫຼັກ</Link></li>
                <li class="breadcrumb-item"><a href='javascript:;' onClick={handleNew} className={`text-blue ${inserts === '2' && 'disabled'}`}><i className='fas fa-plus'></i> ລົງຂໍ້ມູນລາພັກ</a></li>
                <li class="breadcrumb-item active">ຂໍ້ມູນການລາພັກ</li>
            </ol>
            <h1 className='page-header'>ຂໍ້ມູນການລາພັກປະຈຳວັນ</h1>
            <div className="panel">
                <div className="panel-body">
                    <Grid fluid className='mb-2'>
                        <Row>
                            <Col xs={12} md={8} lg={4} className='mb-2'>
                                <div className="form-group">
                                    <label className='form-label'>ວັນທີລາພັກ</label>
                                    <DatePicker oneTap value={valeus.start_date} format='dd/MM/yyyy' onChange={(e) => setValues({ ...valeus, start_date: e })} block />
                                </div>
                            </Col>
                            <Col xs={12} md={8} lg={4} className='mb-2'>
                                <div className="form-group">
                                    <label className='form-label'>ວັນທີລາພັກ</label>
                                    <DatePicker oneTap value={valeus.end_date} format='dd/MM/yyyy' onChange={(e) => setValues({ ...valeus, end_date: e })} block />
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
                                    <SelectPicker data={typeLeave} value={valeus.type_leave} onChange={(e) => setValues({ ...valeus, type_leave: e })} block placeholder='ທັງໝົດ' />
                                </div>
                            </Col>
                            <Col xs={18} md={6} lg={4} className='mb-2'>
                                <div className="form-group">
                                    <label className='form-label'>ສະຖານະ</label>
                                    <InputPicker data={[
                                        { label: 'ອະນຸມັດແລ້ວ', value: 1 },
                                        { label: 'ຄ້າງອະນຸມັດ', value: 2 },
                                    ]} value={valeus.confirm} placeholder='ທັງໝົດ' onChange={(e) => setValues({ ...valeus, confirm: e })} block />
                                </div>
                            </Col>
                            <Col xs={4} md={4} lg={2} className='mb-2'>
                                <Button type='button' appearance="primary" onClick={fetchData} className='mt-4' >ຄົ້ນຫາ</Button>
                            </Col>
                        </Row>

                        <Row className=" mt-2">
                            <Col xs={6} md={4} lg={2} className='mb-2'>
                                <InputPicker data={page} value={itemsPerPage} onChange={(valeus)=>setItemsPerPage(valeus)} block />
                            </Col>

                            <Col xs={12} xsPush={6} md={10} mdPush={10} lg={7} lgPush={15}>
                                <InputGroup inside>
                                    <InputGroup.Addon><SearchIcon /></InputGroup.Addon>
                                    <Input onChange={(value) => handleFillter(value)} placeholder='ຄົ້ນຫາ...' block />
                                </InputGroup>
                            </Col>
                        </Row>
                    </Grid>
                    <div className="table-responsive">
                        <table className="table table-bordered table-striped text-nowrap">
                            <thead>
                                <tr>
                                    <th className='text-center'>ລຳດັບ</th>
                                    <th>ວັນທີສົ່ງຄຳຂໍ</th>
                                    <th>ພະນັກງານ</th>
                                    <th>ພະແນກ</th>
                                    <th>ວັນທີລາພັກ</th>
                                    <th>ຫາວັນທີ</th>
                                    <th className='text-center'>ຈຳນວນ</th>
                                    <th>ປະເພດ</th>
                                    <th>ສະຖານະ</th>
                                    <th>ລາຍລະອຽດ</th>
                                    <th className='w-5  text-center'>ຕັ້ງຄ່າ</th>
                                </tr>
                            </thead>

                            <tbody>
                                {isloading ? (<tr className='border-0'>
                                    <td colSpan='11' className='text-center border-0 bg-white'>
                                        <Placeholder.Grid rows={5} columns={6} active />
                                        <Loader center size='lg' content="ກຳລັງໂຫລດ...." vertical />
                                    </td>
                                </tr>) : (
                                    <>
                                        {currentItems.length > 0 ?
                                        
                                        currentItems.map((item, index) => (
                                            <tr key={index}>
                                                <td className='text-center'>{index + 1}</td>
                                                <td>{moment(item.request_date).format('DD/MM/YYYY')}</td>
                                                <td>{item.first_name + ' ' + item.last_name}</td>
                                                <td>{item.depart_name}</td>
                                                <td>{moment(item.start_date).format('DD/MM/YYYY')}</td>
                                                <td>{moment(item.end_date).format('DD/MM/YYYY')}</td>
                                                <td className='text-center'>{item.days} ວັນ</td>
                                                <td>{item.typeName}</td>
                                                <td>{item.confirm === 1 ? (<span className='text-orange'>ຄ້າງອະນຸມັດ</span>) : (<span className='text-green'>ອະນຸມັດແລ້ວ</span>)}</td>
                                                <td>{item.description}</td>
                                                <td className='text-center'>
                                                    {item.file_leave && (
                                                    <button type='button' onClick={() => handleDownload(item.file_leave)} className='btn btn-xs btn-green me-1'><FileDownloadIcon/> </button>
                                                    )}
                                                    {item.confirm === 1 && (<>
                                                        {edits === 1 && (
                                                        <button type='button' onClick={() => handleEdit(item)} className='btn btn-xs btn-primary me-1'><i className='fas fa-edit'></i> </button>
                                                    )}
                                                    {deletes === 1 && (
                                                        <button type='button' className='btn btn-xs btn-danger'><i className='fas fa-trash'></i> </button>
                                                    )}
                                                    </>)}
                                                </td>
                                            </tr>
                                        ))
                                    : (
                                        <tr className='border-0'>
                                            <td colSpan='11' className='text-center border-0'>
                                        <img src={'../assets/img/icon/notSearch.png'} className='w-20' />
                                            <p className='text-red'>ບໍ່ພົບຂໍ້ມູນຂອງການລາພັກ....</p>
                                            </td>
                                        </tr>
                                    )}
                                    </>
                                )}
                            </tbody>

                        </table>
                    </div>
                    { currentItems.length > 0 && (
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
                <FormLeave open={open} hancleClose={() => setOpen(false)} data={data} fetchData={fetchData} />
            )}
        </div>
    )
}

export default RequestLeave