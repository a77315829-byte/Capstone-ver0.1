import axios from "axios";
import tokens from "./tokens.service";
import { tradingUpdate } from "../utils/holdingValuation";


const instance = axios.create({
	baseURL: "/api",
    timeout: 95000,
	headers: {
		"Content-Type": "application/json",
	},
});

instance.interceptors.request.use(
	(config) => {
		const token = tokens.getToken();
		if (token) {
			config.headers["Authorization"] = "Bearer " + token;
		}
		return config;
	},
	(error) => {
		return Promise.reject(error);
	},
);

instance.interceptors.response.use(response => {
    const update = tradingUpdate(response.config.method, response.config.url);
    if (update && response.data?.success !== false) {
        window.dispatchEvent(new CustomEvent("antitude:portfolio-updated", { detail: update }));
    }
    return response;
});

export default instance;
export const getScenarios = async () => {
	const response = await instance.get("/scenario-service/scenarios");
	return response.data;
};
