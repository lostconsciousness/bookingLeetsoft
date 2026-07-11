import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Optimizer from "./pages/Optimizer";
import Offers from "./pages/Offers";
import Inbox from "./pages/Inbox";
import SmartBooking from "./pages/SmartBooking";
import Settings from "./pages/Settings";
import PublicOffer from "./pages/PublicOffer";

export default function App() {
  return (
    <Routes>
      <Route path="/offer/:token" element={<PublicOffer />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/optimizer" element={<Optimizer />} />
        <Route path="/offers" element={<Offers />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/smart-booking" element={<SmartBooking />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

