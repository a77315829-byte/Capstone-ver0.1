import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import { TextDecoder } from "util";

import {
	normalizeStockSymbol,
} from "../utils/requests";

const DART_BASE_URL =
	"https://opendart.fss.or.kr/api";

const CORP_CODE_CACHE_FILE =
	path.join(
		process.cwd(),
		".dart-corp-code-cache.json",
	);

const CORP_CODE_CACHE_TTL_MS =
	7 * 24 * 60 * 60 * 1000;

const DETAIL_CACHE_TTL_MS =
	24 * 60 * 60 * 1000;

type DartResponse<T> = {
	status?: string;
	message?: string;
	list?: T[];
	[key: string]: any;
};

export type FinancialPeriodSummary = {
	period: string;
	revenue: number | null;
	operatingProfit: number | null;
	netIncome: number | null;
	operatingMargin: number | null;
	roe: number | null;
};

export type DartStockDetailData = {
	corpCode: string;
	homepageUrl: string | null;
	irUrl: string | null;
	companyNameEng: string | null;
	ceoName: string | null;
	address: string | null;
	industryCode: string | null;
	establishedDate: string | null;
	fiscalMonth: string | null;
	listedShares: number | null;
	annualFinancials:
		FinancialPeriodSummary[];
	quarterlyFinancials:
		FinancialPeriodSummary[];
	fetchedAt: Date;
};

type CorpCodeCacheFile = {
	fetchedAt: number;
	stockToCorp:
		Record<string, string>;
};

type CachedDetail = {
	expiresAt: number;
	data: DartStockDetailData;
};

let stockToCorpCode:
	Map<string, string> | null =
	null;

const detailCache =
	new Map<string, CachedDetail>();

const toNumberOrNull = (
	value: unknown,
): number | null => {
	if (
		value === undefined ||
		value === null ||
		value === ""
	) {
		return null;
	}

	const parsed =
		Number(
			String(value)
				.replace(/,/g, "")
				.trim(),
		);

	return Number.isFinite(parsed)
		? parsed
		: null;
};

const normalizeUrl = (
	value: unknown,
): string | null => {
	const raw =
		String(value ?? "")
			.trim();

	if (
		!raw ||
		raw === "-"
	) {
		return null;
	}

	if (
		/^https?:\/\//i.test(raw)
	) {
		return raw;
	}

	return `https://${raw}`;
};

const decodeXmlEntities = (
	value: string,
): string => {
	return value
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
};

const extractXmlTag = (
	block: string,
	tag: string,
): string => {
	const match =
		block.match(
			new RegExp(
				`<${tag}>([\\s\\S]*?)<\\/${tag}>`,
				"i",
			),
		);

	return match
		? decodeXmlEntities(
			match[1].trim(),
		)
		: "";
};

const findZipSignature = (
	buffer: Buffer,
	signature: number,
): number => {
	for (
		let index =
			buffer.length - 4;
		index >= 0;
		index -= 1
	) {
		if (
			buffer.readUInt32LE(
				index,
			) === signature
		) {
			return index;
		}
	}

	return -1;
};

const toSafeUint8Array = (
	input: ArrayLike<number>,
): Uint8Array => {
	const view =
		new Uint8Array(
			input.length,
		);

	for (
		let index = 0;
		index < input.length;
		index += 1
	) {
		view[index] =
			input[index] ?? 0;
	}

	return view;
};

