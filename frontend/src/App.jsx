import { useEffect, useState } from "react";
import { api } from "./api";

const SESSION_KEY = "csd_session";

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
  } catch {
    return null;
  }
}

function SignIn({ onSignedIn }) {
  const [role, setRole] = useState("student");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      const session = await api.login({ role, identifier, password });
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      onSignedIn(session);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <form className="card sign-in" onSubmit={submit}>
      <p className="eyebrow">ACCOUNT ACCESS</p>
      <h1>Sign in</h1>
      <label>Account type
        <select value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="student">Student</option>
          <option value="admin">Administrator</option>
        </select>
      </label>
      <label>{role === "admin" ? "Username" : "Student ID"}
        <input required value={identifier} onChange={(event) => setIdentifier(event.target.value)} />
      </label>
      <label>Password
        <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="button">Continue</button>
    </form>
  );
}

function Dashboard({ session, onSignOut }) {
  const [laptops, setLaptops] = useState([]);
  const [loans, setLoans] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.getLaptops(), api.getLoans(session.role)])
      .then(([fleet, reservations]) => {
        setLaptops(fleet);
        setLoans(reservations);
      })
      .catch((requestError) => setError(requestError.message));
  }, [session.role]);

  return (
    <main className="page">
      <header className="topbar">
        <a className="brand" href="#">CSD / PORTAL</a>
        <button className="text-button" onClick={onSignOut}>Sign out</button>
      </header>
      <section className="intro compact">
        <p className="eyebrow">{session.role === "admin" ? "ADMINISTRATOR" : "STUDENT"} PORTAL</p>
        <h1>{session.user?.name || "Welcome"}</h1>
        <p>{session.role === "admin" ? "Manage the department fleet and reservations." : "Review fleet availability and your reservations."}</p>
      </section>
      {error && <p className="error" role="alert">{error}</p>}
      <section className="grid">
        <article className="card"><p className="eyebrow">FLEET</p><strong>{laptops.length}</strong><p>laptops</p></article>
        <article className="card"><p className="eyebrow">RESERVATIONS</p><strong>{loans.length}</strong><p>{session.role === "admin" ? "all student loans" : "your loans"}</p></article>
      </section>
    </main>
  );
}

export default function App() {
  const [session, setSession] = useState(readSession);

  function signOut() {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  }

  return session
    ? <Dashboard session={session} onSignOut={signOut} />
    : <main className="page"><header className="topbar"><a className="brand" href="#">CSD / LAPTOPS</a></header><SignIn onSignedIn={setSession} /></main>;
}
