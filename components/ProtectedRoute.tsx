
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Role } from '../types';

interface ProtectedRouteProps {
  children: React.ReactElement;
  allowedRoles: Role[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    // User not logged in, redirect them to the login page.
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    // User is logged in but does not have the required role.
    // Redirect them to a default page (e.g., user dashboard or an unauthorized page).
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;
