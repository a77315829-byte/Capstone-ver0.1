import fs from "fs";
import path from "path";
import { Express } from "express";
import swaggerUi from "swagger-ui-express";
import swaggerAutogen from "swagger-autogen";
import { version } from "../../package.json";
import dotenv from "dotenv";

dotenv.config();

/*
 * 현재 파일 위치:
 * server/src/utils/swagger.ts
 *
 * 생성 파일:
 * server/src/swagger-output.json
 *
 * 라우트 파일:
 * server/src/routes.ts
 */
const outputFile = path.resolve(__dirname, "../swagger-output.json");
const endpointsFiles = [path.resolve(__dirname, "../routes.ts")];

export async function swaggerDocs(
	app: Express,
	port: number,
): Promise<void> {
	const serverUrl =
		process.env.STOTRA_SERVER_URL || `http://localhost:${port}`;

	const doc = {
		info: {
			title: "Antitude Defense API",
			description: "Antitude Defense REST API documentation",
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