import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function RequireAuth({ permission, children }) {
  const { isAuthenticated, can } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const required = permission ? [].concat(permission) : [];
  if (required.length > 0 && !can(...required)) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#475569" }}>
        <h2 style={{ marginBottom: 8 }}>No access</h2>
        <p>Your account does not have permission to open this page.</p>
      </div>
    );
  }

  return children;
}
