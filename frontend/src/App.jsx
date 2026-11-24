import { useEffect, useState } from "react";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import StudentDashboard from "./pages/StudentDashboard";
import AdminDashboard from "./pages/AdminDashboard";

const SESSION_KEY = "csd_session";

/* ----------------------------- session storage ----------------------------- */
function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const session = raw ? JSON.parse(raw) : null;
    if (!session?.token || !["student", "admin"].includes(session.role)) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function saveSession(session) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

/* ----------------------------- route reader ----------------------------- */
const KNOWN_ROUTES = ["login", "signup", "dashboard", "admin"];

// The landing page doubles as an anchor page; these hashes are sections of
// it, not routes. Everything else unknown still gets the 404 screen.
const CONTENT_ANCHORS = ["home", "main", "how", "fleet", "faq"];

function readRoute() {
  const hash = window.location.hash.replace("#", "").toLowerCase();
  if (!hash) return "landing";
  if (CONTENT_ANCHORS.includes(hash)) return "landing";
  return KNOWN_ROUTES.includes(hash) ? hash : "notfound";
}

/* ----------------------------- app ----------------------------- */
export default function App() {
  const [page, setPage] = useState(readRoute);
  const [session, setSession] = useState(readSession);

  // keep hash and state in sync
  useEffect(() => {
    const onHash = () => setPage(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // route guards — bounce unauthorised visitors to the login screen
  useEffect(() => {
    if (page === "dashboard" && session?.role !== "student") {
      window.location.hash = "#login";
    } else if (page === "admin" && session?.role !== "admin") {
      window.location.hash = "#login";
    }
  }, [page, session]);

  // An expired token from any request drops the session and returns to login.
  useEffect(() => {
    const onUnauthorized = () => {
      setSession(null);
      saveSession(null);
      if (["dashboard", "admin"].includes(readRoute())) window.location.hash = "#login";
    };
    window.addEventListener("csd:unauthorized", onUnauthorized);
    return () => window.removeEventListener("csd:unauthorized", onUnauthorized);
  }, []);

  /* ----------------------------- navigation ----------------------------- */
  const go = (next) => {
    const hash = next === "landing" ? "" : `#${next}`;
    if (window.location.hash !== hash) window.location.hash = hash;
    setPage(next);
  };

  const handleLogin = (newSession) => {
    setSession(newSession);
    saveSession(newSession);
    go(newSession.role === "admin" ? "admin" : "dashboard");
  };

  const handleLogout = () => {
    setSession(null);
    saveSession(null);
    go("landing");
  };

  // Leaving the portal keeps the session; the landing page then offers "My dashboard".
  const handleBackToSite = () => go("landing");

  /* ----------------------------- render ----------------------------- */
  if (page === "notfound") {
    return (
      <main className="csd" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ textAlign: "center" }}>
          <h1 className="csd-display" style={{ fontSize: 32 }}>Page not found</h1>
          <p className="csd-dim" style={{ margin: "8px 0 20px" }}>
            That page doesn&apos;t exist. Head back to the home page.
          </p>
          <button className="csd-pill" onClick={() => go("landing")}>Back to home</button>
        </div>
      </main>
    );
  }

  if (page === "login" || page === "signup") {
    return (
      <Login
        onSuccess={handleLogin}
        onCancel={() => go("landing")}
        initialMode={page === "signup" ? "signup" : "login"}
      />
    );
  }

  if (page === "dashboard") {
    if (session?.role !== "student") return null; // guard effect will redirect
    return <StudentDashboard session={session} onExit={handleLogout} onBack={handleBackToSite} />;
  }

  if (page === "admin") {
    if (session?.role !== "admin") return null;
    return <AdminDashboard session={session} onExit={handleLogout} onBack={handleBackToSite} />;
  }

  return (
    <Landing
      onEnter={(maybeSession) => {
        // Landing's "Log in" button calls onEnter() with no args → go to login.
        // SignupForm (File 6) will call onEnter(session) to auto-login.
        if (maybeSession) handleLogin(maybeSession);
        else go("login");
      }}
    />
  );
}