const unzipFirstTextFile = (
	buffer: Buffer,
): string => {
	const eocdOffset =
		findZipSignature(
			buffer,
			0x06054b50,
		);

	if (eocdOffset < 0) {
		throw new Error(
			"DART 고유번호 ZIP 형식을 확인할 수 없습니다.",
		);
	}

	const totalEntries =
		buffer.readUInt16LE(
			eocdOffset + 10,
		);

	let centralOffset =
		buffer.readUInt32LE(
			eocdOffset + 16,
		);

	for (
		let index = 0;
		index < totalEntries;
		index += 1
	) {
		if (
			buffer.readUInt32LE(
				centralOffset,
			) !== 0x02014b50
		) {
			throw new Error(
				"DART ZIP 중앙 디렉터리가 올바르지 않습니다.",
			);
		}

		const method =
			buffer.readUInt16LE(
				centralOffset + 10,
			);

		const compressedSize =
			buffer.readUInt32LE(
				centralOffset + 20,
			);

		const fileNameLength =
			buffer.readUInt16LE(
				centralOffset + 28,
			);

		const extraLength =
			buffer.readUInt16LE(
				centralOffset + 30,
			);

		const commentLength =
			buffer.readUInt16LE(
				centralOffset + 32,
			);

		const localHeaderOffset =
			buffer.readUInt32LE(
				centralOffset + 42,
			);

		const fileName =
			buffer
				.subarray(
					centralOffset + 46,
					centralOffset +
						46 +
						fileNameLength,
				)
				.toString("utf8");

		centralOffset +=
			46 +
			fileNameLength +
			extraLength +
			commentLength;

		if (
			fileName.endsWith("/")
		) {
			continue;
		}

		if (
			buffer.readUInt32LE(
				localHeaderOffset,
			) !== 0x04034b50
		) {
			throw new Error(
				"DART ZIP 로컬 헤더가 올바르지 않습니다.",
			);
		}

		const localNameLength =
			buffer.readUInt16LE(
				localHeaderOffset + 26,
			);

		const localExtraLength =
			buffer.readUInt16LE(
				localHeaderOffset + 28,
			);

		const dataStart =
			localHeaderOffset +
			30 +
			localNameLength +
			localExtraLength;

		const compressed =
			toSafeUint8Array(
				buffer.subarray(
					dataStart,
					dataStart +
						compressedSize,
				),
			);

		const raw =
			method === 8
				? toSafeUint8Array(
					zlib.inflateRawSync(
						compressed,
					),
				)
				: compressed;

		return new TextDecoder(
			"utf-8",
		).decode(raw);
	}

	throw new Error(
		"DART 고유번호 파일을 읽지 못했습니다.",
	);
};

const getDartApiKey = ():
	string | null => {
	const key =
		process.env
			.STOTRA_DART_API_KEY
			?.trim();

	return key || null;
};

export const isDartConfigured = ():
	boolean =>
	Boolean(
		getDartApiKey(),
	);

const readCorpCodeCache = ():
	Map<string, string> | null => {
	try {
		if (
			!fs.existsSync(
				CORP_CODE_CACHE_FILE,
			)
		) {
			return null;
		}

		const saved =
			JSON.parse(
				fs.readFileSync(
					CORP_CODE_CACHE_FILE,
					"utf8",
				),
			) as CorpCodeCacheFile;

		if (
			Date.now() -
				Number(
					saved.fetchedAt ||
						0,
				) >
			CORP_CODE_CACHE_TTL_MS
		) {
			return null;
		}

		return new Map(
			Object.entries(
				saved.stockToCorp ||
					{},
			),
		);
	} catch {
		return null;
	}
};

const saveCorpCodeCache = (
	map: Map<string, string>,
) => {
	try {
		const data:
			CorpCodeCacheFile = {
			fetchedAt:
				Date.now(),
			stockToCorp:
				Object.fromEntries(
					map.entries(),
				),
		};

		fs.writeFileSync(
			CORP_CODE_CACHE_FILE,
			JSON.stringify(
				data,
			),
			"utf8",
		);
	} catch (error) {
		console.warn(
			"DART 고유번호 캐시 저장 실패:",
			error,
		);
	}
};

