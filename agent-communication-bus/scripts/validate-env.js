#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const envFilePath = path.join(projectRoot, '.env');

const envFromFile = {};

if (fs.existsSync(envFilePath)) {
  const content = fs.readFileSync(envFilePath, 'utf8');

  content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .forEach(line => {
      const index = line.indexOf('=');
      if (index === -1) return;
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim();
      envFromFile[key] = value;
    });
}

const requiredVars = [
  'AGENT_BUS_PORT',
  'AGENT_BUS_HOST',
  'AGENT_BUS_API_KEY',
  'DATABASE_URL',
  'REDIS_URL'
];

const recommendedVars = [
  'AGENT_BUS_MAX_CONNECTIONS',
  'AGENT_BUS_HEARTBEAT_INTERVAL',
  'AGENT_BUS_MESSAGE_TIMEOUT',
  'AGENT_BUS_PERSISTENCE_ENABLED',
  'AGENT_BUS_ENCRYPTION_ENABLED',
  'AGENT_API_KEY',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DB'
];

const booleanVars = [
  'AGENT_BUS_PERSISTENCE_ENABLED',
  'AGENT_BUS_ENCRYPTION_ENABLED'
];

const numericVars = {
  AGENT_BUS_PORT: { min: 1, max: 65535 },
  AGENT_BUS_MAX_CONNECTIONS: { min: 1, max: 100000 },
  AGENT_BUS_HEARTBEAT_INTERVAL: { min: 1000 },
  AGENT_BUS_MESSAGE_TIMEOUT: { min: 1000 },
  POSTGRES_PORT: { min: 1, max: 65535 },
  REDIS_PORT: { min: 1, max: 65535 },
  OPENCODE_MAX_CONCURRENT_TASKS: { min: 1 },
  CODEX_MAX_CONCURRENT_TASKS: { min: 1 },
  CLAUDE_MAX_CONCURRENT_TASKS: { min: 1 }
};

function getVar(name) {
  const raw = process.env[name];
  if (raw !== undefined && raw !== '') {
    return raw;
  }
  if (envFromFile[name] !== undefined) {
    return envFromFile[name];
  }
  return undefined;
}

const errors = [];
const warnings = [];

requiredVars.forEach(name => {
  const value = getVar(name);
  if (value === undefined || value === '') {
    errors.push(`Missing required variable: ${name}`);
  }
});

recommendedVars.forEach(name => {
  const value = getVar(name);
  if (value === undefined || value === '') {
    warnings.push(`Recommended variable not set: ${name}`);
  }
});

booleanVars.forEach(name => {
  const value = getVar(name);
  if (value === undefined || value === '') {
    return;
  }

  if (!['true', 'false'].includes(value.toLowerCase())) {
    errors.push(`Invalid boolean value for ${name}: ${value}`);
  }
});

Object.entries(numericVars).forEach(([name, bounds]) => {
  const value = getVar(name);
  if (value === undefined || value === '') {
    return;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    errors.push(`Invalid numeric value for ${name}: ${value}`);
    return;
  }

  if (bounds.min !== undefined && parsed < bounds.min) {
    errors.push(`Value for ${name} is below minimum ${bounds.min}: ${value}`);
  }

  if (bounds.max !== undefined && parsed > bounds.max) {
    errors.push(`Value for ${name} is above maximum ${bounds.max}: ${value}`);
  }
});

function checkPlaceholder(name) {
  const value = getVar(name);
  if (!value) {
    return;
  }

  if (value.toLowerCase() === 'change-me' || value.toLowerCase() === 'changeme') {
    warnings.push(`Variable ${name} is using placeholder value "${value}"`);
  }
}

['AGENT_BUS_API_KEY', 'AGENT_API_KEY'].forEach(checkPlaceholder);

if (errors.length) {
  console.error('Environment validation failed:');
  errors.forEach(err => console.error(`  - ${err}`));

  if (warnings.length) {
    console.warn('\nWarnings:');
    warnings.forEach(warn => console.warn(`  - ${warn}`));
  }

  process.exit(1);
}

console.log('Environment variables look good ✅');
if (warnings.length) {
  console.log('\nWarnings:');
  warnings.forEach(warn => console.log(`  - ${warn}`));
}
