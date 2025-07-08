import * as vscode from 'vscode';
import { McpClient } from '../mcpClient';
import {
    IListSchemasParams,
    IListTablesParams,
    IListColumnsParams,
    IGenerateErdMermaidParams,
    IGenerateErdJsonParams,
    IFuzzyColumnMatchParams,
    ISampleColumnDataParams,
    IFindRelatedTablesParams,
    IDescribeRelationshipParams,
    IRunQueryParams,
    ListSchemasResponse,
    ListTablesResponse,
    ListColumnsResponse,
    GenerateErdMermaidResponse,
    GenerateErdJsonResponse,
    FuzzyColumnMatchResponse,
    SampleColumnDataResponse,
    FindRelatedTablesResponse,
    DescribeRelationshipResponse,
    RunQueryResponse
} from '../types';

export function registerPostgreSQLTools(context: vscode.ExtensionContext, mcpClient: McpClient) {
    context.subscriptions.push(vscode.lm.registerTool('postgresql_listSchemas', new ListSchemasTool(mcpClient)));
    context.subscriptions.push(vscode.lm.registerTool('postgresql_listTables', new ListTablesTool(mcpClient)));
    context.subscriptions.push(vscode.lm.registerTool('postgresql_listColumns', new ListColumnsTool(mcpClient)));
    context.subscriptions.push(vscode.lm.registerTool('postgresql_generateErdMermaid', new GenerateErdMermaidTool(mcpClient)));
    context.subscriptions.push(vscode.lm.registerTool('postgresql_generateErdJson', new GenerateErdJsonTool(mcpClient)));
    context.subscriptions.push(vscode.lm.registerTool('postgresql_fuzzyColumnMatch', new FuzzyColumnMatchTool(mcpClient)));
    context.subscriptions.push(vscode.lm.registerTool('postgresql_sampleColumnData', new SampleColumnDataTool(mcpClient)));
    context.subscriptions.push(vscode.lm.registerTool('postgresql_findRelatedTables', new FindRelatedTablesTool(mcpClient)));
    context.subscriptions.push(vscode.lm.registerTool('postgresql_describeRelationship', new DescribeRelationshipTool(mcpClient)));
    context.subscriptions.push(vscode.lm.registerTool('postgresql_runQuery', new RunQueryTool(mcpClient)));
}

export class ListSchemasTool implements vscode.LanguageModelTool<IListSchemasParams> {
    constructor(private mcpClient: McpClient) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IListSchemasParams>,
        _token: vscode.CancellationToken
    ) {
        try {
            if (!this.mcpClient.isConnected()) {
                await this.mcpClient.connect();
            }

            const result = await this.mcpClient.json<ListSchemasResponse>('list_schemas', {});
            
            const formattedResult = this.formatSchemaList(result);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(formattedResult)
            ]);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ **Failed to list schemas:** ${errorMessage}`)
            ]);
        }
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IListSchemasParams>,
        _token: vscode.CancellationToken
    ) {
        return {
            invocationMessage: 'Listing database schemas...',
        };
    }

    private formatSchemaList(result: ListSchemasResponse): string {
        if (result.schemas.length === 0) {
            return 'No schemas found.';
        }
        return `Found ${result.schemas.length} schemas:\n\n${result.schemas.map(schema => `- **${schema}**`).join('\n')}`;
    }
}

export class ListTablesTool implements vscode.LanguageModelTool<IListTablesParams> {
    constructor(private mcpClient: McpClient) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IListTablesParams>,
        _token: vscode.CancellationToken
    ) {
        const params = options.input;
        
        try {
            if (!this.mcpClient.isConnected()) {
                await this.mcpClient.connect();
            }

            const result = await this.mcpClient.json<ListTablesResponse>('list_tables', {
                schema: params.schema
            });

            const formattedResult = this.formatTableList(result, params.schema);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(formattedResult)
            ]);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ **Failed to list tables in schema "${params.schema}":** ${errorMessage}`)
            ]);
        }
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IListTablesParams>,
        _token: vscode.CancellationToken
    ) {
        return {
            invocationMessage: `Listing tables in schema "${options.input.schema}"...`,
        };
    }

    private formatTableList(result: ListTablesResponse, schema: string): string {
        if (result.tables.length === 0) {
            return `No tables found in schema "${schema}".`;
        }
        return `Found ${result.tables.length} tables in schema "${schema}":\n\n${result.tables.map(table => `- **${table}**`).join('\n')}`;
    }
}

