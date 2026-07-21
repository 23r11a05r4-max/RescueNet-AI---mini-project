import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("sentinel_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("Global API Error Interceptor:", error);
    const errMsg = error.response?.data?.detail || error.message || "Network Error: Failed to connect to server.";
    toast.error(`API Error: ${errMsg}`);
    return Promise.resolve({ data: null, error });
  }
);
