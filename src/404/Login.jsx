import React, { useState } from 'react'
import { Config } from '../config/connection';
import { Loader ,Placeholder} from 'rsuite';
import axios from 'axios';
import { Notification } from '../utils/Notification';
export default function Login() {
    const api = Config.API
    const [inputs, setInputs] = useState({
        userEmail: '',
        userPassword: ''
    })

    const handleChange = (name, value) => {
        setInputs({
            ...inputs, [name]: value
        })
    }
    const [isLoading, setIsLoading] = useState(false)
    const handleSumint = async (event) => {
        event.preventDefault()
        setIsLoading(true)
        try {
            const resp = await axios.post(api + 'login/check', inputs);
            if (resp.status === 200) {
                const { username, useremail, userid, employee_id,departName,profile, token, inserts,edits,deletes,status_ck } = resp.data; 
                localStorage.setItem('username', username);
                localStorage.setItem('useremail', useremail);
                localStorage.setItem('userid', userid);
                localStorage.setItem('employee_id', employee_id);
                localStorage.setItem('token', token);
                localStorage.setItem('inserts', inserts);
                localStorage.setItem('edits',edits);
                localStorage.setItem('deletes',deletes);
                localStorage.setItem('status_ck',status_ck);
                localStorage.setItem('departName',departName);
                localStorage.setItem('profile',profile)
                // navigate('/');
                window.location.href='/';
            }
        } catch {
            Notification.error('ການເຂົ້າສູ່ລະບົບບໍສຳເລັດ ກະລຸນາລອງໃໝ່','ຂໍອະໄພ')
        } finally {
            setIsLoading(false);
          }
    }

   
    return (
        <>

            <div id="app" className="app">
                <div className="login login-v2 fw-bold bg-dark  rounded-0">
                    <div className="login-container bg-white p-4 text-dark rounded">
                        <div className="logo text-center">
                            <img src="./assets/img/logo/PLC.png" alt="" className='rounded-circle w-50' />
                        </div>
                        <div className="login-header">
                            <div className="brand">
                                <div className="d-flex align-items-center">
                                    <img src='./assets/img/logo/login.webp' className='w-15' /> <b className='me-2'>PLC </b> Admin
                                </div>
                                <small>ຍິນດີຕ້ອນຮັບເຂົ້າສູ່ລະບົບບໍ່ລິຫານຈັດການ</small>
                            </div>
                            <div className="icon">
                                <i class="fa-solid fa-user text-red"></i>
                            </div>
                        </div>


                        <div className="login-content">
                            <form onSubmit={handleSumint}>
                                <div className="form-floating mb-20px">
                                    <input type="text" onChange={(e) => handleChange('userEmail', e.target.value)} className="form-control fs-13px h-45px border border-blue" placeholder="ຊື່ຜູ້ເຂົ້າໃຊ້" required />
                                    <label for="emailAddress" className="d-flex align-items-center text-gray-600 fs-13px">ຊື່ຜູ້ເຂົ້າໃຊ້</label>
                                </div>
                                <div className="form-floating mb-20px">
                                    <input type="password" onChange={(e) => handleChange('userPassword', e.target.value)} className="form-control fs-13px h-45px border  border-blue" placeholder="ລະຫັດຜ່ານ" required />
                                    <label for="emailAddress" className="d-flex align-items-center text-gray-600 fs-13px">ລະຫັດຜ່ານ</label>
                                </div>
                                <div className="form-check mb-20px">
                                    <input className="form-check-input border" type="checkbox" value="1" id="rememberMe" />
                                    <label className="form-check-label fs-13px text-gray-500" for="rememberMe">
                                        ສະແດງລະຫັດຜ່ານ
                                    </label>
                                </div>
                                <div className="mb-20px">
                                    <button type="submit" className={`btn btn-blue d-block w-100 h-45px btn-lg ${isLoading===true && 'disabled'}`}>{isLoading===true ?(  <Loader content="ກຳລັງກວດສອບ..." />):'ເຂົ້າສູ່ລະບົບ'} </button>
                                </div>
                                <div className="text-gray-500">
                                    PLC <a href="#" className="text-red">V</a> 1.0.1
                                </div>
                            </form>
                            {isLoading===true && 
                            <Loader backdrop size='lg' content="ກຳລັງກວດສອບ..." center vertical />
                            }
                        </div>
                       
                    </div>

                </div>
            </div>
        </>
    )
}
