const assert = require("node:assert/strict");
const http = require("node:http");

const listen = (server) =>
	new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => resolve(server.address().port));
	});

const close = (server) =>
	new Promise((resolve) => server.close(() => resolve()));

const main = async () => {
	let mode = "passthrough";
	let lastPath;
	const downstream = http.createServer((req, res) => {
		lastPath = req.url;
		if (mode === "slow") {
			setTimeout(() => {
				res.writeHead(200, { "content-type": "application/json" });
				res.end(JSON.stringify({ delayed: true }));
			}, 150);
			return;
		}

		res.writeHead(418, { "content-type": "application/json" });
		res.end(JSON.stringify({ detail: "downstream validation" }));
	});

	const downstreamPort = await listen(downstream);
	process.env.SCENARIO_SERVICE_URL = `http://127.0.0.1:${downstreamPort}`;
	process.env.SCENARIO_SERVICE_TIMEOUT_MS = "50";
	process.env.STOTRA_JWT_SECRET = "proxy-smoke-test-secret";

	let bff;
	let User;
	let originalFindById;

	try {
		User = require("../dist/models/user.model").default;
		originalFindById = User.findById;
		User.findById = (id) => ({
			select: () => ({
				lean: () => ({
					exec: async () => id === "mongo-id" ? { username: "test-user" } : null,
				}),
			}),
		});
		const app = require("../dist/app").default;
		bff = http.createServer(app);
		const bffPort = await listen(bff);
		const endpoint = `http://127.0.0.1:${bffPort}/api/scenario-service/scenarios`;

		const passthrough = await fetch(endpoint);
		assert.equal(passthrough.status, 418);
		assert.deepEqual(await passthrough.json(), {
			detail: "downstream validation",
		});

		const token = require("jsonwebtoken").sign(
			{ id: "mongo-id" },
			process.env.STOTRA_JWT_SECRET,
		);
		const headers = { Authorization: `Bearer ${token}` };
		const historyUrl = `http://127.0.0.1:${bffPort}/api/scenario-service/users/test-user/evaluations`;
		assert.equal((await fetch(historyUrl)).status, 401);
		assert.equal((await fetch(historyUrl.replace("test-user", "other-user"), { headers })).status, 403);
		for (const path of [
			"users/test-user/evaluations",
			"users/test-user/evaluations/test-evaluation",
		]) {
			const result = await fetch(`http://127.0.0.1:${bffPort}/api/scenario-service/${path}`, { headers });
			assert.equal(result.status, 418);
			assert.equal(lastPath, `/api/${path}`);
			await result.json();
		}

		mode = "slow";
		const timeout = await fetch(endpoint);
		assert.equal(timeout.status, 504);
		assert.equal((await timeout.json()).code, "DOWNSTREAM_TIMEOUT");

		console.log("downstream proxy smoke test passed");
	} finally {
		if (User && originalFindById) User.findById = originalFindById;
		if (bff) await close(bff);
		await close(downstream);
	}
};

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
