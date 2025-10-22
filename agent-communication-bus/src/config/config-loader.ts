import fs from 'fs';
import path from 'path';
import { CommunicationBusConfig } from '../types/protocol';
import { OpenCodeConfig } from '../adapters/opencode-adapter';
import { CodexConfig } from '../adapters/codex-adapter';
import { ClaudeCodeConfig } from '../adapters/claude-code-adapter';

export interface ConfigLoadOptions {
  env?: string;
  configDir?: string;
}

export interface AdapterConfiguration<TConfig> {
  enabled: boolean;
  agentId: string;
  config: TConfig;
}

export interface SystemConfiguration {
  bus: CommunicationBusConfig;
  security: {
    apiKey: string;
  };
  persistence: {
    databaseUrl?: string;
    redisUrl?: string;
  };
  adapters: {
    opencode?: AdapterConfiguration<OpenCodeConfig>;
    codex?: AdapterConfiguration<CodexConfig>;
    claudeCode?: AdapterConfiguration<ClaudeCodeConfig>;
  };
}

type JsonValue = Record<string, unknown> | Array<unknown> | string | number | boolean | null | undefined;

const DEFAULT_ENV = 'development';
const DEFAULT_FILE = 'default.json';
const PRODUCTION_FILE = 'production.json';

export function loadConfiguration(options: ConfigLoadOptions = {}): SystemConfiguration {
  const resolvedEnv = resolveEnvironment(options.env);
  const configDirectory = resolveConfigDirectory(options.configDir);
  const defaultConfigPath = path.join(configDirectory, DEFAULT_FILE);

  if (!fs.existsSync(defaultConfigPath)) {
    throw new Error(`Configuration file not found: ${defaultConfigPath}`);
  }

  const defaultConfig = readConfigFile(defaultConfigPath);
  let mergedConfig = { ...defaultConfig };

  const envFile = determineEnvironmentFile(resolvedEnv);
  if (envFile && envFile !== DEFAULT_FILE) {
    const envConfigPath = path.join(configDirectory, envFile);
    if (fs.existsSync(envConfigPath)) {
      const envConfig = readConfigFile(envConfigPath);
      mergedConfig = deepMerge(mergedConfig, envConfig);
    }
  }

  return normalizeConfiguration(mergedConfig);
}

function resolveEnvironment(explicitEnv?: string): string {
  if (explicitEnv && explicitEnv.trim().length > 0) {
    return explicitEnv.trim().toLowerCase();
  }
  const inferred = process.env.AGENT_BUS_CONFIG_ENV || process.env.NODE_ENV;
  return inferred ? inferred.trim().toLowerCase() : DEFAULT_ENV;
}

function resolveConfigDirectory(explicitDir?: string): string {
  if (explicitDir) {
    return path.resolve(explicitDir);
  }
  return path.resolve(__dirname, '../../config');
}

function determineEnvironmentFile(env: string): string | null {
  if (env === 'production') {
    return PRODUCTION_FILE;
  }
  if (env === 'development' || env === 'dev') {
    return DEFAULT_FILE;
  }
  if (!env) {
    return DEFAULT_FILE;
  }
  return `${env}.json`;
}

function readConfigFile(filePath: string): Record<string, unknown> {
  const rawContent = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(rawContent) as JsonValue;
  const resolved = resolvePlaceholders(parsed);
  if (!isPlainObject(resolved)) {
    throw new Error(`Configuration file ${filePath} must export an object`);
  }
  return resolved;
}

function resolvePlaceholders(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(item => resolvePlaceholders(item as JsonValue)) as JsonValue;
  }

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    Object.entries(value).forEach(([key, entry]) => {
      result[key] = resolvePlaceholders(entry as JsonValue);
    });
    return result;
  }

  if (typeof value === 'string' && value.startsWith('env:')) {
    const envKey = value.slice(4);
    const envValue = process.env[envKey];
    return envValue === undefined ? undefined : envValue;
  }

  return value;
}

function deepMerge<T extends Record<string, unknown>>(base: T, overrides: Record<string, unknown>): T {
  const result: Record<string, unknown> = { ...base };

  Object.entries(overrides).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    const baseValue = result[key];
    if (isPlainObject(baseValue) && isPlainObject(value)) {
      result[key] = deepMerge(baseValue as Record<string, unknown>, value);
    } else if (Array.isArray(value)) {
      result[key] = value.slice();
    } else {
      result[key] = value;
    }
  });

  return result as T;
}

