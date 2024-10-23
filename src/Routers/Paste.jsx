import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from '../404/Login';
import HomePage from '../Myapp/home/HomePage';
import EmployeePage from '../Myapp/employee/EmployeePage';
import FormEmployee from '../Myapp/employee/FormEmployee';
import Department from '../Myapp/setting/Department';
import TypeAcount from '../Myapp/acount/TypeAcount';
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
        </Routes>
  )
}