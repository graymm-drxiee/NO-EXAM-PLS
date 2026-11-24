const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
const SESSION_KEY = "csd_session";

function getToken() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    return typeof session?.token === "string" ? session.token : null;
  } catch {
    return null;
  }
}

async function request(path, { method = "GET", body } = {}) {
  const headers = {};
  const token = getToken();
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    throw new Error(
      error.name === "AbortError"
        ? "The server took too long to respond. Try again."
        : "Could not reach the API server. Check that the backend is running."
    );
  } finally {
    clearTimeout(timer);
  }

  // A 401 means the stored session is gone or expired — clear it and let the app redirect.
  if (response.status === 401) {
    localStorage.removeItem(SESSION_KEY);
    window.dispatchEvent(new Event("csd:unauthorized"));
  }

  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text.slice(0, 200) };
    }
  }
  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}.`);
  }
  return data;
}

export const api = {
  getStudent: () => request("/auth/me"),
  updateProfile: (profile) => request("/auth/me", { method: "PATCH", body: profile }),
  changePassword: (currentPassword, newPassword) =>
    request("/auth/password", { method: "PATCH", body: { currentPassword, newPassword } }),
  getLaptops: () => request("/laptops"),
  getLoans: () => request("/loans"),

  async login(credentials) {
    return request("/auth/login", { method: "POST", body: credentials });
  },

  async registerStudent(profile) {
    const result = await request("/auth/register", { method: "POST", body: profile });
    return { role: "student", user: result.user, token: result.token };
  },

  createLoan: (loan) => request("/loans", { method: "POST", body: loan }),
  cancelLoan: (id) => request(`/loans/${encodeURIComponent(id)}/cancel`, { method: "PATCH" }),
  returnLoan: (id) => request(`/loans/${encodeURIComponent(id)}/return`, { method: "PATCH" }),
  getAdminLoans: () => request("/admin/loans"),
  getAdminStudents: () => request("/admin/students"),
  getSettings: () => request("/admin/settings"),
  updateSettings: (settings) => request("/admin/settings", { method: "PATCH", body: settings }),
  approveLoan: (id) =>
    request(`/admin/loans/${encodeURIComponent(id)}/approve`, { method: "PATCH" }),
  declineLoan: (id, reason) =>
    request(`/admin/loans/${encodeURIComponent(id)}/decline`, { method: "PATCH", body: { reason } }),
  updateLoanDates: (id, dates) =>
    request(`/admin/loans/${encodeURIComponent(id)}/dates`, { method: "PATCH", body: dates }),
  addLaptop: (laptop) => request("/laptops", { method: "POST", body: laptop }),
  updateLaptop: (id, laptop) =>
    request(`/laptops/${encodeURIComponent(id)}`, { method: "PUT", body: laptop }),
  deleteLaptop: (id) =>
    request(`/laptops/${encodeURIComponent(id)}`, { method: "DELETE" }),
  toggleMaintenance: (id, note) =>
    request(`/laptops/${encodeURIComponent(id)}/maintenance`, { method: "PATCH", body: { note } }),
  forceReturn: (id) =>
    request(`/admin/loans/${encodeURIComponent(id)}/return`, { method: "POST" }),
  toggleStudent: (id) =>
    request(`/admin/students/${encodeURIComponent(id)}/active`, { method: "PATCH" }),
  addStudent: (student) => request("/admin/students", { method: "POST", body: student }),
  updateStudent: (id, student) =>
    request(`/admin/students/${encodeURIComponent(id)}`, { method: "PUT", body: student }),
  resetStudentPassword: (id, password) =>
    request(`/admin/students/${encodeURIComponent(id)}/password`, { method: "POST", body: { password } }),
};