function normalizeConfiguration(raw: Record<string, unknown>): SystemConfiguration {
  const securityObject = isPlainObject(raw.security) ? raw.security as Record<string, unknown> : {};
  const securityApiKey = ensureString(securityObject.apiKey, 'security.apiKey', 'change-me');
  const busConfig = normalizeBusConfig(raw.bus ?? {}, securityApiKey);
  const persistenceConfig = normalizePersistenceConfig(raw.persistence ?? {});

  const adaptersRaw = isPlainObject(raw.adapters) ? raw.adapters as Record<string, unknown> : {};
  const adapters: SystemConfiguration['adapters'] = {};

  if (adaptersRaw.opencode) {
    adapters.opencode = normalizeOpenCodeAdapter(adaptersRaw.opencode as Record<string, unknown>);
  }

  if (adaptersRaw.codex) {
    adapters.codex = normalizeCodexAdapter(adaptersRaw.codex as Record<string, unknown>);
  }

  if (adaptersRaw.claudeCode) {
    adapters.claudeCode = normalizeClaudeCodeAdapter(adaptersRaw.claudeCode as Record<string, unknown>);
  }

  return {
    bus: busConfig,
    security: {
      apiKey: securityApiKey
    },
    persistence: persistenceConfig,
    adapters
  };
}

function normalizeBusConfig(raw: unknown, apiKey: string): CommunicationBusConfig {
  if (!isPlainObject(raw)) {
    throw new Error('Invalid configuration: bus must be an object');
  }

  const bus = raw as Record<string, unknown>;

  return {
    port: ensureNumber(bus.port, 'bus.port', 8080),
    host: ensureString(bus.host, 'bus.host', '0.0.0.0'),
    maxConnections: ensureNumber(bus.maxConnections, 'bus.maxConnections', 100),
    heartbeatInterval: ensureNumber(bus.heartbeatInterval, 'bus.heartbeatInterval', 30000),
    messageTimeout: ensureNumber(bus.messageTimeout, 'bus.messageTimeout', 300000),
    persistenceEnabled: ensureBoolean(bus.persistenceEnabled, 'bus.persistenceEnabled', false),
    encryptionEnabled: ensureBoolean(bus.encryptionEnabled, 'bus.encryptionEnabled', false),
    apiKey
  };
}

function normalizePersistenceConfig(raw: unknown): SystemConfiguration['persistence'] {
  const persistence: SystemConfiguration['persistence'] = {};

  if (!isPlainObject(raw)) {
    return persistence;
  }

  const persistenceRaw = raw as Record<string, unknown>;

  const databaseUrl = toOptionalString(persistenceRaw.databaseUrl);
  if (databaseUrl) {
    persistence.databaseUrl = databaseUrl;
  }

  const redisUrl = toOptionalString(persistenceRaw.redisUrl);
  if (redisUrl) {
    persistence.redisUrl = redisUrl;
  }

  return persistence;
}

function normalizeOpenCodeAdapter(raw: Record<string, unknown>): AdapterConfiguration<OpenCodeConfig> {
  const enabled = ensureBoolean(raw.enabled, 'adapters.opencode.enabled', true);
  const agentId = ensureString(raw.agentId, 'adapters.opencode.agentId', 'opencode://code-reviewer');
  const configRaw = toPlainObject(raw.config, 'adapters.opencode.config');

  const config: OpenCodeConfig = {
    binaryPath: ensureString(configRaw.binaryPath, 'adapters.opencode.config.binaryPath', '/usr/local/bin/opencode'),
    workingDirectory: ensureString(configRaw.workingDirectory, 'adapters.opencode.config.workingDirectory', '.')
  };

  const maxTasks = configRaw.maxConcurrentTasks !== undefined
    ? ensureNumber(configRaw.maxConcurrentTasks, 'adapters.opencode.config.maxConcurrentTasks', 3)
    : undefined;
  if (maxTasks !== undefined) {
    config.maxConcurrentTasks = maxTasks;
  }

  const timeout = configRaw.timeout !== undefined
    ? ensureNumber(configRaw.timeout, 'adapters.opencode.config.timeout')
    : undefined;
  if (timeout !== undefined) {
    config.timeout = timeout;
  }

  const environment = normalizeStringRecord(configRaw.environment, 'adapters.opencode.config.environment');
  if (environment) {
    config.environment = environment;
  }

  return {
    enabled,
    agentId,
    config
  };
}

function normalizeCodexAdapter(raw: Record<string, unknown>): AdapterConfiguration<CodexConfig> {
  const enabled = ensureBoolean(raw.enabled, 'adapters.codex.enabled', true);
  const agentId = ensureString(raw.agentId, 'adapters.codex.agentId', 'codex://frontend-developer');
  const configRaw = toPlainObject(raw.config, 'adapters.codex.config');

  const config: CodexConfig = {
    cliPath: ensureString(configRaw.cliPath, 'adapters.codex.config.cliPath', '/usr/local/bin/codex')
  };

  const apiKey = toOptionalString(configRaw.apiKey);
  if (apiKey) {
    config.apiKey = apiKey;
  }

  const baseUrl = toOptionalString(configRaw.baseUrl);
  if (baseUrl) {
    config.baseUrl = baseUrl;
  }

  const defaultModel = toOptionalString(configRaw.defaultModel);
  if (defaultModel) {
    config.defaultModel = defaultModel;
  }

  const timeout = configRaw.timeout !== undefined
    ? ensureNumber(configRaw.timeout, 'adapters.codex.config.timeout')
    : undefined;
  if (timeout !== undefined) {
    config.timeout = timeout;
  }

  const maxTasks = configRaw.maxConcurrentTasks !== undefined
    ? ensureNumber(configRaw.maxConcurrentTasks, 'adapters.codex.config.maxConcurrentTasks', 5)
    : undefined;
  if (maxTasks !== undefined) {
    config.maxConcurrentTasks = maxTasks;
  }

  const environment = normalizeStringRecord(configRaw.environment, 'adapters.codex.config.environment');
  if (environment) {
    config.environment = environment;
  }

  return {
    enabled,
    agentId,
    config
  };
}

