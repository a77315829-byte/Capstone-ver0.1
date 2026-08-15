import axios from "axios";
import tokens from "./tokens.service";
import api from "./api.service";

const instance = axios.create({
	baseURL: "/api",
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

export default instance;
export const getScenarios = async () => {
	const response = await api.get("/scenario-service/scenarios");
	return response.data;
};