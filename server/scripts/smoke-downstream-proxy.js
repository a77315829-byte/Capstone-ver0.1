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
	const downstream = http.createServer((_req, res) => {
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

	let bff;

	try {
		const app = require("../dist/app").default;
		bff = http.createServer(app);
		const bffPort = await listen(bff);
		const endpoint = `http://127.0.0.1:${bffPort}/api/scenario-service/scenarios`;

		const passthrough = await fetch(endpoint);
		assert.equal(passthrough.status, 418);
		assert.deepEqual(await passthrough.json(), {
			detail: "downstream validation",
		});

		mode = "slow";
		const timeout = await fetch(endpoint);
		assert.equal(timeout.status, 504);
		assert.equal((await timeout.json()).code, "DOWNSTREAM_TIMEOUT");

		console.log("downstream proxy smoke test passed");
	} finally {
		if (bff) await close(bff);
		await close(downstream);
	}
};

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
