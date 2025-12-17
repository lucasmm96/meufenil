import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import HomePage from "@/react-app/pages/Home";
import DashboardPage from "@/react-app/pages/Dashboard";
import HistoricoPage from "@/react-app/pages/Historico";
import EstatisticasPage from "@/react-app/pages/Estatisticas";
import PerfilPage from "@/react-app/pages/Perfil";
import AdminPage from "@/react-app/pages/Admin";
import ExamesPage from "@/react-app/pages/Exames";
import SobrePage from "@/react-app/pages/Sobre";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/historico" element={<HistoricoPage />} />
        <Route path="/estatisticas" element={<EstatisticasPage />} />
        <Route path="/perfil" element={<PerfilPage />} />
        <Route path="/exames" element={<ExamesPage />} />
        <Route path="/sobre" element={<SobrePage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </Router>
  );
}
