import handler from "../api/engine-campaigns.js";
import fs from "fs";
import path from "path";

const credsPath = path.resolve("./.dev_creds.json");
const rawCreds = JSON.parse(fs.readFileSync(credsPath, "utf8"));
const sa = JSON.parse(rawCreds.credentials);

// Set environment variables for the local invocation
process.env.GOOGLE_CREDENTIALS_JSON = rawCreds.credentials;
process.env.SMTP_USER = "rampet.local@gmail.com";
process.env.SMTP_PASS = "oojd czlt esjk yoas";

const mockReq = {
    method: "POST",
    headers: {
        "x-vercel-cron": "true"
    },
    query: {
        trigger: "manual",
        ignoreDeduplication: "true"
    },
    body: {}
};

const mockRes = {
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(data) {
        this.jsonData = data;
        return this;
    },
    end() {
        return this;
    }
};

async function test() {
    console.log("🏃 Executing Campaign Engine locally to test the new audit logging...");
    await handler(mockReq, mockRes);
    console.log(`\nResponse Code: ${mockRes.statusCode}`);
    console.log("Response Body:", JSON.stringify(mockRes.jsonData, null, 2));
}

test().catch(console.error);
