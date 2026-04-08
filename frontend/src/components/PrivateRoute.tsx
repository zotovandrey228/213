import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface Props {
  children: React.ReactNode;
  requiredRole?: string;
}

export default function PrivateRoute({ children, requiredRole }: Props) {
  const { token, user } = useAuthStore();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/cartridges" replace />;
  }

  return <>{children}</>;
}
