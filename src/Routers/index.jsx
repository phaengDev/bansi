import React,{useState,useEffect} from 'react'
import AppRoutes from './Paste'
import Header from '../Layout/Header'
import Navbar from '../Layout/Navbar'
import _ from 'lodash';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { NotificationContainer } from 'react-notifications';
import { Config } from '../config/connection';
function Application() {
  const api=Config.API;
    const location = useLocation();
    const pathName = location.pathname;
    const [path, setPath] = useState(pathName);
    const [minified,setMinified]=useState(false);
    const routes=['/r-sale' && '/received']
  
    const navigate = useNavigate();
    useEffect(() => {
      const token = localStorage.getItem('token'); // Get token from localStorage
      const checkTokenAndMakeRequest = async () => {
        if (!token) {
          navigate('/login');
        } else {
          try {
            const resp = await axios.post(api + 'login/authen', {}, {
              headers: {
                'Content-Type': 'multipart/form-data',
                'Authorization': 'Bearer ' + token
              }
            });
  
            // console.log('Response:', resp.data); 
          } catch (error) {
            console.error('Error making the API request:', error); // Handle errors
            navigate('/login');
          }
        }
      };
  
      checkTokenAndMakeRequest();

      setPath(pathName);
      if(_.includes(routes,path)){
        setMinified(true);
      }
    }, [pathName,navigate]);
  return (
    <>
    { path=== "/login" || path=== "/sale"  ? (
        <AppRoutes/>
      ) : (
        <div id="app" class={`app app-header-fixed app-sidebar-fixed app-gradient-enabled app-content-full-height ${minified == true ? 'app-sidebar-minified' :'' }`}>
        <Header />
        <Navbar />
        <AppRoutes/>
        <a href="javascript:;" class="btn btn-icon btn-circle btn-theme btn-scroll-to-top" data-toggle="scroll-to-top"><i class="fa fa-angle-up"></i></a>
      </div>
      )}

     <NotificationContainer />
      </>
    
  )
}

export default Application