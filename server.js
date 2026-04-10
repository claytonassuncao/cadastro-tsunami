const http = require("http");
const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");
const { PRICING_RULES, getPricingRule } = require("./pricing-rules");

function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return;
    }

    const fileContent = fs.readFileSync(filePath, "utf8");
    const lines = fileContent.split(/\r?\n/);

    for (const line of lines) {
        const trimmedLine = line.trim();

        if (!trimmedLine || trimmedLine.startsWith("#")) {
            continue;
        }

        const separatorIndex = trimmedLine.indexOf("=");
        if (separatorIndex === -1) {
            continue;
        }

        const key = trimmedLine.slice(0, separatorIndex).trim();
        const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
        const value = rawValue.replace(/^['"]|['"]$/g, "");

        if (key && process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
}

loadEnvFile(path.join(__dirname, ".env"));

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const REGISTRATIONS_FILE = path.join(DATA_DIR, "registrations.json");
const DEFAULT_ASAAS_API_BASE_URL = "https://api.asaas.com/v3";
const DEFAULT_ASAAS_USER_AGENT = "dbv-tsunami";
const DEFAULT_ENVIRONMENT = normalizeEnvironment(process.env.ASAAS_DEFAULT_ENVIRONMENT || "development");
const ASAAS_ENVIRONMENTS = {
    development: {
        key: "development",
        label: "Desenvolvimento",
        apiBaseUrl: process.env.ASAAS_DEVELOPMENT_API_BASE_URL || process.env.ASAAS_API_BASE_URL || DEFAULT_ASAAS_API_BASE_URL,
        accessToken: process.env.ASAAS_DEVELOPMENT_ACCESS_TOKEN || process.env.ASAAS_ACCESS_TOKEN || "",
        userAgent: process.env.ASAAS_DEVELOPMENT_USER_AGENT || process.env.ASAAS_USER_AGENT || DEFAULT_ASAAS_USER_AGENT
    },
    production: {
        key: "production",
        label: "Producao",
        apiBaseUrl: process.env.ASAAS_PRODUCTION_API_BASE_URL || process.env.ASAAS_API_BASE_URL || DEFAULT_ASAAS_API_BASE_URL,
        accessToken: process.env.ASAAS_PRODUCTION_ACCESS_TOKEN || process.env.ASAAS_ACCESS_TOKEN || "",
        userAgent: process.env.ASAAS_PRODUCTION_USER_AGENT || process.env.ASAAS_USER_AGENT || DEFAULT_ASAAS_USER_AGENT
    }
};
const SUBSCRIPTION_ENABLED = parseBooleanEnv(process.env.ASAAS_SUBSCRIPTION_ENABLED, true);
const SUBSCRIPTION_BILLING_TYPE = process.env.ASAAS_SUBSCRIPTION_BILLING_TYPE || "BOLETO";
const SUBSCRIPTION_CYCLE = process.env.ASAAS_SUBSCRIPTION_CYCLE || "MONTHLY";
const SUBSCRIPTION_DUE_DAY = clampDayOfMonth(process.env.ASAAS_SUBSCRIPTION_DUE_DAY || 10);
const SUBSCRIPTION_DESCRIPTION_PREFIX = process.env.ASAAS_SUBSCRIPTION_DESCRIPTION_PREFIX || "Clube Tsunami";
const SUBSCRIPTION_FIRST_DUE_DATE = process.env.ASAAS_SUBSCRIPTION_FIRST_DUE_DATE || "";

const CONTENT_TYPES = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon"
};

function parseBooleanEnv(value, defaultValue) {
    if (value === undefined || value === null || value === "") {
        return defaultValue;
    }

    const normalizedValue = String(value).trim().toLowerCase();
    return !["0", "false", "no", "off"].includes(normalizedValue);
}

function clampDayOfMonth(value) {
    const numericValue = Number.parseInt(String(value), 10);

    if (Number.isNaN(numericValue)) {
        return 10;
    }

    return Math.min(31, Math.max(1, numericValue));
}

function setCorsHeaders(response) {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
}

function sendJson(response, statusCode, payload) {
    setCorsHeaders(response);
    response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(payload));
}

async function readRequestBody(request) {
    const chunks = [];

    for await (const chunk of request) {
        chunks.push(chunk);
    }

    return Buffer.concat(chunks).toString("utf8");
}

async function parseJsonRequestBody(request) {
    const rawBody = await readRequestBody(request);

    if (!rawBody) {
        return {};
    }

    try {
        return JSON.parse(rawBody);
    } catch (error) {
        throw new Error("JSON invalido no corpo da requisicao.");
    }
}

function trimToNull(value) {
    const normalizedValue = String(value ?? "").trim();
    return normalizedValue === "" ? null : normalizedValue;
}

function normalizeText(value) {
    return String(value ?? "").trim();
}

function normalizeUpperCase(value) {
    return normalizeText(value).toLocaleUpperCase("pt-BR");
}

function normalizeLowerCase(value) {
    return normalizeText(value).toLocaleLowerCase("pt-BR");
}

function normalizeEnvironment(value) {
    return String(value ?? "").trim().toLowerCase() === "production"
        ? "production"
        : "development";
}

function normalizeDigits(value) {
    return String(value ?? "").replace(/\D/g, "");
}

function normalizeNullableNumber(value) {
    const normalizedValue = trimToNull(value);

    if (normalizedValue === null) {
        return null;
    }

    const digitsOnly = normalizeDigits(normalizedValue);
    return digitsOnly === "" ? null : Number(digitsOnly);
}

function normalizeNullableDigits(value) {
    const digitsOnly = normalizeDigits(value);
    return digitsOnly === "" ? null : digitsOnly;
}

function formatCpf(value) {
    const digits = normalizeDigits(value).slice(0, 11);

    return digits
        .replace(/^(\d{3})(\d)/, "$1.$2")
        .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function cleanUndefinedFields(payload) {
    return Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== undefined)
    );
}

