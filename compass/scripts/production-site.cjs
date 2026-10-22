const fs = require('node:fs');
const path = require('node:path');

const configPath = path.resolve(__dirname, '../.forge/production.json');

if (!fs.existsSync(configPath)) {
    console.error(
        'Missing .forge/production.json. See production.site.example.json for its format.'
    );
    process.exit(1);
}

let config;
try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch {
    console.error('Could not parse .forge/production.json as JSON.');
    process.exit(1);
}

if (typeof config.site !== 'string') {
    console.error('Set "site" in .forge/production.json to your Jira site hostname.');
    process.exit(1);
}

let site;
try {
    site = new URL(config.site.includes('://') ? config.site : `https://${config.site}`);
} catch {
    console.error('The production site must be a valid HTTPS Jira site hostname.');
    process.exit(1);
}

if (
    site.protocol !== 'https:' ||
    !/^[a-z0-9-]+\.atlassian\.net$/i.test(site.hostname) ||
    site.pathname !== '/' ||
    site.search ||
    site.hash
) {
    console.error('The production site must be a Jira hostname such as your-site.atlassian.net.');
    process.exit(1);
}

process.stdout.write(`${site.hostname}\n`);
