// =========================================================
// 🌐 API — კავშირი FastAPI backend-თან
// =========================================================
const API_URL = "https://inventory-system-l0b3.onrender.com";

// ტოკენის მართვა
function getToken() {
    return localStorage.getItem("access_token");
}

function setToken(token) {
    localStorage.setItem("access_token", token);
}

function removeToken() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("current_user");
}

function getCurrentUser() {
    const user = localStorage.getItem("current_user");
    return user ? JSON.parse(user) : null;
}

function setCurrentUser(user) {
    localStorage.setItem("current_user", JSON.stringify(user));
}

// =========================================================
// მთავარი API ფუნქცია — ყველა მოთხოვნისთვის
// =========================================================
async function fetchAPI(method, endpoint, data = null, requiresAuth = true) {
    const headers = { "Content-Type": "application/json" };

    // JWT token დავამატოთ თუ საჭიროა
    if (requiresAuth) {
        const token = getToken();
        if (!token) {
            showLoginPage();
            return null;
        }
        headers["Authorization"] = `Bearer ${token}`;
    }

    const options = { method, headers };
    if (data) options.body = JSON.stringify(data);

    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);

        // token ამოიწურა
        if (response.status === 401) {
            removeToken();
            showLoginPage();
            return null;
        }

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || "Something went wrong");
        }

        return result;
    } catch (error) {
        throw new Error(error.message);
    }
}

// =========================================================
// მოხერხებული helper ფუნქციები
// =========================================================
const api = {
    // Auth
    login: (username, password) => {
        // login form-data-ს გამოიყენებს
        const formData = new URLSearchParams();
        formData.append("username", username);
        formData.append("password", password);

        return fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData
        }).then(r => r.json());
    },

    me: () => fetchAPI("GET", "/auth/me"),

    // Items
    getItems: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchAPI("GET", `/items/${query ? "?" + query : ""}`);
    },
    createItem: (data) => fetchAPI("POST", "/items/", data),
    updateItem: (itemId, location, data) => {
        const query = location ? `?location=${encodeURIComponent(location)}` : '';
        return fetchAPI("PUT", `/items/${itemId}${query}`, data);
    },
    deleteItem: (itemId, location = null) => {
        const query = location ? `?location=${encodeURIComponent(location)}` : '';
        return fetchAPI("DELETE", `/items/${itemId}${query}`);
    },

    // Transfers
    transfer: (data) => fetchAPI("POST", "/transfers/", data),

    // History
    getHistory: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchAPI("GET", `/history/${query ? "?" + query : ""}`);
    },

    // Dashboard
    getDashboard: () => fetchAPI("GET", "/dashboard/"),

    // Settings
    getSettings: () => fetchAPI("GET", "/settings/"),
    addSetting: (data) => fetchAPI("POST", "/settings/", data),
    deleteSetting: (id) => fetchAPI("DELETE", `/settings/${id}`),

    changePassword: (data) => fetchAPI("PUT", "/auth/change-password", data),
};


