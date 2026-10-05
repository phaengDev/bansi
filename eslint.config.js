import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      // `_` ນຳໜ້າ = ຕັ້ງໃຈຖິ້ມຄ່າ (ເຊັ່ນ ແຍກ field ອອກຈາກ object ດ້ວຍ rest)
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      // ແຖວຈາກ api-bansi ສ່ວນໃຫຍ່ຍັງບໍ່ມີ type — ເຕືອນໄວ້ ຄ່ອຍໆໃສ່ type ແທນ any
      '@typescript-eslint/no-explicit-any': 'warn',
      // ໜ້າບັນຊີໂຫຼດຂໍ້ມູນດ້ວຍ setLoading(true) ໃນ effect — ເຕືອນໄວ້ກ່ອນ ຍັງບໍ່ປ່ຽນໂຄງສ້າງ
      'react-hooks/set-state-in-effect': 'warn',
      // ໄຟລ໌ kit (settingKit, glKit, …) export ທັງ component ແລະ helper — ມີຜົນແຕ່ HMR ເທົ່ານັ້ນ
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
])
