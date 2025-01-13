import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from '../404/Login';
import HomePage from '../Myapp/home/HomePage';
import EmployeePage from '../Myapp/employee/EmployeePage';
import FormEmployee from '../Myapp/employee/FormEmployee';
import Department from '../Myapp/setting/Department';
import TypeAcount from '../Myapp/acount/TypeAcount';
import TreasuryAccounts from '../Myapp/acount/TreasuryAccounts';
import IncomePage from '../Myapp/expenses/IncomePage';
import ExpenditurePage from '../Myapp/expenses/ExpenditurePage';
import TypeIncomExpenses from '../Myapp/expenses/Type-Incom-Expenses';
import FromIncome from '../Myapp/expenses/From-Income';
import FromExpenditure from '../Myapp/expenses/From-Expenditure';
import OverviewPage from '../Myapp/acount/OverviewPage';
import DocumentPage from '../Myapp/document/documentPage';
import CheckinCheckout from '../Myapp/Inout/Checkin-Checkout';
import LackWork from '../Myapp/Inout/Lack-Work';
import RequestLeave from '../Myapp/Inout/Request-Leave';
import ReportLeave from '../Myapp/Inout/Report-Leave';
import ReportLackWork from '../Myapp/Inout/Report-LackWork';
import CustomerPage from '../Myapp/customer/CustomerPage';
export default function AppRoutes() {
  return (
    <Routes>
        <Route path='/' element={<Navigate replace to={'home'} />} />
        <Route path="/login" element={<Login />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/staff" element={<EmployeePage />} />
        <Route path="/form-em" element={<FormEmployee />} />
        <Route path="/depart" element={<Department />} />
        <Route path="/type" element={<TypeAcount />} />
        <Route path="/treasury" element={<TreasuryAccounts />} />
        <Route path="/incom" element={<IncomePage />} />
        <Route path="/from-incom" element={<FromIncome />} />
        <Route path="/edit-incom/:id" element={<FromIncome />} />
        
        <Route path="/cost" element={<ExpenditurePage />} />
        <Route path="/type-inex" element={<TypeIncomExpenses />} />
        <Route path="/from-exp" element={<FromExpenditure />} />
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/document" element={<DocumentPage />} />
        <Route path="/in-out" element={<CheckinCheckout />} />
        <Route path="/lack" element={<LackWork />} />
        <Route path="/leave" element={<RequestLeave />} />
        <Route path="/report-Leave" element={<ReportLeave />} />
        <Route path="/report-lack" element={<ReportLackWork />} />
        <Route path="/customer" element={<CustomerPage />} />
        </Routes>
  )
}