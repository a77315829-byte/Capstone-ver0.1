import fs from "fs";
import path from "path";
import { Express } from "express";
import swaggerUi from "swagger-ui-express";
import swaggerAutogen from "swagger-autogen";
import dotenv from "dotenv";

dotenv.config();

const { version } = JSON.parse(
	fs.readFileSync(path.resolve(__dirname, "../../package.json"), "utf-8"),
) as { version: string };

const outputFile = path.resolve(__dirname, "../swagger-output.json");
const routeFiles = [
	"routes",
	"routes/scenarioProxy.routes",
	"routes/aiJudgmentProxy.routes",
];
const routeExtension = fs.existsSync(path.resolve(__dirname, "../routes.ts"))
	? ".ts"
	: ".js";
const endpointsFiles = routeFiles.map((routeFile) =>
	path.resolve(__dirname, `../${routeFile}${routeExtension}`),
);

export async function swaggerDocs(
	app: Express,
	port: number,
): Promise<void> {
	const serverUrl =
		process.env.STOTRA_SERVER_URL || `http://localhost:${port}`;

	const doc = {
		info: {
			title: "ANTITUDE API",
			description: "ANTITUDE investment learning API",
			version,
		},
		servers: [
			{
				url: serverUrl,
			},
		],
		securityDefinitions: {
			bearerAuth: {
				type: "http",
				scheme: "bearer",
				bearerFormat: "JWT",
			},
		},
	};

	try {
		const generateSwagger = swaggerAutogen({
			openapi: "3.0.0",
		});

		await generateSwagger(outputFile, endpointsFiles, doc);

		if (!fs.existsSync(outputFile)) {
			throw new Error(
				`Swagger 결과 파일이 생성되지 않았습니다: ${outputFile}`,
			);
		}

		const swaggerDocument = JSON.parse(
			fs.readFileSync(outputFile, "utf-8"),
		);

		app.use(
			"/api/docs",
			swaggerUi.serve,
			swaggerUi.setup(swaggerDocument, {
				swaggerOptions: {
					persistAuthorization: true,
				},
			}),
		);

		console.log(
			`Swagger docs available at ${serverUrl}/api/docs`,
		);
	} catch (error) {
		/*
		 * Swagger 생성에 실패해도 백엔드 전체 서버가 종료되지 않게 처리
		 */
		console.error("Swagger setup failed:", error);
	}
}
