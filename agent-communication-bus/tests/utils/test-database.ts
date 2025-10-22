/**
 * In-memory test database utilities
 * Provides mock database functionality for testing without external dependencies
 */

export interface TestRecord {
  id: string;
  data: any;
  created_at: string;
  updated_at: string;
}

export class TestDatabase {
  private tables: Map<string, Map<string, TestRecord>> = new Map();
  private static instance: TestDatabase;

  private constructor() {}

  static getInstance(): TestDatabase {
    if (!TestDatabase.instance) {
      TestDatabase.instance = new TestDatabase();
    }
    return TestDatabase.instance;
  }

  // Table operations
  createTable(tableName: string): void {
    if (!this.tables.has(tableName)) {
      this.tables.set(tableName, new Map());
    }
  }

  dropTable(tableName: string): boolean {
    return this.tables.delete(tableName);
  }

  tableExists(tableName: string): boolean {
    return this.tables.has(tableName);
  }

  getTable(tableName: string): Map<string, TestRecord> | undefined {
    return this.tables.get(tableName);
  }

  // Record operations
  async insert(tableName: string, id: string, data: any): Promise<TestRecord> {
    this.createTable(tableName);
    const table = this.tables.get(tableName)!;
    
    const record: TestRecord = {
      id,
      data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    table.set(id, record);
    return record;
  }

  async find(tableName: string, id: string): Promise<TestRecord | null> {
    const table = this.tables.get(tableName);
    return table?.get(id) || null;
  }

  async update(tableName: string, id: string, data: any): Promise<TestRecord | null> {
    const table = this.tables.get(tableName);
    if (!table) return null;

    const existing = table.get(id);
    if (!existing) return null;

    const updated: TestRecord = {
      ...existing,
      data: { ...existing.data, ...data },
      updated_at: new Date().toISOString()
    };

    table.set(id, updated);
    return updated;
  }

  async delete(tableName: string, id: string): Promise<boolean> {
    const table = this.tables.get(tableName);
    return table ? table.delete(id) : false;
  }

  async findAll(tableName: string): Promise<TestRecord[]> {
    const table = this.tables.get(tableName);
    return table ? Array.from(table.values()) : [];
  }

  async findWhere(tableName: string, predicate: (record: TestRecord) => boolean): Promise<TestRecord[]> {
    const table = this.tables.get(tableName);
    if (!table) return [];

    return Array.from(table.values()).filter(predicate);
  }

  async count(tableName: string): Promise<number> {
    const table = this.tables.get(tableName);
    return table ? table.size : 0;
  }

  async clear(tableName: string): Promise<void> {
    const table = this.tables.get(tableName);
    if (table) {
      table.clear();
    }
  }

  // Utility methods
  async clearAll(): Promise<void> {
    this.tables.clear();
  }

  getTableNames(): string[] {
    return Array.from(this.tables.keys());
  }

  getTableStats(tableName: string): { count: number; size: number } | null {
    const table = this.tables.get(tableName);
    if (!table) return null;

    const records = Array.from(table.values());
    const size = JSON.stringify(records).length;

    return {
      count: records.length,
      size
    };
  }

  // Seed data helpers
  async seedTable(tableName: string, records: Array<{ id: string; data: any }>): Promise<void> {
    this.createTable(tableName);
    
    for (const record of records) {
      await this.insert(tableName, record.id, record.data);
    }
  }

  // Query helpers for common test scenarios
  async findAgentsByFramework(framework: string): Promise<TestRecord[]> {
    return this.findWhere('agents', (record) => 
      record.data.framework === framework
    );
  }

  async findMessagesByType(messageType: string): Promise<TestRecord[]> {
    return this.findWhere('messages', (record) => 
      record.data.message_type === messageType
    );
  }

  async findSessionsByAgent(agentId: string): Promise<TestRecord[]> {
    return this.findWhere('sessions', (record) => 
      record.data.orchestrator === agentId ||
      record.data.participants?.some((p: any) => p.agent_id === agentId)
    );
  }

  async findActiveSessions(): Promise<TestRecord[]> {
    return this.findWhere('sessions', (record) => 
      !record.data.terminated_at
    );
  }
}

// Global test database instance
export const testDb = TestDatabase.getInstance();

// Jest setup and teardown helpers
export function setupTestDatabase(): void {
  testDb.clearAll();
  
  // Create standard tables
  testDb.createTable('agents');
  testDb.createTable('messages');
  testDb.createTable('sessions');
  testDb.createTable('results');
  testDb.createTable('workflows');
}

export function teardownTestDatabase(): void {
  testDb.clearAll();
}

// Mock database adapter for testing
export class MockDatabaseAdapter {
  async connect(): Promise<void> {
    // Mock connection
  }

  async disconnect(): Promise<void> {
    // Mock disconnection
  }

  async query(_sql: string, _params?: any[]): Promise<any[]> {
    // Mock query execution
    return [];
  }

  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    // Mock transaction
    return callback();
  }
}

// Test data factory
export class TestDataFactory {
  static createAgentRecord(id: string, data: any): TestRecord {
    return {
      id,
      data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  static createMessageRecord(id: string, data: any): TestRecord {
    return {
      id,
      data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  static createSessionRecord(id: string, data: any): TestRecord {
    return {
      id,
      data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
}