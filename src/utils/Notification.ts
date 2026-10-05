
import AWNImport from "awesome-notifications";
import type { AwnOptions } from "awesome-notifications";
import "awesome-notifications/dist/style.css";
import Swal from 'sweetalert2';
import { translateText } from "../context/LanguageContext";

// ແພັກເກດເປັນ UMD ທີ່ມີ __esModule — dep optimizer ຂອງ Vite 8 (Rolldown) ຄືນ module.exports ທັງກ້ອນ
// (class ຢູ່ .default) ສ່ວນ Vite ລຸ້ນເກົ່າ/esbuild ແກະໃຫ້ແລ້ວ — ຮັບໄດ້ທັງສອງແບບ
const AWN: typeof AWNImport =
  (AWNImport as unknown as { default?: typeof AWNImport }).default ?? AWNImport;

const notifier = new AWN({
    position: "top-right", 
    maxNotifications: 3,
    durations: { success: 3000 }, // 3 seconds
    labels: {
      success: `🎉 ${translateText('confirmBang')}`,
      warning: `⚠️ ${translateText('warningNotice')}`,
      alert: `❌ ${translateText('sorry')}`,
      confirm: translateText('needConfirm')
    },
    icons: { enabled: true },
  });

interface Notification {
    success: (message: string) => void;
    warning: (message: string) => void;
    error: (message: string) => void;
    confirm: (
      message: string, 
      onConfirm?: () => void, 
      onCancel?: () => void,
      options?: AwnOptions ) => void;
    loading: (
      promise: Promise<any>,
      onResolve?: (result: any) => void,
      onReject?: (error: any) => void,
      message?: string,
      options?: AwnOptions
    ) => void;
  }

  export const Notific: Notification = {
    success: (message) => {
        notifier.success(translateText(message));
      },
      warning: (message) => {
        notifier.warning(translateText(message));
      },
      error: (message) => {
        notifier.alert(translateText(message));
      },
      confirm: (message, onConfirm, onCancel, options) => {
        const confirmOptions: AwnOptions = {
          ...options,
          labels: {
            ...options?.labels,
            confirm: translateText('needConfirm'),
            confirmOk: translateText('ok'),
            confirmCancel: translateText('cancel'),
          },
        };

        notifier.confirm(
          translateText(message),
          () => onConfirm?.(),
          () => onCancel?.(),
          confirmOptions
        );
      },

      loading: (promise, onResolve, onReject, message, options) => {
        notifier.asyncBlock(promise, onResolve, onReject, message, options);
      }
    };

    export const Alert = {
      errorLogin: (message: string) => { 
        Swal.fire({
          title: translateText('sorryBang'),
          text: translateText(message),
          icon: 'error',
          width: 400,
          confirmButtonText: translateText('ok'),
          confirmButtonColor: '#3085d6',
        });
      },
      errorData: (message: string) => { 
        Swal.fire({
          title: translateText('sorryBang'),
          text: translateText(message),
          icon: 'error',
          width: 400,
          confirmButtonText: translateText('ok'),
          confirmButtonColor: '#3085d6',
        });
      },
      successData: (message: string) => { 
        Swal.fire({
          title: translateText('confirmBang'),
          text: translateText(message),
          icon: 'success',
          width: 350,
          confirmButtonText: translateText('ok'),
          confirmButtonColor: '#0fac29',
        });
      },
      
      warningData: (message: string) => { 
        Swal.fire({
          title: translateText('sorry'),
          text: translateText(message),
          icon: 'info',
          width: 400,
          confirmButtonColor: '#0fac29',
        });
      },
    };
    
    