export class ListColumnsTool implements vscode.LanguageModelTool<IListColumnsParams> {
    constructor(private mcpClient: McpClient) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IListColumnsParams>,
        _token: vscode.CancellationToken
    ) {
        const params = options.input;
        
        try {
            if (!this.mcpClient.isConnected()) {
                await this.mcpClient.connect();
            }

            const result = await this.mcpClient.json<ListColumnsResponse>('list_columns', {
                schema: params.schema,
                table: params.table
            });

            const formattedResult = this.formatColumnList(result, params.schema, params.table);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(formattedResult)
            ]);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ **Failed to list columns for table "${params.schema}.${params.table}":** ${errorMessage}`)
            ]);
        }
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IListColumnsParams>,
        _token: vscode.CancellationToken
    ) {
        return {
            invocationMessage: `Getting columns for table "${options.input.schema}.${options.input.table}"...`,
        };
    }

    private formatColumnList(result: ListColumnsResponse, schema: string, table: string): string {
        if (result.columns.length === 0) {
            return `No columns found in table "${schema}.${table}".`;
        }

        const headerRow = `| Column | Type | Nullable |`;
        const separatorRow = `| --- | --- | --- |`;
        
        const dataRows = result.columns.map(col => {
            const nullable = col.is_nullable ? 'Yes' : 'No';
            return `| **${col.name}** | \`${col.type}\` | ${nullable} |`;
        });

        return `## Columns in ${schema}.${table}\n\n${[headerRow, separatorRow, ...dataRows].join('\n')}`;
    }
}

export class GenerateErdMermaidTool implements vscode.LanguageModelTool<IGenerateErdMermaidParams> {
    constructor(private mcpClient: McpClient) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IGenerateErdMermaidParams>,
        _token: vscode.CancellationToken
    ) {
        const params = options.input;
        
        try {
            if (!this.mcpClient.isConnected()) {
                await this.mcpClient.connect();
            }

            const result = await this.mcpClient.json<GenerateErdMermaidResponse>('generate_erd_mermaid', {
                schema: params.schema
            });

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`## Entity Relationship Diagram for "${params.schema}"\n\n\`\`\`mermaid\n${result.diagram}\n\`\`\``)
            ]);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ **Failed to generate ERD for schema "${params.schema}":** ${errorMessage}`)
            ]);
        }
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IGenerateErdMermaidParams>,
        _token: vscode.CancellationToken
    ) {
        return {
            invocationMessage: `Generating ERD diagram for schema "${options.input.schema}"...`,
        };
    }
}

export class GenerateErdJsonTool implements vscode.LanguageModelTool<IGenerateErdJsonParams> {
    constructor(private mcpClient: McpClient) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IGenerateErdJsonParams>,
        _token: vscode.CancellationToken
    ) {
        const params = options.input;
        
        try {
            if (!this.mcpClient.isConnected()) {
                await this.mcpClient.connect();
            }

            const result = await this.mcpClient.json<GenerateErdJsonResponse>('generate_erd_json', {
                schema: params.schema
            });

            const formattedResult = this.formatErdJson(result, params.schema);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(formattedResult)
            ]);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ **Failed to generate ERD JSON for schema "${params.schema}":** ${errorMessage}`)
            ]);
        }
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IGenerateErdJsonParams>,
        _token: vscode.CancellationToken
    ) {
        return {
            invocationMessage: `Generating ERD JSON for schema "${options.input.schema}"...`,
        };
    }

    private formatErdJson(result: GenerateErdJsonResponse, schema: string): string {
        let output = `## Entity Relationship Data for "${schema}"\n\n`;
        
        output += `### Tables (${result.tables.length})\n\n`;
        for (const table of result.tables) {
            output += `**${table.name}**\n`;
            output += `- Columns: ${table.columns.join(', ')}\n`;
            if (table.primary_keys.length > 0) {
                output += `- Primary Keys: ${table.primary_keys.join(', ')}\n`;
            }
            if (table.foreign_keys.length > 0) {
                output += `- Foreign Keys:\n`;
                for (const fk of table.foreign_keys) {
                    output += `  - ${fk.column} → ${fk.references.table}.${fk.references.column}\n`;
                }
            }
            output += '\n';
        }

        if (result.relationships.length > 0) {
            output += `### Relationships (${result.relationships.length})\n\n`;
            for (const rel of result.relationships) {
                output += `- **${rel.from_table}.${rel.from_column}** → **${rel.to_table}.${rel.to_column}**\n`;
            }
        }

        return output;
    }
}

