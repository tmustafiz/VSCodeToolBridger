import * as vscode from 'vscode';

// Common database tool parameter interfaces
export interface DatabaseConnectionParams {
  database?: string;
  schema?: string;
  timeout?: number;
}

export interface SqlQueryParams extends DatabaseConnectionParams {
  query: string;
  limit?: number;
  offset?: number;
}

export interface TableInfoParams extends DatabaseConnectionParams {
  tableName: string;
}

export interface SchemaListParams extends DatabaseConnectionParams {
  pattern?: string;
}

// PostgreSQL-specific interfaces for MCP server tools
export interface IListSchemasParams {
  // No parameters needed
}

export interface IListTablesParams {
  schema: string;
}

export interface IListColumnsParams {
  schema: string;
  table: string;
}

export interface IGenerateErdMermaidParams {
  schema: string;
}

export interface IGenerateErdJsonParams {
  schema: string;
}

export interface IFuzzyColumnMatchParams {
  schema: string;
  table: string;
  keyword: string;
}

export interface ISampleColumnDataParams {
  schema: string;
  table: string;
  column: string;
  limit?: number;
}

export interface IFindRelatedTablesParams {
  schema: string;
  table: string;
}

export interface IDescribeRelationshipParams {
  schema: string;
  table1: string;
  table2: string;
}

export interface IRunQueryParams {
  query: string;
  clientId: string;
}

// Response types for PostgreSQL MCP server
export interface ListSchemasResponse {
  schemas: string[];
}

export interface ListTablesResponse {
  tables: string[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  is_nullable: boolean;
}

export interface ListColumnsResponse {
  columns: ColumnInfo[];
}

export interface GenerateErdMermaidResponse {
  diagram: string;
}

export interface TableInfo {
  name: string;
  columns: string[];
  primary_keys: string[];
  foreign_keys: {
    column: string;
    references: {
      table: string;
      column: string;
    };
  }[];
}

export interface RelationshipInfo {
  from_table: string;
  from_column: string;
  to_table: string;
  to_column: string;
}

export interface GenerateErdJsonResponse {
  tables: TableInfo[];
  relationships: RelationshipInfo[];
}

export interface ColumnMatch {
  column: string;
  similarity: number;
  comment?: string;
}

export interface FuzzyColumnMatchResponse {
  best_match: string | null;
  all_matches: ColumnMatch[];
}

export interface SampleColumnDataResponse {
  values: any[];
}

export interface RelatedTable {
  schema: string;
  table: string;
  fk_column: string;
  pk_column: string;
}

export interface FindRelatedTablesResponse {
  related_tables: RelatedTable[];
}

export interface DescribeRelationshipResponse {
  explanation: string;
}

export interface QueryField {
  name: string;
  dataTypeID: number;
}

export interface RunQueryResponse {
  rows: Record<string, any>[];
  rowCount: number;
  totalRowCount: number;
  wasLimited: boolean;
  fields: QueryField[];
}

export interface DatabaseToolMetadata {
  toolCallsMetadata: DatabaseToolCallsMetadata;
}

export interface DatabaseToolCallsMetadata {
  toolCallRounds: DatabaseToolCallRound[];
  toolCallResults: Record<string, vscode.LanguageModelToolResult>;
}

export interface DatabaseToolCallRound {
  response: string;
  toolCalls: vscode.LanguageModelToolCallPart[];
}

// Tool registration interface
export interface DatabaseToolDefinition {
  name: string;
  description: string;
  parametersSchema: object;
  tags: string[];
  createTool: (mcpClient: any) => vscode.LanguageModelTool<any>;
}

// Helper type for tool parameter validation
export type ToolParameterValidator<T> = (params: any) => T | never;

// Common response types
export interface DatabaseQueryResult {
  success: boolean;
  data?: any[];
  error?: string;
  rowCount?: number;
  executionTime?: number;
}

export interface DatabaseSchemaInfo {
  tables: TableInfo[];
  views: TableInfo[];
  functions?: FunctionInfo[];
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
  type: string;
}

export interface FunctionInfo {
  name: string;
  schema: string;
  parameters: FunctionParameter[];
  returnType: string;
  description?: string;
}

export interface FunctionParameter {
  name: string;
  type: string;
  defaultValue?: any;
  required: boolean;
} 