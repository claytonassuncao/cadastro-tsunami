const http = require("http");
const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");

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
const ASAAS_URL = "https://api.asaas.com/v3/customers";
const ACCESS_TOKEN = process.env.ASAAS_ACCESS_TOKEN || "";
const USER_AGENT = process.env.ASAAS_USER_AGENT || "dbv-tsunami";

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

async function proxyCustomerCreation(request, response) {
    if (!ACCESS_TOKEN) {
        sendJson(response, 500, {
            message: "Token do Asaas nao configurado no servidor local."
        });
        return;
    }

    try {
        const body = await readRequestBody(request);
        const asaasResponse = await fetch(ASAAS_URL, {
            method: "POST",
            headers: {
                accept: "application/json",
                "Content-Type": "application/json",
                "User-Agent": USER_AGENT,
                access_token: ACCESS_TOKEN
            },
            body
        });

        const rawResponse = await asaasResponse.text();
        setCorsHeaders(response);
        response.writeHead(asaasResponse.status, {
            "Content-Type": asaasResponse.headers.get("content-type") || "application/json; charset=utf-8"
        });
        response.end(rawResponse);
    } catch (error) {
        console.error("Erro ao comunicar com o Asaas:", error);
        sendJson(response, 502, {
            message: "Falha ao comunicar com a API do Asaas.",
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
    if (request.method === "OPTIONS") {
        setCorsHeaders(response);
        response.writeHead(204);
        response.end();
        return;
    }

    if (request.url === "/api/customers" && request.method === "POST") {
        await proxyCustomerCreation(request, response);
        return;
    }

    await serveStaticFile(request, response);
});

server.listen(PORT, () => {
    console.log(`Servidor disponivel em http://localhost:${PORT}`);
});
