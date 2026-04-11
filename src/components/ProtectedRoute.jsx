import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth }  from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner text="Checking session..." />;
  if (!user)   return <Navigate to="/login" replace />;

  if (roles && !roles.includes(user.roles?.name)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}