function buildRegistrationSummary(adventurerNames, notes, billing) {
    const summaryParts = [
        `QTD. DESBRAVADORES: ${billing.adventurerCount}`,
        `VALOR TOTAL A PAGAR: R$ ${billing.amount.toFixed(2).replace(".", ",")}`,
        `FAIXA: ${billing.ruleLabel.toLocaleUpperCase("pt-BR")}`,
        `DESBRAVADORES: ${adventurerNames.join(", ")}`
    ];

    if (notes) {
        summaryParts.unshift(notes);
    }

    return summaryParts.join(" | ");
}

function buildLocalRegistrationId() {
    return `reg_${randomUUID()}`;
}

function getLastDayOfMonth(year, monthIndex) {
    return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function formatDateToIso(date) {
    return date.toISOString().slice(0, 10);
}

function getNextDueDate() {
    if (SUBSCRIPTION_FIRST_DUE_DATE) {
        return SUBSCRIPTION_FIRST_DUE_DATE;
    }

    const today = new Date();
    const currentYear = today.getUTCFullYear();
    const currentMonth = today.getUTCMonth();
    const currentDay = today.getUTCDate();

    const useCurrentMonth = currentDay <= SUBSCRIPTION_DUE_DAY;
    const year = useCurrentMonth ? currentYear : currentMonth === 11 ? currentYear + 1 : currentYear;
    const monthIndex = useCurrentMonth ? currentMonth : (currentMonth + 1) % 12;
    const lastDayOfMonth = getLastDayOfMonth(year, monthIndex);
    const dueDay = Math.min(SUBSCRIPTION_DUE_DAY, lastDayOfMonth);

    return formatDateToIso(new Date(Date.UTC(year, monthIndex, dueDay)));
}

async function ensureRegistrationsFile() {
    await fsPromises.mkdir(DATA_DIR, { recursive: true });

    try {
        await fsPromises.access(REGISTRATIONS_FILE);
    } catch (error) {
        await fsPromises.writeFile(REGISTRATIONS_FILE, "[]\n", "utf8");
    }
}

async function readRegistrations() {
    await ensureRegistrationsFile();
    const fileContent = await fsPromises.readFile(REGISTRATIONS_FILE, "utf8");

    if (!fileContent.trim()) {
        return [];
    }

    try {
        const parsedContent = JSON.parse(fileContent);
        return Array.isArray(parsedContent) ? parsedContent : [];
    } catch (error) {
        throw new Error("Arquivo de registros local esta invalido.");
    }
}

async function writeRegistrations(registrations) {
    await ensureRegistrationsFile();
    await fsPromises.writeFile(
        REGISTRATIONS_FILE,
        `${JSON.stringify(registrations, null, 2)}\n`,
        "utf8"
    );
}

async function saveRegistrationRecord(record) {
    const registrations = await readRegistrations();
    const existingRecordIndex = registrations.findIndex((item) => item.id === record.id);

    if (existingRecordIndex >= 0) {
        registrations[existingRecordIndex] = record;
    } else {
        registrations.push(record);
    }

    await writeRegistrations(registrations);
}

function sanitizeCustomerPayload(rawCustomer = {}) {
    return {
        name: normalizeUpperCase(rawCustomer.name),
        cpfCnpj: trimToNull(normalizeText(rawCustomer.cpfCnpj)),
        email: normalizeLowerCase(rawCustomer.email),
        phone: normalizeNullableDigits(rawCustomer.phone),
        mobilePhone: normalizeNullableDigits(rawCustomer.mobilePhone),
        address: trimToNull(normalizeUpperCase(rawCustomer.address)),
        addressNumber: normalizeNullableNumber(rawCustomer.addressNumber),
        complement: trimToNull(normalizeUpperCase(rawCustomer.complement)),
        province: trimToNull(normalizeUpperCase(rawCustomer.province)),
        postalCode: trimToNull(normalizeText(rawCustomer.postalCode)),
        externalReference: trimToNull(rawCustomer.externalReference),
        notificationDisabled: Boolean(rawCustomer.notificationDisabled),
        additionalEmails: trimToNull(normalizeLowerCase(rawCustomer.additionalEmails)),
        municipalInscription: normalizeNullableNumber(rawCustomer.municipalInscription),
        stateInscription: normalizeNullableNumber(rawCustomer.stateInscription),
        observations: trimToNull(normalizeUpperCase(rawCustomer.observations)),
        groupName: trimToNull(normalizeUpperCase(rawCustomer.groupName)),
        company: trimToNull(normalizeUpperCase(rawCustomer.company)),
        foreignCustomer: Boolean(rawCustomer.foreignCustomer)
    };
}

function sanitizeAdventurers(rawAdventurers = []) {
    if (!Array.isArray(rawAdventurers)) {
        return [];
    }

    return rawAdventurers
        .map((adventurer, index) => {
            const nameValue = typeof adventurer === "string" ? adventurer : adventurer?.name;
            const normalizedName = normalizeUpperCase(nameValue);

            if (!normalizedName) {
                return null;
            }

            return {
                id: trimToNull(adventurer?.id) || `adv_${index + 1}`,
                name: normalizedName
            };
        })
        .filter(Boolean);
}

function validateRegistrationPayload(registration) {
    if (!registration.customer.name || !registration.customer.email || !registration.customer.cpfCnpj) {
        return "Preencha nome, e-mail e CPF do responsavel.";
    }

    if (registration.adventurers.length === 0) {
        return "Informe pelo menos um desbravador vinculado.";
    }

    return null;
}

function buildBilling(adventurers) {
    const adventurerCount = Math.max(1, adventurers.length);
    const rule = getPricingRule(adventurerCount);

    return {
        adventurerCount,
        amount: Number(rule.amount),
        ruleLabel: rule.label
    };
}

function normalizeRegistrationPayload(rawPayload = {}) {
    const customer = sanitizeCustomerPayload(rawPayload.customer);
    const adventurers = sanitizeAdventurers(rawPayload.adventurers);
    const notes = trimToNull(normalizeUpperCase(rawPayload.notes));
    const billing = buildBilling(adventurers);

    return {
        version: trimToNull(rawPayload.version) || "v1.0",
        environment: normalizeEnvironment(rawPayload.environment || DEFAULT_ENVIRONMENT),
        customer: {
            ...customer,
            observations: trimToNull(buildRegistrationSummary(
                adventurers.map((adventurer) => adventurer.name),
                notes,
                billing
            ))
        },
        adventurers,
        notes,
        billing
    };
}

function getEnvironmentConfig(environment) {
    const normalizedEnvironment = normalizeEnvironment(environment);
    return ASAAS_ENVIRONMENTS[normalizedEnvironment];
}

function buildAsaasCustomerPayload(registration) {
    return cleanUndefinedFields({
        ...registration.customer
    });
}

function buildAsaasSubscriptionPayload(customerId, registration) {
    return cleanUndefinedFields({
        customer: customerId,
        billingType: SUBSCRIPTION_BILLING_TYPE,
        value: registration.billing.amount,
        nextDueDate: getNextDueDate(),
        cycle: SUBSCRIPTION_CYCLE,
        description: `${SUBSCRIPTION_DESCRIPTION_PREFIX} - ${registration.customer.name}`,
        externalReference: registration.customer.externalReference || registration.id
    });
}

async function callAsaasApi(endpoint, payload, environmentConfig) {
    if (!environmentConfig?.accessToken) {
        throw new Error(`Token do Asaas nao configurado para o ambiente ${environmentConfig?.label || "selecionado"}.`);
    }

    const response = await fetch(`${environmentConfig.apiBaseUrl}${endpoint}`, {
        method: "POST",
        headers: {
            accept: "application/json",
            "Content-Type": "application/json",
            "User-Agent": environmentConfig.userAgent,
            access_token: environmentConfig.accessToken
        },
        body: JSON.stringify(payload)
    });

    const rawResponse = await response.text();
    let parsedResponse = null;

    try {
        parsedResponse = rawResponse ? JSON.parse(rawResponse) : null;
    } catch (error) {
        parsedResponse = rawResponse || null;
    }

    return {
        ok: response.ok,
        status: response.status,
        headers: response.headers,
        data: parsedResponse
    };
}

function extractAsaasErrorMessage(asaasResponse, fallbackMessage) {
    const payload = asaasResponse?.data;

    if (payload && Array.isArray(payload.errors) && payload.errors.length > 0) {
        return payload.errors.map((item) => item.description || item.code).join(" | ");
    }

    if (payload && typeof payload === "object") {
        const message = [payload.message, payload.details, payload.error]
            .filter(Boolean)
            .join(" | ");

        if (message) {
            return message;
        }
    }

    if (typeof payload === "string" && payload.trim()) {
        return payload;
    }

    return fallbackMessage;
}

function summarizeRegistration(record) {
    return {
        id: record.id,
        version: record.version,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        status: record.status,
        environment: record.environment,
        customer: {
            name: record.customer.name,
            email: record.customer.email,
            cpfCnpj: record.customer.cpfCnpj
        },
        adventurers: record.adventurers,
        billing: record.billing
    };
}

async function proxyCustomerCreation(request, response) {
    try {
        const body = await parseJsonRequestBody(request);
        const environment = normalizeEnvironment(body.environment || DEFAULT_ENVIRONMENT);
        const environmentConfig = getEnvironmentConfig(environment);

        if (!environmentConfig?.accessToken) {
            sendJson(response, 500, {
                message: `Token do Asaas nao configurado para o ambiente ${environmentConfig?.label || environment}.`
            });
            return;
        }

        const { environment: ignoredEnvironment, ...customerPayload } = body;
        void ignoredEnvironment;

        const asaasResponse = await callAsaasApi("/customers", customerPayload, environmentConfig);

        setCorsHeaders(response);
        response.writeHead(asaasResponse.status, {
            "Content-Type": asaasResponse.headers.get("content-type") || "application/json; charset=utf-8"
        });
        response.end(JSON.stringify(asaasResponse.data));
    } catch (error) {
        console.error("Erro ao comunicar com o Asaas:", error);
        sendJson(response, 502, {
            message: "Falha ao comunicar com a API do Asaas.",
            details: error.message
        });
    }
}

async function handleCreateRegistration(request, response) {
    let localRecord = null;

    try {
        const rawPayload = await parseJsonRequestBody(request);
        const normalizedRegistration = normalizeRegistrationPayload(rawPayload);
        const validationError = validateRegistrationPayload(normalizedRegistration);

        if (validationError) {
            sendJson(response, 400, {
                message: validationError
            });
            return;
        }

        const now = new Date().toISOString();
        const environmentConfig = getEnvironmentConfig(normalizedRegistration.environment);
        localRecord = {
            id: buildLocalRegistrationId(),
            version: normalizedRegistration.version,
            createdAt: now,
            updatedAt: now,
            status: "saved_locally",
            environment: normalizedRegistration.environment,
            customer: normalizedRegistration.customer,
            adventurers: normalizedRegistration.adventurers,
            notes: normalizedRegistration.notes,
            billing: normalizedRegistration.billing,
            pricingRules: PRICING_RULES,
            asaas: {
                customer: null,
                subscription: null
            },
            warnings: []
        };

        if (!environmentConfig?.accessToken) {
            localRecord.warnings.push(
                `Token do Asaas nao configurado para o ambiente ${environmentConfig?.label || normalizedRegistration.environment}. Registro salvo apenas localmente.`
            );
            await saveRegistrationRecord(localRecord);
            sendJson(response, 201, {
                message: "Cadastro salvo localmente.",
                registration: summarizeRegistration(localRecord),
                asaas: localRecord.asaas,
                environment: {
                    key: localRecord.environment,
                    label: environmentConfig?.label || localRecord.environment
                },
                warnings: localRecord.warnings
            });
            return;
        }

        const customerPayload = buildAsaasCustomerPayload(localRecord);
        const customerResponse = await callAsaasApi("/customers", customerPayload, environmentConfig);

        if (!customerResponse.ok) {
            localRecord.status = "asaas_customer_failed";
            localRecord.warnings.push(extractAsaasErrorMessage(
                customerResponse,
                "Falha ao criar cliente no Asaas."
            ));
            localRecord.updatedAt = new Date().toISOString();
            await saveRegistrationRecord(localRecord);

            sendJson(response, 201, {
                message: "Cadastro salvo com falha na integracao do cliente Asaas.",
                registration: summarizeRegistration(localRecord),
                asaas: localRecord.asaas,
                environment: {
                    key: localRecord.environment,
                    label: environmentConfig.label
                },
                warnings: localRecord.warnings
            });
            return;
        }

        localRecord.asaas.customer = customerResponse.data;
        localRecord.status = "asaas_customer_created";
        localRecord.updatedAt = new Date().toISOString();

        if (!SUBSCRIPTION_ENABLED) {
            localRecord.warnings.push("Assinatura recorrente desativada por configuracao no servidor.");
            await saveRegistrationRecord(localRecord);

            sendJson(response, 201, {
                message: "Cadastro salvo e cliente criado no Asaas.",
                registration: summarizeRegistration(localRecord),
                asaas: localRecord.asaas,
                environment: {
                    key: localRecord.environment,
                    label: environmentConfig.label
                },
                warnings: localRecord.warnings
            });
            return;
        }

        const subscriptionPayload = buildAsaasSubscriptionPayload(localRecord.asaas.customer.id, localRecord);
        const subscriptionResponse = await callAsaasApi("/subscriptions", subscriptionPayload, environmentConfig);

        if (!subscriptionResponse.ok) {
            localRecord.status = "asaas_subscription_failed";
            localRecord.warnings.push(extractAsaasErrorMessage(
                subscriptionResponse,
                "Falha ao criar assinatura recorrente no Asaas."
            ));
        } else {
            localRecord.asaas.subscription = subscriptionResponse.data;
            localRecord.status = "completed";
        }

        localRecord.updatedAt = new Date().toISOString();
        await saveRegistrationRecord(localRecord);

        sendJson(response, 201, {
            message: localRecord.warnings.length > 0
                ? "Cadastro salvo com ressalvas."
                : "Cadastro e assinatura registrados com sucesso.",
            registration: summarizeRegistration(localRecord),
            asaas: localRecord.asaas,
            environment: {
                key: localRecord.environment,
                label: environmentConfig.label
            },
            warnings: localRecord.warnings
        });
    } catch (error) {
        console.error("Erro ao processar registro:", error);

        if (localRecord) {
            localRecord.status = "server_error";
            localRecord.updatedAt = new Date().toISOString();
            localRecord.warnings.push(error.message);

            try {
                await saveRegistrationRecord(localRecord);
            } catch (persistError) {
                console.error("Erro ao persistir registro com falha:", persistError);
            }
        }

        sendJson(response, 500, {
            message: "Nao foi possivel processar o cadastro.",
            details: error.message
        });
    }
}

async function handleListRegistrations(response) {
    try {
        const registrations = await readRegistrations();
        sendJson(response, 200, {
            items: registrations.map(summarizeRegistration)
        });
    } catch (error) {
        sendJson(response, 500, {
            message: "Nao foi possivel listar os registros locais.",
            details: error.message
        });
    }
}

async function serveStaticFile(request, response) {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    let filePath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
    filePath = decodeURIComponent(filePath);

    const resolvedPath = path.normalize(path.join(ROOT_DIR, filePath));
    if (!resolvedPath.startsWith(ROOT_DIR)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
    }

    try {
        const fileBuffer = await fsPromises.readFile(resolvedPath);
        const extension = path.extname(resolvedPath).toLowerCase();
        const contentType = CONTENT_TYPES[extension] || "application/octet-stream";

        response.writeHead(200, { "Content-Type": contentType });
        response.end(fileBuffer);
    } catch (error) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Arquivo nao encontrado.");
    }
}

const server = http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    const pathname = requestUrl.pathname;

    if (request.method === "OPTIONS") {
        setCorsHeaders(response);
        response.writeHead(204);
        response.end();
        return;
    }

    if (pathname === "/api/customers" && request.method === "POST") {
        await proxyCustomerCreation(request, response);
        return;
    }

    if (pathname === "/api/registrations" && request.method === "POST") {
        await handleCreateRegistration(request, response);
        return;
    }

    if (pathname === "/api/registrations" && request.method === "GET") {
        await handleListRegistrations(response);
        return;
    }

    await serveStaticFile(request, response);
});

server.listen(PORT, () => {
    console.log(`Servidor disponivel em http://localhost:${PORT}`);
});