const loadCorpCodeMap = async ():
	Promise<Map<string, string>> => {
	if (stockToCorpCode) {
		return stockToCorpCode;
	}

	const diskCache =
		readCorpCodeCache();

	if (diskCache) {
		stockToCorpCode =
			diskCache;

		return diskCache;
	}

	const apiKey =
		getDartApiKey();

	if (!apiKey) {
		throw new Error(
			"STOTRA_DART_API_KEY가 설정되지 않았습니다.",
		);
	}

	const response =
		await axios.get<ArrayBuffer>(
			`${DART_BASE_URL}/corpCode.xml`,
			{
				params: {
					crtfc_key:
						apiKey,
				},
				responseType:
					"arraybuffer",
				timeout: 30_000,
			},
		);

	const buffer =
		Buffer.from(
			response.data,
		);

	if (
		buffer.length < 4 ||
		buffer.readUInt16LE(0) !==
			0x4b50
	) {
		const body =
			buffer.toString(
				"utf8",
			);

		throw new Error(
			`DART 고유번호 조회 실패: ${body.slice(
				0,
				200,
			)}`,
		);
	}

	const xml =
		unzipFirstTextFile(
			buffer,
		);

	const map =
		new Map<string, string>();

	const blocks =
		xml.match(
			/<list>[\s\S]*?<\/list>/gi,
		) || [];

	for (const block of blocks) {
		const stockCode =
			normalizeStockSymbol(
				extractXmlTag(
					block,
					"stock_code",
				),
			);

		const corpCode =
			extractXmlTag(
				block,
				"corp_code",
			);

		if (
			/^\d{6}$/.test(
				stockCode,
			) &&
			/^\d{8}$/.test(
				corpCode,
			)
		) {
			map.set(
				stockCode,
				corpCode,
			);
		}
	}

	stockToCorpCode = map;
	saveCorpCodeCache(map);

	return map;
};

const dartGet = async <T>(
	endpoint: string,
	params:
		Record<string, string>,
): Promise<DartResponse<T>> => {
	const apiKey =
		getDartApiKey();

	if (!apiKey) {
		throw new Error(
			"STOTRA_DART_API_KEY가 설정되지 않았습니다.",
		);
	}

	const response =
		await axios.get<
			DartResponse<T>
		>(
			`${DART_BASE_URL}/${endpoint}`,
			{
				params: {
					crtfc_key:
						apiKey,
					...params,
				},
				timeout: 20_000,
			},
		);

	const status =
		response.data.status;

	if (
		status &&
		status !== "000"
	) {
		if (status === "013") {
			return {
				status,
				message:
					response.data
						.message,
				list: [],
			};
		}

		throw new Error(
			`DART ${endpoint} 오류 ${status}: ${
				response.data.message ||
				"알 수 없는 오류"
			}`,
		);
	}

	return response.data;
};

const chooseFinancialRows = (
	rows: any[],
): any[] => {
	const consolidated =
		rows.filter(
			(row) =>
				row?.fs_div ===
				"CFS",
		);

	return consolidated.length > 0
		? consolidated
		: rows.filter(
			(row) =>
				row?.fs_div ===
				"OFS",
		);
};

const normalizeAccountName = (
	value: unknown,
): string =>
	String(value ?? "")
		.replace(/\s/g, "")
		.replace(/[()（）]/g, "")
		.toLowerCase();

const findAccount = (
	rows: any[],
	candidates: string[],
): any | null => {
	const normalizedCandidates =
		candidates.map(
			normalizeAccountName,
		);

	for (const row of rows) {
		const accountName =
			normalizeAccountName(
				row?.account_nm,
			);

		if (
			normalizedCandidates.some(
				(candidate) =>
					accountName ===
						candidate ||
					accountName.includes(
						candidate,
					),
			)
		) {
			return row;
		}
	}

	return null;
};

const getFinancialAccounts = (
	rows: any[],
) => ({
	revenue:
		findAccount(rows, [
			"매출액",
			"수익매출액",
			"영업수익",
			"매출",
		]),
	operatingProfit:
		findAccount(rows, [
			"영업이익",
			"영업이익손실",
		]),
	netIncome:
		findAccount(rows, [
			"당기순이익",
			"당기순이익손실",
			"연결당기순이익",
			"분기순이익",
			"반기순이익",
		]),
});

const calculateOperatingMargin = (
	revenue: number | null,
	operatingProfit:
		number | null,
): number | null => {
	if (
		revenue === null ||
		operatingProfit ===
			null ||
		revenue === 0
	) {
		return null;
	}

	return (
		operatingProfit /
		revenue
	) * 100;
};

