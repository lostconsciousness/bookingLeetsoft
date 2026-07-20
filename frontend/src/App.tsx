import { AlertTriangle } from "lucide-react";
import { Route, Routes, useLocation, useNavigate, useRouteError } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useTranslation } from "./i18n/I18nContext";
import Dashboard from "./pages/Dashboard";
import Optimizer from "./pages/Optimizer";
import Offers from "./pages/Offers";
import Inbox from "./pages/Inbox";
import SmartBooking from "./pages/SmartBooking";
import Settings from "./pages/Settings";
import PublicOffer from "./pages/PublicOffer";
import WidgetDemo from "./pages/WidgetDemo";

function RouteError() {
  const { t } = useTranslation();
  const error = useRouteError();
  const navigate = useNavigate();
  const location = useLocation();
  const isPublic = location.pathname.startsWith("/offer/");
  if (import.meta.env.DEV) console.error("Route error boundary caught:", error);
  return (
    <div className="grid min-h-screen place-items-center bg-accent-900 px-6 text-center">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-lift">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-amber-50 text-amber-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-950">{t("errorBoundary.title")}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {t("errorBoundary.body")}
        </p>
        <div className={`mt-6 grid gap-2 ${isPublic ? "" : "sm:grid-cols-2"}`}>
          <button onClick={() => navigate(0)} className="primary-button">{t("errorBoundary.reload")}</button>
          {!isPublic ? <button onClick={() => navigate("/")} className="secondary-button">{t("errorBoundary.goToOverview")}</button> : null}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route errorElement={<RouteError />}>
        <Route path="/offer/:token" element={<PublicOffer />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/optimizer" element={<Optimizer />} />
          <Route path="/offers" element={<Offers />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/smart-booking" element={<SmartBooking />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/widget-demo" element={<WidgetDemo />} />
        </Route>
      </Route>
    </Routes>
  );
}