function normalizeClaudeCodeAdapter(raw: Record<string, unknown>): AdapterConfiguration<ClaudeCodeConfig> {
  const enabled = ensureBoolean(raw.enabled, 'adapters.claudeCode.enabled', true);
  const agentId = ensureString(raw.agentId, 'adapters.claudeCode.agentId', 'claude-code://backend-architect');
  const configRaw = toPlainObject(raw.config, 'adapters.claudeCode.config');

  const config: ClaudeCodeConfig = {};

  const apiKey = toOptionalString(configRaw.apiKey ?? configRaw.claudeApiKey);
  if (apiKey) {
    config.claudeApiKey = apiKey;
  }

  const baseUrl = toOptionalString(configRaw.baseUrl);
  if (baseUrl) {
    config.baseUrl = baseUrl;
  }

  const defaultModel = toOptionalString(configRaw.defaultModel);
  if (defaultModel) {
    config.defaultModel = defaultModel;
  }

  const timeout = configRaw.timeout !== undefined
    ? ensureNumber(configRaw.timeout, 'adapters.claudeCode.config.timeout', 600000)
    : undefined;
  if (timeout !== undefined) {
    config.timeout = timeout;
  }

  const maxTasks = configRaw.maxConcurrentTasks !== undefined
    ? ensureNumber(configRaw.maxConcurrentTasks, 'adapters.claudeCode.config.maxConcurrentTasks', 3)
    : undefined;
  if (maxTasks !== undefined) {
    config.maxConcurrentTasks = maxTasks;
  }

  const workspacePath = toOptionalString(configRaw.workspacePath);
  if (workspacePath) {
    config.workspacePath = workspacePath;
  }

  if (isPlainObject(configRaw.projectContext)) {
    config.projectContext = configRaw.projectContext as Record<string, unknown>;
  }

  const executablePath = toOptionalString(configRaw.pathToClaudeCodeExecutable);
  if (executablePath) {
    config.pathToClaudeCodeExecutable = executablePath;
  }

  if (Array.isArray(configRaw.allowedTools)) {
    config.allowedTools = configRaw.allowedTools as string[];
  }

  if (Array.isArray(configRaw.disallowedTools)) {
    config.disallowedTools = configRaw.disallowedTools as string[];
  }

  const permissionMode = toOptionalPermissionMode(configRaw.permissionMode);
  if (permissionMode) {
    config.permissionMode = permissionMode;
  }

  if (Array.isArray(configRaw.settingSources)) {
    config.settingSources = configRaw.settingSources as ('user' | 'project' | 'local')[];
  }

  return {
    enabled,
    agentId,
    config
  };
}

function ensureNumber(value: unknown, field: string, fallback?: number): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`Configuration value for ${field} must be a number`);
}

function ensureBoolean(value: unknown, field: string, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
    throw new Error(`Configuration value for ${field} must be 'true' or 'false' when provided as a string`);
  }
  return fallback;
}

function ensureString(value: unknown, field: string, fallback: string): string {
  const parsed = toOptionalString(value);
  if (parsed !== undefined && parsed.length > 0) {
    return parsed;
  }
  if (value !== undefined && value !== null) {
    throw new Error(`Configuration value for ${field} must be a non-empty string`);
  }
  return fallback;
}

function toOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}

function toPlainObject(value: unknown, field: string): Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new Error(`Configuration value for ${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function normalizeStringRecord(value: unknown, field: string): Record<string, string> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isPlainObject(value)) {
    throw new Error(`Configuration value for ${field} must be an object with string values`);
  }

  const record: Record<string, string> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    const parsed = toOptionalString(entry);
    if (parsed === undefined) {
      throw new Error(`Configuration value for ${field}.${key} must be a string`);
    }
    record[key] = parsed;
  });

  return record;
}

function toOptionalPermissionMode(value: unknown): ClaudeCodeConfig['permissionMode'] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string') {
    const allowed: Array<ClaudeCodeConfig['permissionMode']> = ['default', 'acceptEdits', 'bypassPermissions', 'plan'];
    if (allowed.includes(value as ClaudeCodeConfig['permissionMode'])) {
      return value as ClaudeCodeConfig['permissionMode'];
    }
  }

  throw new Error('Configuration value for adapters.claudeCode.config.permissionMode is invalid');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
