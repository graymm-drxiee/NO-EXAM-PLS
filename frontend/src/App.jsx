import { useEffect, useState } from "react";
import { getLaptops } from "./api";

export default function App() {
  const [laptops, setLaptops] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getLaptops()
      .then(setLaptops)
      .catch((requestError) => setError(requestError.message));
  }, []);

  return (
    <main className="page">
      <header className="topbar">
        <a className="brand" href="#">CSD / LAPTOPS</a>
        <a href="#fleet">Fleet</a>
      </header>
      <section className="intro">
        <p className="eyebrow">COMPUTER STUDIES DEPARTMENT</p>
        <h1>Borrow smart.<br />Code anywhere.</h1>
        <p>Browse the department fleet and find a laptop for your next project.</p>
        <a className="button" href="#fleet">Explore the fleet</a>
      </section>
      <section id="fleet" className="fleet">
        <div className="section-heading">
          <div><p className="eyebrow">LIVE FROM THE API</p><h2>Available laptops</h2></div>
          <span>{laptops.length} devices</span>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="grid">
          {laptops.map((laptop) => (
            <article className="laptop" key={laptop.id}>
              <span className="tag">{laptop.tag}</span>
              <h3>{laptop.model}</h3>
              <p>{laptop.cpu} · {laptop.ram} RAM · {laptop.storage}</p>
              <span className={laptop.maintenance ? "status unavailable" : "status"}>
                {laptop.maintenance ? "Maintenance" : "In fleet"}
              </span>
            </article>
          ))}
        </div>
      </section>
      <footer>CSD Laptop Borrowing · Week 13 API integration</footer>
    </main>
  );
}
