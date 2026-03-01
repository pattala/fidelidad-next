import handler from './api/check-birthdays.js';
import dotenv from 'dotenv';
dotenv.config();

const req = {
    method: 'POST',
    url: '/api/check-birthdays?mode=daily',
    query: { mode: 'daily' },
    body: {
        simulatedDate: '2026-03-05T00:00:00Z',
    },
    headers: {
        'x-api-key': process.env.API_SECRET_KEY,
        'host': 'localhost:5173'
    }
};

const res = {
    status: (code) => {
        console.log(`Status: ${code}`);
        return res;
    },
    json: (data) => {
        console.log(`Response JSON: ${JSON.stringify(data, null, 2)}`);
        return res;
    },
    end: () => {
        console.log('Response End');
    }
};

async function test() {
    console.log('Testing handler...');
    await handler(req, res);
    process.exit(0);
}

test();
