import React,{useEffect, useState} from 'react'
import { useNavigate } from 'react-router-dom';
function PanelPage({type,data}) {

    const navigate = useNavigate();
    const handleNactPage=(path)=>{
        navigate(path)
    }
    const [time, setTime] = useState(new Date().toLocaleTimeString());
    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date().toLocaleTimeString());
        }, 1000);
        return () => clearInterval(timer);
    }, [type]);
  return (
    <div className="row">
    <div className="col-xl-4 col-md-4">
        <div onClick={()=>handleNactPage('/report-Leave')} role='button' className={`widget widget-stats bg-blue ${type === 'leave' && 'border-5 border-red border-start rounded-start-4 border-end rounded-end-4'} `}>
            <div className="stats-icon"><i className="fa fa-desktop"></i></div>
            <div className="stats-info">
                <h4 className='fs-bold fs-20px'>ຂໍ້ມູນການລາພັກວຽກ</h4>
                <p>{data} ລາຍການ</p>
            </div>
        </div>
    </div>
    <div className="col-xl-4 col-md-4">
        <div onClick={()=>handleNactPage('/report-lack')} role='button' className={`widget widget-stats bg-orange ${type === 'lack' && 'border-5 border-red border-start rounded-start-4 border-end rounded-end-4'}`}>
            <div className="stats-icon"><i className="fa fa-users"></i></div>
            <div className="stats-info">
                <h4 className='fs-bold fs-20px'>ຂໍ້ມູນການຂາດວຽກ</h4>
                <p>1,291,922</p>
            </div>
        </div>
    </div>
    <div className="col-xl-4 col-md-4">
        <div className={`widget widget-stats bg-info ${type === 'check' && 'border-5 border-red border-start rounded-start-4 border-end rounded-end-4'}`}>
            <div className="stats-icon"><i className="fa fa-clock"></i></div>
            <div className="stats-info">
                <h4 className='fs-bold fs-20px'>ຂໍ້ມູນການເຂົ້າອອກ</h4>
                <p>{time}</p>
            </div>
        </div>
    </div>
</div>
  )
}

export default PanelPage