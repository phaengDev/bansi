import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from '../404/Login';
import HomePage from '../Myapp/HomePage';
export default function AppRoutes() {
  return (
    <Routes>
        <Route path='/' element={<Navigate replace to={'home'} />} />
        <Route path="/login" element={<Login />} />
        <Route path="/home" element={<HomePage />} />
        </Routes>
  )
}