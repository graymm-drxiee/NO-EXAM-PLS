const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
const SESSION_KEY = "csd_session";

async function request(path, options = {}) {
  let session = null;
  try {
    session = JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    session = null;
  }

  const headers = { "Content-Type": "application/json" };
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error("Cannot reach the API. Check the backend connection.");
  }

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status}).`);
  return data;
}

export const api = {
  getLaptops: () => request("/laptops"),
  login: (credentials) => request("/auth/login", { method: "POST", body: credentials }),
  getLoans: (role) => request(role === "admin" ? "/admin/loans" : "/loans"),
};
