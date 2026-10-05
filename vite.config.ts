import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    devSourcemap: false, // ✅ ປິດ sourcemap ເພື່ອບໍ່ໃຫ້ Vite ພະຍາຍາມອ່ານ .css.map
    preprocessorOptions: {
      scss: {
        // ທີມແອັດມິນ (src/scss/default/**) ຍັງຂຽນດ້ວຍໄວຍະກອນເກົ່າ — ປິດສະເພາະ 4 ຊະນິດນີ້
        // ເພື່ອບໍ່ໃຫ້ log ຖືກ warning 600+ ອັນກົບ. ຊະນິດອື່ນຍັງເຕືອນຕາມປົກກະຕິ
        silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
      },
    },
  },
})
