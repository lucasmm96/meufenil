import { createRoot } from "react-dom/client";
import "@/react-app/index.css";
import App from "@/react-app/App";
import { AuthProvider, useAuth } from "@/react-app/context/AuthContext";
import { OfflineProvider } from "@/react-app/context/OfflineContext";

function OfflineProviderWithAuth({ children }: { children: React.ReactNode }) {
  const { authUser } = useAuth();
  return (
    <OfflineProvider userId={authUser?.id ?? null}>
      {children}
    </OfflineProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <OfflineProviderWithAuth>
      <App />
    </OfflineProviderWithAuth>
  </AuthProvider>
);
