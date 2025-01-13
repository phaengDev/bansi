import React, { useEffect, useState } from 'react'
import { Modal, Button, InputGroup, SelectPicker, Input } from 'rsuite';
import EyeCloseIcon from '@rsuite/icons/EyeClose';
import VisibleIcon from '@rsuite/icons/Visible';
import { useRights } from '../../config/selectOption';
function UserPages({ open, handleClose, data }) {

    const itemRights=useRights();
    const [visible, setVisible] = React.useState(false);
    const changePass = () => {
        setVisible(!visible);
    };

const [inputs,setInputs]=useState({
    userId:'',
    employee_id_fk:'',
    userName:'',
    userEmail:'',
    userPassword:'',
    rightsUse:'',
    statusUse:'1',
})

    const handleChange=(name,value)=>{
    setInputs({
        ...inputs,[name]:value
    })
    }

    useEffect(() => {
        if (data) {
            setInputs({
                userId: data.userId || '',
                employee_id_fk: data.employee_id || '',
                userName: data.userName || '',
                userEmail: data.userEmail || '',
                userPassword: '', // Reset password field
                rightsUse: data.rightsUse || '',
                statusUse: data.statusUse || '',
            });
        }
    }, [data]);
    const decodedEmail = (email) => {
        try {
          return atob(email); // Decode using atob if it's Base64 encoded
        } catch (error) {
          return 'Invalid Email';
        }
      };
      const encodedEmail = (email) => {
        try {
          return btoa(email); // Encode the email using btoa before saving
        } catch (error) {
          return ''; // Return an empty string if encoding fails
        }
      };
    return (
        <Modal open={open} onClose={handleClose}>
            <Modal.Header>
                <Modal.Title>{data.code_id}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="form-group mb-2">
                    <label htmlFor="" className='form-label'>ຊື່ຜູ້ເຂົ້າໃຊ້ </label>
                    <Input value={inputs.userName} onChange={(e) => handleChange('userName', e)} placeholder='ຊື່ຜູ້ເຂົ້າໃຊ້' />
                </div>
                <div className="form-group mb-2">
                    <label htmlFor="userEmail" className='form-label'>ອີເມວຜູ້ໃຊ້ <span className='text-red'>*</span></label>
                    <InputGroup inside>
                        <InputGroup.Addon>
                            <i class="fa-solid fa-user-lock" />
                        </InputGroup.Addon>
                        <Input value={decodedEmail(inputs.userEmail)} onChange={(e) => handleChange('userEmail', encodedEmail(e))} placeholder='***@gmail.com' />
                    </InputGroup>
                </div>
                <div className="form-group mb-2">
                    <label htmlFor="userPassword" className='form-label'>ລະຫັດຜ່ານ <span className='text-red'>*</span></label>
                    <InputGroup inside >
                        <Input type={visible ? 'text' : 'password'} value={inputs.userPassword} onChange={(e) => handleChange('userPassword', e)} placeholder='ລະຫັດຜ່ານ' />
                        <InputGroup.Button onClick={changePass}>
                            {visible ? <VisibleIcon /> : <EyeCloseIcon />}
                        </InputGroup.Button>
                    </InputGroup>
                </div>
                <div className="form-group mb-2">
                    <label htmlFor="rightsUse" className='form-label'>ສະຖານະ *</label>
                    <SelectPicker block data={itemRights} value={inputs.rightsUse} onChange={(e) => handleChange('rightsUse', e)} placeholder="ເລືອກສະຖານະ" />
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button onClick={handleClose} appearance="primary">
                    Ok
                </Button>
                <Button onClick={handleClose} appearance="subtle">
                    Cancel
                </Button>
            </Modal.Footer>
        </Modal>
    )
}

export default UserPages