const cleanPeriodLabel = (
	value: unknown,
	fallback: string,
): string => {
	const label =
		String(value ?? "")
			.replace(/\s+/g, " ")
			.trim();

	return label || fallback;
};

const buildAnnualPeriods = (
	rows: any[],
	year: number,
): FinancialPeriodSummary[] => {
	const accounts =
		getFinancialAccounts(
			rows,
		);

	const sample =
		accounts.revenue ||
		accounts.operatingProfit ||
		accounts.netIncome ||
		rows[0] ||
		{};

	const columns = [
		{
			key: "thstrm_amount",
			label:
				cleanPeriodLabel(
					sample.thstrm_nm,
					String(year),
				),
		},
		{
			key: "frmtrm_amount",
			label:
				cleanPeriodLabel(
					sample.frmtrm_nm,
					String(year - 1),
				),
		},
		{
			key: "bfefrmtrm_amount",
			label:
				cleanPeriodLabel(
					sample.bfefrmtrm_nm,
					String(year - 2),
				),
		},
	] as const;

	return columns.map(
		(column) => {
			const revenue =
				toNumberOrNull(
					accounts.revenue?.[
						column.key
					],
				);

			const operatingProfit =
				toNumberOrNull(
					accounts
						.operatingProfit?.[
						column.key
					],
				);

			const netIncome =
				toNumberOrNull(
					accounts.netIncome?.[
						column.key
					],
				);

			return {
				period:
					column.label,
				revenue,
				operatingProfit,
				netIncome,
				operatingMargin:
					calculateOperatingMargin(
						revenue,
						operatingProfit,
					),
				roe: null,
			};
		},
	);
};

const fetchFinancialRows = async (
	corpCode: string,
	year: number,
	reportCode: string,
): Promise<any[] | null> => {
	const response =
		await dartGet<any>(
			"fnlttSinglAcnt.json",
			{
				corp_code:
					corpCode,
				bsns_year:
					String(year),
				reprt_code:
					reportCode,
			},
		);

	const rows =
		Array.isArray(
			response.list,
		)
			? response.list
			: [];

	if (rows.length === 0) {
		return null;
	}

	const selected =
		chooseFinancialRows(
			rows,
		);

	return selected.length > 0
		? selected
		: rows;
};

const findLatestAnnualFinancials =
	async (
		corpCode: string,
	): Promise<
		FinancialPeriodSummary[]
	> => {
	const currentYear =
		new Date().getFullYear();

	for (
		let year =
			currentYear - 1;
		year >=
			Math.max(
				currentYear - 5,
				2015,
			);
		year -= 1
	) {
		const rows =
			await fetchFinancialRows(
				corpCode,
				year,
				"11011",
			);

		if (rows) {
			return buildAnnualPeriods(
				rows,
				year,
			);
		}
	}

	return [];
};

const QUARTER_REPORTS = [
	{
		code: "11014",
		label: "3분기",
	},
	{
		code: "11012",
		label: "반기",
	},
	{
		code: "11013",
		label: "1분기",
	},
] as const;

const buildQuarterPeriod = (
	rows: any[],
	year: number,
	reportLabel: string,
): FinancialPeriodSummary => {
	const accounts =
		getFinancialAccounts(
			rows,
		);

	const readCurrent =
		(account: any):
			number | null =>
			toNumberOrNull(
				account
					?.thstrm_add_amount ??
				account?.thstrm_amount,
			);

	const revenue =
		readCurrent(
			accounts.revenue,
		);

	const operatingProfit =
		readCurrent(
			accounts.operatingProfit,
		);

	const netIncome =
		readCurrent(
			accounts.netIncome,
		);

	return {
		period:
			`${year} ${reportLabel}`,
		revenue,
		operatingProfit,
		netIncome,
		operatingMargin:
			calculateOperatingMargin(
				revenue,
				operatingProfit,
			),
		roe: null,
	};
};

