import { createRoot } from "react-dom/client";
import "@/react-app/index.css";
import App from "@/react-app/App";
import { AuthProvider } from "@/react-app/context/AuthContext";

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
