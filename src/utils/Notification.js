import { NotificationManager } from 'react-notifications';
import Swal from 'sweetalert2';

export const Notification = {
  info: (message, title, duration = 3000) => {
    NotificationManager.info(message, title, duration);
  },
  success: (message, title, duration = 3000) => {
    NotificationManager.success(message, title, duration);
  },
  warning: (message, title, duration = 3000) => {
    NotificationManager.warning(message, title, duration);
  },
  error: (message, title, duration = 3000) => {
    NotificationManager.error(message, title, duration);
  },

 
};

export const Alert = {
  errorLogin: (message) => { 
    Swal.fire({
      title: 'ຂໍອະໄພ!',
      text: message,
      icon: 'error',
      width: 400,
      confirmButtonText: 'ຕົກລົງ',
      confirmButtonColor: '#3085d6',
    });
  },
  errorData: (message) => { 
    Swal.fire({
      title: 'ຂໍອະໄພ!',
      text: message,
      icon: 'error',
      width: 400,
      confirmButtonText: 'ຕົກລົງ',
      confirmButtonColor: '#3085d6',
    });
  },
  successData: (message) => { 
    Swal.fire({
      title: 'ຢືນຢັນ!',
      text: message,
      icon: 'success',
      width: 350,
      confirmButtonText: 'ຕົກລົງ',
      confirmButtonColor: '#0fac29',
    });
  },
  warningData: (message) => { 
    Swal.fire({
      title: 'ຂໍອະໄພ',
      text: message,
      icon: 'info',
      width: 400,
      confirmButtonColor: '#0fac29',
    });
  },
};
