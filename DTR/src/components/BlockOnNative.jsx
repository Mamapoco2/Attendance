import { Navigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";

/**
 * Wrap a route's page with this to make it unavailable inside the Android app.
 * On the web it renders the page normally.
 *
 *   <Route path="/view-dtr" element={<BlockOnNative><ViewDtr /></BlockOnNative>} />
 */
export default function BlockOnNative({ children, redirectTo = "/time-in" }) {
  if (Capacitor.isNativePlatform()) {
    return <Navigate to={redirectTo} replace />;
  }
  return children;
}
