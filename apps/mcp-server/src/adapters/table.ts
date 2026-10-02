/**
 * The single DynamoDB table (data-model.md, research R8) behind a narrow interface, so the
 * key design in DynamoStore is tested against an in memory table without AWS.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";

/** One row. The domain object is kept as JSON in `body`; keys and expiry sit beside it. */
export interface Row {
  PK: string;
  SK: string;
  /** Secondary key for lookups by organizer email or reply token hash (index GSI1). */
  GSI1PK?: string;
  /** Epoch seconds; DynamoDB TTL deletes the row some time after this. */
  expiresAt?: number;
  body: string;
}

export interface Key {
  PK: string;
  SK: string;
}

export interface Table {
  get(key: Key): Promise<Row | undefined>;
  put(row: Row): Promise<void>;
  /** Deletes and returns the previous row, in one call (single use links). */
  take(key: Key): Promise<Row | undefined>;
  /** Rows under one partition, sorted by SK, optionally only those starting with a prefix. */
  query(pk: string, skPrefix?: string, descending?: boolean): Promise<Row[]>;
  queryIndex(gsi1pk: string): Promise<Row[]>;
  /** Adds one to a counter row and returns the new count. */
  increment(key: Key, expiresAt: number): Promise<number>;
  deleteMany(keys: Key[]): Promise<void>;
}

export const GSI1 = "GSI1";

/** The real table, through the DynamoDB document client. */
export class DynamoTable implements Table {
  private readonly client: DynamoDBDocumentClient;

  constructor(
    private readonly tableName: string,
    client?: DynamoDBClient,
  ) {
    this.client = DynamoDBDocumentClient.from(client ?? new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  async get(key: Key) {
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: key }));
    return result.Item as Row | undefined;
  }

  async put(row: Row) {
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: row }));
  }

  async take(key: Key) {
    const result = await this.client.send(
      new DeleteCommand({ TableName: this.tableName, Key: key, ReturnValues: "ALL_OLD" }),
    );
    return result.Attributes as Row | undefined;
  }

  private async queryAll(input: QueryCommandInput): Promise<Row[]> {
    const rows: Row[] = [];
    let start: Record<string, unknown> | undefined;
    do {
      const result = await this.client.send(
        new QueryCommand({ ...input, ...(start ? { ExclusiveStartKey: start } : {}) }),
      );
      rows.push(...((result.Items ?? []) as Row[]));
      start = result.LastEvaluatedKey;
    } while (start);
    return rows;
  }

  query(pk: string, skPrefix?: string, descending = false) {
    return this.queryAll({
      TableName: this.tableName,
      KeyConditionExpression: skPrefix ? "PK = :pk AND begins_with(SK, :sk)" : "PK = :pk",
      ExpressionAttributeValues: { ":pk": pk, ...(skPrefix ? { ":sk": skPrefix } : {}) },
      ScanIndexForward: !descending,
    });
  }

  queryIndex(gsi1pk: string) {
    return this.queryAll({
      TableName: this.tableName,
      IndexName: GSI1,
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: { ":pk": gsi1pk },
    });
  }

  async increment(key: Key, expiresAt: number) {
    const result = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: key,
        UpdateExpression: "ADD #count :one SET #expires = if_not_exists(#expires, :expires)",
        ExpressionAttributeNames: { "#count": "count", "#expires": "expiresAt" },
        ExpressionAttributeValues: { ":one": 1, ":expires": expiresAt },
        ReturnValues: "UPDATED_NEW",
      }),
    );
    return Number(result.Attributes?.count ?? 1);
  }

  async deleteMany(keys: Key[]) {
    for (let i = 0; i < keys.length; i += 25) {
      let requests = keys.slice(i, i + 25).map((key) => ({ DeleteRequest: { Key: key } }));
      for (let attempt = 0; requests.length > 0 && attempt < 5; attempt++) {
        const result = await this.client.send(
          new BatchWriteCommand({ RequestItems: { [this.tableName]: requests } }),
        );
        requests = (result.UnprocessedItems?.[this.tableName] ?? []) as typeof requests;
        if (requests.length > 0) await new Promise((r) => setTimeout(r, 50 * 2 ** attempt));
      }
      if (requests.length > 0) throw new Error("DynamoDB batch delete left unprocessed items");
    }
  }
}

/** In memory table with DynamoDB's ordering rules. For tests and local experiments. */
export class MemoryTable implements Table {
  private rows = new Map<string, Row & { count?: number }>();
  private id = (key: Key) => `${key.PK}\u0000${key.SK}`;

  async get(key: Key) {
    const row = this.rows.get(this.id(key));
    return row && structuredClone(row);
  }

  async put(row: Row) {
    this.rows.set(this.id(row), structuredClone(row));
  }

  async take(key: Key) {
    const row = this.rows.get(this.id(key));
    this.rows.delete(this.id(key));
    return row;
  }

  async query(pk: string, skPrefix = "", descending = false) {
    const rows = [...this.rows.values()]
      .filter((row) => row.PK === pk && row.SK.startsWith(skPrefix))
      .sort((a, b) => (a.SK < b.SK ? -1 : a.SK > b.SK ? 1 : 0))
      .map((row) => structuredClone(row));
    return descending ? rows.reverse() : rows;
  }

  async queryIndex(gsi1pk: string) {
    return [...this.rows.values()]
      .filter((row) => row.GSI1PK === gsi1pk)
      .map((row) => structuredClone(row));
  }

  async increment(key: Key, expiresAt: number) {
    const existing = this.rows.get(this.id(key));
    const count = (existing?.count ?? 0) + 1;
    this.rows.set(this.id(key), {
      ...key,
      body: "",
      count,
      expiresAt: existing?.expiresAt ?? expiresAt,
    });
    return count;
  }

  async deleteMany(keys: Key[]) {
    for (const key of keys) this.rows.delete(this.id(key));
  }

  /** Test helper: every row, as stored. */
  dump(): Row[] {
    return [...this.rows.values()].map((row) => structuredClone(row));
  }
}
