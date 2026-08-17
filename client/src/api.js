const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: options.body instanceof FormData ? {} : { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let msg = "Something went wrong";
    try {
      msg = (await res.json()).error || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // public
  getSections: () => request("/sections"),
  getSubsections: (sectionId) => request(`/sections/${sectionId}/subsections`),
  getItems: (subsectionId) => request(`/subsections/${subsectionId}/items`),
  getItem: (id) => request(`/items/${id}`),

  // admin auth
  login: (password) => request("/admin/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => request("/admin/logout", { method: "POST" }),
  checkAuth: () => request("/admin/check"),

  // admin sections
  createSection: (title) => request("/admin/sections", { method: "POST", body: JSON.stringify({ title }) }),
  updateSection: (id, title) => request(`/admin/sections/${id}`, { method: "PUT", body: JSON.stringify({ title }) }),
  deleteSection: (id) => request(`/admin/sections/${id}`, { method: "DELETE" }),
  reorderSection: (id, direction) =>
    request(`/admin/sections/${id}/reorder`, { method: "POST", body: JSON.stringify({ direction }) }),

  // admin subsections
  createSubsection: (sectionId, title) =>
    request(`/admin/sections/${sectionId}/subsections`, { method: "POST", body: JSON.stringify({ title }) }),
  updateSubsection: (id, title) =>
    request(`/admin/subsections/${id}`, { method: "PUT", body: JSON.stringify({ title }) }),
  deleteSubsection: (id) => request(`/admin/subsections/${id}`, { method: "DELETE" }),
  reorderSubsection: (id, direction) =>
    request(`/admin/subsections/${id}/reorder`, { method: "POST", body: JSON.stringify({ direction }) }),

  // admin items
  createItem: (subsectionId, fields) =>
    request(`/admin/subsections/${subsectionId}/items`, { method: "POST", body: JSON.stringify(fields) }),
  updateItem: (id, fields) => request(`/admin/items/${id}`, { method: "PUT", body: JSON.stringify(fields) }),
  deleteItem: (id) => request(`/admin/items/${id}`, { method: "DELETE" }),
  reorderItem: (id, direction) =>
    request(`/admin/items/${id}/reorder`, { method: "POST", body: JSON.stringify({ direction }) }),
};