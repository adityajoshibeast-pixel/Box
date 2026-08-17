import { Routes, Route, Link } from "react-router-dom";
import ViewerHome from "./pages/ViewerHome.jsx";
import ViewerSection from "./pages/ViewerSection.jsx";
import ViewerSubsection from "./pages/ViewerSubsection.jsx";
import ItemViewer from "./pages/ItemViewer.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";

export default function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<ViewerHome />} />
        <Route path="/s/:sectionId" element={<ViewerSection />} />
        <Route path="/s/:sectionId/ss/:subsectionId" element={<ViewerSubsection />} />
        <Route path="/item/:itemId" element={<ItemViewer />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
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