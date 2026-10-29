const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export async function getLaptops() {
  let response;
  try {
    response = await fetch(`${API_URL}/laptops`);
  } catch {
    throw new Error("Cannot reach the API. Start the backend and try again.");
  }

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Could not load laptops.");
  return data;
}