export class FuzzyColumnMatchTool implements vscode.LanguageModelTool<IFuzzyColumnMatchParams> {
    constructor(private mcpClient: McpClient) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IFuzzyColumnMatchParams>,
        _token: vscode.CancellationToken
    ) {
        const params = options.input;
        
        try {
            if (!this.mcpClient.isConnected()) {
                await this.mcpClient.connect();
            }

            const result = await this.mcpClient.json<FuzzyColumnMatchResponse>('fuzzy_column_match', {
                schema: params.schema,
                table: params.table,
                keyword: params.keyword
            });

            const formattedResult = this.formatFuzzyMatch(result, params);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(formattedResult)
            ]);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ **Failed to find matching columns:** ${errorMessage}`)
            ]);
        }
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IFuzzyColumnMatchParams>,
        _token: vscode.CancellationToken
    ) {
        return {
            invocationMessage: `Searching for columns matching "${options.input.keyword}" in ${options.input.schema}.${options.input.table}...`,
        };
    }

    private formatFuzzyMatch(result: FuzzyColumnMatchResponse, params: IFuzzyColumnMatchParams): string {
        let output = `## Column Search Results for "${params.keyword}" in ${params.schema}.${params.table}\n\n`;
        
        if (result.best_match) {
            output += `### Best Match: **${result.best_match}**\n\n`;
        } else {
            output += `### No good matches found\n\n`;
        }

        if (result.all_matches.length > 0) {
            output += `### All Matches:\n\n`;
            output += `| Column | Similarity | Comment |\n`;
            output += `| --- | --- | --- |\n`;
            
            for (const match of result.all_matches) {
                const similarity = Math.round(match.similarity * 100);
                const comment = match.comment || '';
                output += `| **${match.column}** | ${similarity}% | ${comment} |\n`;
            }
        }

        return output;
    }
}

export class SampleColumnDataTool implements vscode.LanguageModelTool<ISampleColumnDataParams> {
    constructor(private mcpClient: McpClient) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ISampleColumnDataParams>,
        _token: vscode.CancellationToken
    ) {
        const params = options.input;
        
        try {
            if (!this.mcpClient.isConnected()) {
                await this.mcpClient.connect();
            }

            const result = await this.mcpClient.json<SampleColumnDataResponse>('sample_column_data', {
                schema: params.schema,
                table: params.table,
                column: params.column,
                limit: params.limit || 10
            });

            const formattedResult = this.formatSampleData(result, params);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(formattedResult)
            ]);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ **Failed to get sample data:** ${errorMessage}`)
            ]);
        }
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<ISampleColumnDataParams>,
        _token: vscode.CancellationToken
    ) {
        const limit = options.input.limit || 10;
        return {
            invocationMessage: `Getting ${limit} sample values from ${options.input.schema}.${options.input.table}.${options.input.column}...`,
        };
    }

    private formatSampleData(result: SampleColumnDataResponse, params: ISampleColumnDataParams): string {
        const limit = params.limit || 10;
        let output = `## Sample Data from ${params.schema}.${params.table}.${params.column}\n\n`;
        
        if (result.values.length === 0) {
            output += 'No data found in this column.';
        } else {
            output += `Showing ${Math.min(result.values.length, limit)} sample values:\n\n`;
            result.values.slice(0, limit).forEach((value, index) => {
                const displayValue = value === null ? '*NULL*' : String(value);
                output += `${index + 1}. \`${displayValue}\`\n`;
            });
        }

        return output;
    }
}

export class FindRelatedTablesTool implements vscode.LanguageModelTool<IFindRelatedTablesParams> {
    constructor(private mcpClient: McpClient) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IFindRelatedTablesParams>,
        _token: vscode.CancellationToken
    ) {
        const params = options.input;
        
        try {
            if (!this.mcpClient.isConnected()) {
                await this.mcpClient.connect();
            }

            const result = await this.mcpClient.json<FindRelatedTablesResponse>('find_related_tables', {
                schema: params.schema,
                table: params.table
            });

            const formattedResult = this.formatRelatedTables(result, params);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(formattedResult)
            ]);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ **Failed to find related tables:** ${errorMessage}`)
            ]);
        }
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IFindRelatedTablesParams>,
        _token: vscode.CancellationToken
    ) {
        return {
            invocationMessage: `Finding related tables for ${options.input.schema}.${options.input.table}...`,
        };
    }

    private formatRelatedTables(result: FindRelatedTablesResponse, params: IFindRelatedTablesParams): string {
        let output = `## Related Tables for ${params.schema}.${params.table}\n\n`;
        
        if (result.related_tables.length === 0) {
            output += 'No related tables found through foreign key relationships.';
        } else {
            output += `Found ${result.related_tables.length} related tables:\n\n`;
            output += `| Related Table | Foreign Key | Primary Key |\n`;
            output += `| --- | --- | --- |\n`;
            
            for (const related of result.related_tables) {
                output += `| **${related.schema}.${related.table}** | ${related.fk_column} | ${related.pk_column} |\n`;
            }
        }

        return output;
    }
}

