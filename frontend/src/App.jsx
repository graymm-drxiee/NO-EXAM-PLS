import { useEffect, useState } from "react";

const pages = ["home", "login", "student", "admin"];
const descriptions = {
  home: ["CSD Laptop Borrowing", "Browse department laptops and reserve a device for your coursework."],
  login: ["Sign in", "Student and administrator sign-in will be connected in a later milestone."],
  student: ["Student dashboard", "Your reservations and available laptops will appear here."],
  admin: ["Administrator dashboard", "Fleet and loan management will appear here."]
};

function readPage() {
  const page = window.location.hash.slice(1).toLowerCase();
  return pages.includes(page) ? page : "home";
}

export default function App() {
  const [page, setPage] = useState(readPage);

  useEffect(() => {
    const syncPage = () => setPage(readPage());
    window.addEventListener("hashchange", syncPage);
    return () => window.removeEventListener("hashchange", syncPage);
  }, []);

  const [title, description] = descriptions[page];

  return (
    <main className="shell">
      <header className="header">
        <a className="brand" href="#">CSD • LAPTOPS</a>
        <nav aria-label="Main navigation">
          <a href="#">Home</a>
          <a href="#login">Sign in</a>
        </nav>
      </header>
      <section className="card" aria-live="polite">
        <p className="eyebrow">WEEK 12 · STATIC SCAFFOLD</p>
        <h1>{title}</h1>
        <p>{description}</p>
        {page === "home" && <a className="button" href="#login">Get started</a>}
      </section>
      <footer>Computer Studies Department · Laptop Borrowing System</footer>
    </main>
  );
}
