import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom';
import FormAddAcount from './FormAddAcount';
import numeral from 'numeral';
import { Config } from '../../config/connection';
function TreasuryAccounts() {
    const api = Config.API;
    const inserts = localStorage.getItem('inserts');
    const status_ck = localStorage.getItem('status_ck');
    const [open, setOpen] = React.useState(false);
    const [data, setData] = useState('')
    const handleNew = () => {
        setOpen(true);
    }
    const [itemData, setItemData] = useState([]);
    const fetchData = async () => {
        try {
            const response = await fetch(api + 'acounts');
            const jsonData = await response.json();
            setItemData(jsonData);
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    }

    const totalsByGenus = itemData.reduce((acc, item) => {
        const key = item.currency_id_fk;
        // If the group doesn't exist, initialize it
        if (!acc[key]) {
            acc[key] = {
                balance_treasury: 0,
                balance_unable: 0,
                genus_laos: item.genus_laos,
                genus: item.genus // Preserve genus_laos for this group
            };
        }
        const treasury = parseFloat(item.balance_treasury) || 0;
        const unable = parseFloat(item.balance_unable) || 0;

        acc[key].balance_treasury += treasury;
        acc[key].balance_unable += unable;
        return acc;
    }, {});

    const [hoveredRow, setHoveredRow] = useState(null);
    const handleEdit=(item)=>{
    setData(item)
    setOpen(true)
    }
    useEffect(() => {
        fetchData();
    })
    return (
        <div id="content" class="app-content p-3 bg-component">
            <ol class="breadcrumb float-end">
                <li class="breadcrumb-item"><Link to={'/'}>ໜ້າຫຼັກ</Link></li>
                <li class="breadcrumb-item"><a href='javascript:;' onClick={handleNew} className={`text-blue ${inserts === '2' && status_ck === '2' && 'disabled'}`}><i className='fas fa-plus'></i> ເພີ່ມບັນຊີ</a></li>
                <li class="breadcrumb-item active">ບັນຊີເງິນຄັງ</li>
            </ol>
            <h1 class="page-header">ບັນຊີເງິນຄັງ </h1>
            <div class="panel border panel-default" data-sortable-id="ui-widget-11">
                <div class="panel-heading ui-sortable-handle">
                    <h4 class="panel-title fs-bold fs-20px">ສະຫຼຸບຍອດບັນຊີ</h4>
                    <div class="panel-heading-btn">
                        <a href="javascript:;" class="btn btn-xs btn-icon btn-default" data-toggle="panel-expand"><i class="fa fa-expand"></i></a>
                    </div>
                </div>
                <div class="panel-body">
                    <div class="table-responsive">
                        <table class="table table-striped table-bordered align-middle text-nowrap">
                            <thead>
                                <tr>
                                    <th width="1%">ລ/ດ</th>
                                    <th width="40%">ເລກບັນຊີ</th>
                                    <th width="10%" className='text-end'>ສະກຸນເງິນ</th>
                                    <th className='text-end'>ຍອດເງິນທັງໝົດ</th>
                                    <th className='text-end'>ຍອດເງິນທີ່ໃຊ້ບໍ່ໄດ້</th>
                                    <th className='text-end'>ຍອດເງິນທີ່ໃຊ້ໄດ້</th>
                                </tr>
                            </thead>
                            <tbody className='fs-bold'>
                                {itemData.map((item, index) => (
                                    <tr key={index} onMouseEnter={() => setHoveredRow(index)}  onMouseLeave={() => setHoveredRow(null)}>
                                        <td className='fs-bold text-center'>{index + 1}</td>
                                        <td className='fs-bold'>{item.acount_number}:  {item.acountName} <span className='text-red'>({item.currency})</span>
                                            {hoveredRow === index && status_ck === '1' && ( 
                                                <span
                                                    role="button"
                                                    onClick={() => handleEdit(item)}
                                                    className="ms-2 text-green">
                                                    <i className="fa-solid fa-pen-to-square fs-4" />
                                                </span>
                                            )}
                                        </td>
                                        <td className='text-end fs-bold'>{item.genus_laos}</td>
                                        <td className='text-end fs-bold'>{numeral(item.balance_treasury).format('0,0.00')}	{item.genus}</td>
                                        <td className='text-end fs-bold text-red'>{numeral(item.balance_unable).format('0,0.00')} {item.genus}</td>
                                        <td className='text-end fs-bold text-green'>{numeral(item.balance_treasury - item.balance_unable).format('0,0.00')} {item.genus}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={6} className='py-3 bg-red-200'></td>
                                </tr>
                                {Object.keys(totalsByGenus).map((key, index) => (
                                    <tr key={index}>
                                        <td colSpan={2}></td>
                                        <td className="text-end fs-bold">{totalsByGenus[key].genus_laos}</td>
                                        <td className="text-end fs-bold">
                                            {numeral(totalsByGenus[key].balance_treasury).format('0,0.00')} {totalsByGenus[key].genus}
                                        </td>
                                        <td className="text-end fs-bold text-red">
                                            {numeral(totalsByGenus[key].balance_unable).format('0,0.00')} {totalsByGenus[key].genus}
                                        </td>
                                        <td className="text-end fs-bold text-green">
                                            {numeral(
                                                totalsByGenus[key].balance_treasury - totalsByGenus[key].balance_unable
                                            ).format('0,0.00')} {totalsByGenus[key].genus}
                                        </td>
                                    </tr>
                                ))}
                            </tfoot>
                        </table>
                    </div>

                </div>

            </div>



            <FormAddAcount
                open={open}
                handleClose={() => setOpen(false)}
                data={data}
                fetchData={fetchData}
            />
        </div>
    )
}

export default TreasuryAccounts