export class DescribeRelationshipTool implements vscode.LanguageModelTool<IDescribeRelationshipParams> {
    constructor(private mcpClient: McpClient) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IDescribeRelationshipParams>,
        _token: vscode.CancellationToken
    ) {
        const params = options.input;
        
        try {
            if (!this.mcpClient.isConnected()) {
                await this.mcpClient.connect();
            }

            const result = await this.mcpClient.json<DescribeRelationshipResponse>('describe_relationship', {
                schema: params.schema,
                table1: params.table1,
                table2: params.table2
            });

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`## Relationship between ${params.table1} and ${params.table2}\n\n${result.explanation}`)
            ]);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ **Failed to describe relationship:** ${errorMessage}`)
            ]);
        }
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IDescribeRelationshipParams>,
        _token: vscode.CancellationToken
    ) {
        return {
            invocationMessage: `Analyzing relationship between ${options.input.table1} and ${options.input.table2}...`,
        };
    }
}

export class RunQueryTool implements vscode.LanguageModelTool<IRunQueryParams> {
    constructor(private mcpClient: McpClient) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IRunQueryParams>,
        _token: vscode.CancellationToken
    ) {
        const params = options.input;
        
        try {
            if (!this.mcpClient.isConnected()) {
                await this.mcpClient.connect();
            }

            const result = await this.mcpClient.json<RunQueryResponse>('run_query', {
                query: params.query,
                clientId: params.clientId
            });

            const formattedResult = this.formatQueryResult(result, params.query);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(formattedResult)
            ]);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ **Query execution failed:** ${errorMessage}\n\n**Query:**\n\`\`\`sql\n${params.query}\n\`\`\``)
            ]);
        }
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IRunQueryParams>,
        _token: vscode.CancellationToken
    ) {
        const query = options.input.query.toLowerCase();
        const isDestructive = ['delete', 'drop', 'truncate', 'update', 'insert', 'alter', 'create'].some(
            keyword => query.includes(keyword)
        );

        if (isDestructive) {
            const confirmationMessages = {
                title: 'Execute PostgreSQL Query',
                message: new vscode.MarkdownString(
                    `⚠️ This query may modify or delete data.\n\n` +
                    `**Query:**\n\`\`\`sql\n${options.input.query}\n\`\`\`\n\n` +
                    `Do you want to proceed?`
                ),
            };

            return {
                invocationMessage: 'Executing PostgreSQL query...',
                confirmationMessages,
            };
        }

        return {
            invocationMessage: 'Executing PostgreSQL query...',
        };
    }

    private formatQueryResult(result: RunQueryResponse, query: string): string {
        let output = `## Query Results\n\n`;
        output += `**Query:**\n\`\`\`sql\n${query}\n\`\`\`\n\n`;
        
        output += `**Results:** ${result.rowCount} rows returned`;
        if (result.wasLimited) {
            output += ` (limited from ${result.totalRowCount} total rows)`;
        }
        output += '\n\n';

        if (result.rows.length === 0) {
            output += 'No rows returned.';
            return output;
        }

        // Create markdown table
        const headers = result.fields.map(field => field.name);
        const headerRow = `| ${headers.join(' | ')} |`;
        const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
        
        const dataRows = result.rows.map(row => {
            const cells = headers.map(header => {
                const value = row[header];
                if (value === null || value === undefined) {
                    return '*NULL*';
                }
                return String(value);
            });
            return `| ${cells.join(' | ')} |`;
        });

        output += [headerRow, separatorRow, ...dataRows.slice(0, 50)].join('\n');
        
        if (result.rows.length > 50) {
            output += `\n\n*Showing first 50 rows of ${result.rows.length} total rows*`;
        }

        return output;
    }
} 