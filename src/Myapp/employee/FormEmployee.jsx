import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { DatePicker, Input, InputGroup, SelectPicker, Button, InputPicker } from 'rsuite'
import EyeCloseIcon from '@rsuite/icons/EyeClose';
import VisibleIcon from '@rsuite/icons/Visible';
import numeral from 'numeral';
import { useProvince, useDistrict, useDepart,useRights } from '../../config/selectOption';
import axios from 'axios';
import { Config } from '../../config/connection';
import { Notification } from '../../utils/Notification';
function FormEmployee() {
    const api=Config.API
    const itemProvince = useProvince();
    const itemDepart = useDepart();
    const itemRights=useRights();
    const [idProvince, setIdProvince] = useState(null);
    const itemDistrict = useDistrict(idProvince);
    const showDistrict = (value) => {
        setIdProvince(value);
    }

    const gender=[{
        label:'ເພດຍີງ',value:'F'
    },{
        label:'ເພດຊາຍ',value:'M'
    }]

    const [fileName, setFileName] = useState('');
    const handleChangeFile = (event) => {
        const file = event.target.files[0]
        if (file) {
            setFileName(file.name);
        }
        setInputs({
            ...inputs, document: file
        })
    };
    const handleMove = () => {
        setFileName('')
        setInputs({
            ...inputs, document: null
        })
    }
    const [visible, setVisible] = React.useState(false);
    const changePass = () => {
        setVisible(!visible);
    };

    const [showln, setShowln] = useState(false);
    const handleShow = (e) => {
        const isChecked = e.target.checked;
        setShowln((prevShow) => !prevShow);

        setInputs((prevInputs) => ({
            ...prevInputs,
            status_user: isChecked ? 1 : '' 
        }));
    }

    const [profileImage, setProfileImage] = useState('./assets/img/icon/icon-user.jpg');
    const [imgfile, setImgfile] = useState('')
    const changeProfile = (e) => {
        const file = e.target.files[0];
        setImgfile(file)
        if (file) {
            const imageURL = URL.createObjectURL(file);
            setProfileImage(imageURL);
        }
        setInputs({
            ...inputs, profile: file
        })
    };

    const moveProfile=()=>{
        setInputs({
            ...inputs, profile: ''
        })
        setImgfile('')
        setProfileImage('./assets/img/icon/icon-user.jpg')
    }

    const [inputs, setInputs] = useState({
        employeeId: '',
        profile: '',
        first_name: '',
        last_name: '',
        birthday: new Date(),
        gender: 'F',
        mobile_phone: '',
        email: '',
        district_id_fk: '',
        village_name: '',
        depart_id_fk: '',
        basic_salary: 0,
        document: '',
        status_user:'',
        userEmail:'',
        userPassword:'',
        rightsUse:''
    })
    const handleChange = (name, value) => {
        setInputs({
            ...inputs, [name]: value
        })
    }

    const handleSubmit= async (event)=>{
        event.preventDefault();
        const inputData = new FormData();
        for (const key in inputs) {
            inputData.append(key, inputs[key]);
        }
        try {
            const res = await axios.post(api + 'staff/create', inputData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            if (res.status === 200) {
                if (res.status === 200) {
                    Notification.success('ການບັນທຶກຂໍ້ມູນສຳເລັດ', 'ແຈ້ງເຕືອນ');
                } else {
                    Notification.error('ການບັນທຶກຂໍ້ມູນບໍ່ສຳເລັດ', 'ແຈ້ງເຕືອນ');
                }
            }
        } catch (error) {
            Notification.error('ການບັນທຶກຂໍ້ມູນບໍ່ສຳເລັດ', 'ແຈ້ງເຕືອນ');
        }
    }
    return (
        <>
            <div id="content" class="app-content d-flex flex-column p-2 bg-component">
               <form onSubmit={handleSubmit}>
                    <ol class="breadcrumb float-end">
                        <li class="breadcrumb-item"><Link to={'/'}>ໜ້າຫຼັກ</Link></li>
                        <li class="breadcrumb-item"><Link to={'/staff'}> ຂໍ້ມູນພະນັກງານ</Link></li>
                        <li class="breadcrumb-item active">ຟອມບັນທຶກພະນັກງານ</li>
                    </ol>
                    <h1 class="page-header">ຟອມບັນທຶກພະນັກງານ </h1>

                    <div className="row mt-4">
                        <div className="col-sm-7">
                            <div class="panel panel-default border" data-sortable-id="ui-widget-11">
                                <div class="panel-heading">
                                    <h4 class="panel-title fs-16px fs-bold"><i class="fa-solid fa-user"></i> ຂໍ້ມູນພະນັກງານ</h4>
                                </div>
                                <div class="panel-body">
                                    <div className="row mb-2">
                                        <label htmlFor="gender" className='form-label col-form-label col-md-4 text-md-end fs-bold'>ຊື່ພະນັກງານ: </label>
                                        <div className="col-md-2 col-sm-3 col-4">
                                                <InputPicker value={inputs.gender} data={gender} onChange={(e) => handleChange('gender', e)}  required />
                                        </div>
                                        <div className="col-md-6 col-sm-9 col-8">
                                            <InputGroup inside>
                                                <InputGroup.Addon>
                                                    <i class="fa-solid fa-user" />
                                                </InputGroup.Addon>
                                                <Input value={inputs.first_name} onChange={(e) => handleChange('first_name', e)} placeholder='ຊື່ພະນັກງານ' required />
                                            </InputGroup>
                                        </div>
                                    </div>
                                    <div className="row mb-2">
                                        <label htmlFor="last_name" className='form-label col-form-label col-md-4 text-md-end fs-bold'>ນາມສະກຸນ: </label>
                                        <div className="col-md-8 col-sm-12">
                                            <InputGroup inside>
                                                <InputGroup.Addon>
                                                    <i class="fa-solid fa-user" />
                                                </InputGroup.Addon>
                                                <Input value={inputs.last_name} onChange={(e) => handleChange('last_name', e)} placeholder='ນາມສະກຸນ' />
                                            </InputGroup>
                                        </div>
                                    </div>

                                    <div className="row mb-2">
                                        <label htmlFor="birthday" className='form-label col-form-label col-md-4 text-md-end fs-bold'>ວັນເດືອນປິເກີດ: </label>
                                        <div className="col-md-8 col-sm-12">
                                            <DatePicker oneTap format='dd/MM/yyyy' block value={inputs.birthday} onChange={(e) => handleChange('birthday', e)} required />
                                        </div>
                                    </div>
                                    <div className="row mb-2">
                                        <label htmlFor="mobile_phone" className='form-label col-form-label col-md-4 text-md-end fs-bold'>ເບີໂທລະສັບ: </label>
                                        <div className="col-md-8 col-sm-12">
                                            <InputGroup inside>
                                                <InputGroup.Addon className='fs-bold'>
                                                    020 :
                                                </InputGroup.Addon>
                                                <Input value={inputs.mobile_phone} onChange={(e) => handleChange('mobile_phone', e)} placeholder='999 99 999' required />
                                                <InputGroup.Addon>
                                                    <i className="fa-solid fa-phone" />
                                                </InputGroup.Addon>
                                            </InputGroup>
                                        </div>
                                    </div>

                                    <div className="row mb-2">
                                        <label htmlFor="email" className='form-label col-form-label col-md-4 text-md-end fs-bold'>ອີເມວ: </label>
                                        <div className="col-md-8 col-sm-12">
                                            <InputGroup inside>
                                                <InputGroup.Addon className='fs-bold'>
                                                    <i class="fa-solid fa-envelope" />
                                                </InputGroup.Addon>
                                                <Input value={inputs.email} onChange={(e) => handleChange('email', e)} placeholder='*****@gmail.com' />
                                            </InputGroup>
                                        </div>
                                    </div>

                                    <div className="row mb-2">
                                        <label htmlFor="province_fk" className='form-label col-form-label col-md-4 text-md-end fs-bold'>ເລືອກແຂວງ:</label>
                                        <div className="col-md-8 col-sm-12">
                                            <SelectPicker label={(
                                                <span>
                                                    <i class="fa-solid fa-location-dot" />
                                                </span>
                                            )} block data={itemProvince} onChange={(e) => showDistrict(e)} placeholder='ເລືອກແຂວງ' required />
                                        </div>
                                    </div>
                                    <div className="row mb-2">
                                        <label htmlFor="district_id_fk" className='form-label col-form-label col-md-4 text-md-end fs-bold'>ເລືອກເມືອງ:</label>
                                        <div className="col-md-8 col-sm-12">
                                            <SelectPicker label={(
                                                <span>
                                                    <i class="fa-solid fa-location-dot" />
                                                </span>
                                            )} block data={itemDistrict} value={inputs.district_id_fk} onChange={(e) => handleChange('district_id_fk', e)} placeholder='ເລືອກເມືອງ' required />
                                        </div>
                                    </div>

                                    <div className="row mb-2">
                                        <label htmlFor="village_name" className='form-label col-form-label col-md-4 text-md-end fs-bold'>ຊື່ພະນັກງານ:</label>
                                        <div className="col-md-8 col-sm-12">
                                            <InputGroup inside>
                                                <InputGroup.Addon>
                                                    <i class="fa-solid fa-home" />
                                                </InputGroup.Addon>
                                                <Input value={inputs.village_name} onChange={(e) => handleChange('village_name', e)} placeholder='ບ້ານ' required />
                                            </InputGroup>
                                        </div>
                                    </div>

                                    <div className="row mb-2">
                                        <label htmlFor="depart_id_fk" className='form-label col-form-label col-md-4 text-md-end fs-bold'>ພະແນກ:</label>
                                        <div className="col-md-8 col-sm-12">
                                            <SelectPicker value={inputs.depart_id_fk} data={itemDepart} onChange={(e) => handleChange('depart_id_fk', e)} block placeholder='ເລືອກພະແນກ' />
                                        </div>
                                    </div>
                                    <div className="row mb-2">
                                        <label htmlFor="basic_salary" className='form-label col-form-label col-md-4 text-md-end fs-bold'>ເງິນເດືອນພື້ນຖານ:</label>
                                        <div className="col-md-8 col-sm-12">
                                            <InputGroup inside>
                                                <InputGroup.Addon>
                                                    <i class="fa-solid fa-kip-sign" />
                                                </InputGroup.Addon>
                                                <Input type='tel' value={numeral(inputs.basic_salary).format('0,00')} onChange={(e) => handleChange('basic_salary', e)} placeholder='000,00' />
                                            </InputGroup>
                                        </div>
                                    </div>
                                    <div className="row mb-2">
                                        <label htmlFor="document" className='form-label col-form-label col-md-4 text-md-end fs-bold'>ເອກະສານ:</label>
                                        <div className="col-md-8 col-sm-12">
                                            <label className='btn btn-primary'> <input type="file" className='hide' onChange={handleChangeFile} accept="image/*" /> <i class="fa-solid fa-paperclip me-2" />  ເລືອກເອກະສານ...</label>
                                            {fileName && (
                                                <p className='mt-2'>
                                                    ຊື່ເອກະສານ: <span>{fileName}</span> <samp className='float-end text-red' onClick={handleMove} role='button'><i class="fa-solid fa-circle-xmark fs-4" /></samp>
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-sm-5">
                            <div class="panel panel-default border" data-sortable-id="ui-widget-13">
                                <div class="panel-heading">
                                    <h4 class="panel-title fs-16px fs-bold"><i class="fa-solid fa-user"></i> ໂປຣໄຟລ໌</h4>
                                </div>
                                <div className='panel-body text-center px-3'>
                                    <center>
                                        <div className="profile w-30">
                                            <img src={profileImage} className="w-100 rounded" alt="" />
                                            {imgfile && ( 
                                                <div className='move-profile text-red' onClick={moveProfile} role='button'><i className="fa-solid fa-circle-xmark fs-4" /></div>
                                            )}

                                        </div>
                                        <label className="btn btn-primary rounded-pill mt-2" role='button'>
                                            <input type="file" name='profile' onChange={changeProfile} accept="image/*" className='hide' />
                                            <i class="fa-solid fa-camera" /> ເລືອກຮູບ
                                        </label>
                                    </center>
                                </div>
                            </div>



                            <div class="panel panel-default border" data-sortable-id="ui-widget-12">
                                <div class="panel-heading">
                                    <h4 class="panel-title fs-16px fs-bold"><i class="fa-solid fa-user-lock"/> ຂໍ້ມູນຜູ້ເຂົ້າໃຊ້ລະບົບ</h4>
                                    <div class="panel-heading-btn">
                                        <div class="form-check form-switch">
                                            <input class="form-check-input" onChange={handleShow} type="checkbox" checked={showln} />
                                        </div>
                                    </div>
                                </div>
                                <div className={`panel-body px-3 ${showln ? '' : 'hide'}`}>
                                    <div className="form-group mb-2">
                                        <label htmlFor="userEmail" className='form-label'>ອີເມວຜູ້ໃຊ້ <span className='text-red'>*</span></label>
                                        <InputGroup inside>
                                            <InputGroup.Addon>
                                                <i class="fa-solid fa-user-lock" />
                                            </InputGroup.Addon>
                                            <Input value={inputs.userEmail} onChange={(e)=>handleChange('userEmail',e)} placeholder='***@gmail.com' />
                                        </InputGroup>
                                    </div>
                                    <div className="form-group mb-2">
                                        <label htmlFor="userPassword" className='form-label'>ລະຫັດຜ່ານ <span className='text-red'>*</span></label>
                                        <InputGroup inside >
                                            <Input type={visible ? 'text' : 'password'} value={inputs.userPassword} onChange={(e)=>handleChange('userPassword',e)} placeholder='ລະຫັດຜ່ານ' />
                                            <InputGroup.Button onClick={changePass}>
                                                {visible ? <VisibleIcon /> : <EyeCloseIcon />}
                                            </InputGroup.Button>
                                        </InputGroup>
                                    </div>
                                    <div className="form-group mb-2">
                                        <label htmlFor="rightsUse" className='form-label'>ສະຖານະ *</label>
                                        <SelectPicker block data={itemRights} value={inputs.rightsUse} onChange={(e)=>handleChange('rightsUse',e)} placeholder="ເລືອກສະຖານະ" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                <div class="app-footer border-top-0 p-2 m-0">
                    <div className="row">
                        <div className="col-6">
                            <Button color="red" appearance="primary" block>
                                ຍົກເລີກ
                            </Button></div>
                        <div className="col-6">
                            <Button type='submit' appearance="primary" block>
                                ບັນທຶກ
                            </Button>
                        </div>
                    </div>
                    </div>
                </form>
            </div>

        </>
    )
}

export default FormEmployee