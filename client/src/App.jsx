import { Routes, Route, Link, useLocation } from "react-router-dom";
import ViewerHome from "./pages/ViewerHome.jsx";
import ViewerSection from "./pages/ViewerSection.jsx";
import ViewerSubsection from "./pages/ViewerSubsection.jsx";
import ItemViewer from "./pages/ItemViewer.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import Unsubscribe from "./pages/Unsubscribe.jsx";
import UpdateSignup from "./components/UpdateSignup.jsx";

export default function App() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const isUnsubscribe = location.pathname === "/unsubscribe";

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<ViewerHome />} />
        <Route path="/s/:sectionId" element={<ViewerSection />} />
        <Route path="/s/:sectionId/ss/:subsectionId" element={<ViewerSubsection />} />
        <Route path="/item/:itemId" element={<ItemViewer />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/unsubscribe" element={<Unsubscribe />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {!isAdmin && !isUnsubscribe && <UpdateSignup />}
    </div>
  );
}

function NotFound() {
  return (
    <div className="page">
      <p>Page not found.</p>
      <Link to="/">Go home</Link>
    </div>
  );
}