const findLatestQuarterlyFinancials =
	async (
		corpCode: string,
	): Promise<
		FinancialPeriodSummary[]
	> => {
	const currentYear =
		new Date().getFullYear();

	const periods:
		FinancialPeriodSummary[] =
		[];

	for (
		let year = currentYear;
		year >= currentYear - 2;
		year -= 1
	) {
		for (
			const report of
				QUARTER_REPORTS
		) {
			const rows =
				await fetchFinancialRows(
					corpCode,
					year,
					report.code,
				);

			if (!rows) {
				continue;
			}

			periods.push(
				buildQuarterPeriod(
					rows,
					year,
					report.label,
				),
			);

			if (
				periods.length >= 3
			) {
				return periods;
			}
		}
	}

	return periods;
};

const fetchLatestListedShares =
	async (
		corpCode: string,
	): Promise<number | null> => {
	const currentYear =
		new Date().getFullYear();

	for (
		let year =
			currentYear - 1;
		year >=
			Math.max(
				currentYear - 4,
				2015,
			);
		year -= 1
	) {
		const response =
			await dartGet<any>(
				"stockTotqySttus.json",
				{
					corp_code:
						corpCode,
					bsns_year:
						String(year),
					reprt_code:
						"11011",
				},
			);

		const rows =
			Array.isArray(
				response.list,
			)
				? response.list
				: [];

		if (rows.length === 0) {
			continue;
		}

		const totalRow =
			rows.find(
				(row) =>
					String(
						row?.se ||
							"",
					).includes(
						"합계",
					),
			) || rows[0];

		const listedShares =
			toNumberOrNull(
				totalRow
					?.istc_totqy,
			);

		if (
			listedShares !== null
		) {
			return listedShares;
		}
	}

	return null;
};

export const fetchDartStockDetail =
	async (
		symbolInput: string,
	): Promise<
		DartStockDetailData | null
	> => {
	if (!isDartConfigured()) {
		return null;
	}

	const symbol =
		normalizeStockSymbol(
			symbolInput,
		);

	const cached =
		detailCache.get(symbol);

	if (
		cached &&
		cached.expiresAt >
			Date.now()
	) {
		return cached.data;
	}

	try {
		const corpCodeMap =
			await loadCorpCodeMap();

		const corpCode =
			corpCodeMap.get(
				symbol,
			);

		if (!corpCode) {
			return null;
		}

		const [
			company,
			annualFinancials,
			quarterlyFinancials,
			listedShares,
		] = await Promise.all([
			dartGet<any>(
				"company.json",
				{
					corp_code:
						corpCode,
				},
			),
			findLatestAnnualFinancials(
				corpCode,
			),
			findLatestQuarterlyFinancials(
				corpCode,
			),
			fetchLatestListedShares(
				corpCode,
			),
		]);

		const data:
			DartStockDetailData = {
			corpCode,
			homepageUrl:
				normalizeUrl(
					company.hm_url,
				),
			irUrl:
				normalizeUrl(
					company.ir_url,
				),
			companyNameEng:
				String(
					company.corp_name_eng ||
						"",
				).trim() ||
				null,
			ceoName:
				String(
					company.ceo_nm ||
						"",
				).trim() ||
				null,
			address:
				String(
					company.adres ||
						"",
				).trim() ||
				null,
			industryCode:
				String(
					company.induty_code ||
						"",
				).trim() ||
				null,
			establishedDate:
				String(
					company.est_dt ||
						"",
				).trim() ||
				null,
			fiscalMonth:
				String(
					company.acc_mt ||
						"",
				).trim() ||
				null,
			listedShares,
			annualFinancials,
			quarterlyFinancials,
			fetchedAt:
				new Date(),
		};

		detailCache.set(
			symbol,
			{
				expiresAt:
					Date.now() +
					DETAIL_CACHE_TTL_MS,
				data,
			},
		);

		return data;
	} catch (error) {
		console.warn(
			`OpenDART 상세 조회 실패: ${symbol}`,
			error,
		);

		return null;
	}
};
