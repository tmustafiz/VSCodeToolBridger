import * as vscode from 'vscode';
import { DynamicToolRegistry, ToolExecutionContext } from './dynamicToolRegistry';
import { McpServerDiscovery } from './mcpServerDiscovery';

export interface ProxyToolInput {
    toolName: string;
    participantId: string;
    arguments?: any;
}

export class ProxyToolHandlers {
    private toolRegistry: DynamicToolRegistry;
    private serverDiscovery: McpServerDiscovery;

    constructor(toolRegistry: DynamicToolRegistry, serverDiscovery: McpServerDiscovery) {
        this.toolRegistry = toolRegistry;
        this.serverDiscovery = serverDiscovery;
    }

    /**
     * Register all proxy tool handlers with VSCode
     */
    public registerHandlers(context: vscode.ExtensionContext): void {
        console.log('Registering proxy tool handlers...');
        
        try {
            // Register database proxy tool handler
            const databaseHandler = vscode.lm.registerTool('tool_proxy_database', {
                invoke: async (options: vscode.LanguageModelToolInvocationOptions<ProxyToolInput>, token: vscode.CancellationToken) => {
                    return this.handleProxyTool(options.input, 'database', token);
                }
            });
            context.subscriptions.push(databaseHandler);
            console.log('Registered tool_proxy_database tool');

            // Register query proxy tool handler
            const queryHandler = vscode.lm.registerTool('tool_proxy_query', {
                invoke: async (options: vscode.LanguageModelToolInvocationOptions<ProxyToolInput>, token: vscode.CancellationToken) => {
                    return this.handleProxyTool(options.input, 'query', token);
                }
            });
            context.subscriptions.push(queryHandler);
            console.log('Registered tool_proxy_query tool');

            // Register analysis proxy tool handler
            const analysisHandler = vscode.lm.registerTool('tool_proxy_analysis', {
                invoke: async (options: vscode.LanguageModelToolInvocationOptions<ProxyToolInput>, token: vscode.CancellationToken) => {
                    return this.handleProxyTool(options.input, 'analysis', token);
                }
            });
            context.subscriptions.push(analysisHandler);
            console.log('Registered tool_proxy_analysis tool');

            // Register general proxy tool handler
            const generalHandler = vscode.lm.registerTool('tool_proxy_general', {
                invoke: async (options: vscode.LanguageModelToolInvocationOptions<ProxyToolInput>, token: vscode.CancellationToken) => {
                    return this.handleProxyTool(options.input, 'general', token);
                }
            });
            context.subscriptions.push(generalHandler);
            console.log('Registered tool_proxy_general tool');

            console.log('All proxy tool handlers registered and added to context subscriptions');

        } catch (error) {
            console.error('Error registering proxy tool handlers:', error);
            throw error;
        }
    }

    /**
     * Handle proxy tool execution - now gracefully handles missing tools
     */
    private async handleProxyTool(
        input: ProxyToolInput, 
        category: string, 
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            // Validate input
            if (!input.toolName || !input.participantId) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        `Error: toolName and participantId are required for proxy tool execution.`
                    )
                ]);
            }

            // Check if any MCP servers are available
            const allTools = this.toolRegistry.getAllTools();
            if (allTools.length === 0) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        `No MCP servers are currently configured. Please add MCP servers using the command palette: "Tools Bridger: Add MCP Server"`
                    )
                ]);
            }

            // Find the tool in the registry
            const tool = this.toolRegistry.getToolByName(input.toolName, input.participantId);
            if (!tool) {
                // Instead of throwing an error, provide helpful guidance
                const availableTools = this.getAvailableToolsForCategory(category);
                if (availableTools.length === 0) {
                    return new vscode.LanguageModelToolResult([
                        new vscode.LanguageModelTextPart(
                            `No ${category} tools are currently available. Available categories: ${this.getAvailableCategories().join(', ')}`
                        )
                    ]);
                } else {
                    return new vscode.LanguageModelToolResult([
                        new vscode.LanguageModelTextPart(
                            `Tool "${input.toolName}" not found. Available ${category} tools: ${availableTools.map(t => t.name).join(', ')}`
                        )
                    ]);
                }
            }

            // Validate tool category matches proxy type
            if (tool.category !== category) {
                console.warn(`Tool category mismatch: expected ${category}, got ${tool.category}`);
            }

            // Create execution context
            const executionContext: ToolExecutionContext = {
                toolName: input.toolName,
                serverId: tool.serverId,
                participantId: input.participantId,
                arguments: input.arguments || {},
                token: token
            };

            // Execute the tool
            const result = await this.toolRegistry.executeProxyTool(executionContext);

            // Format the result for the language model
            return this.formatToolResult(result, tool.name);

        } catch (error) {
            console.error(`Error executing proxy tool:`, error);
            
            // Return error result
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    `Error executing tool "${input.toolName}": ${error instanceof Error ? error.message : String(error)}`
                )
            ]);
        }
    }

    /**
     * Get available tools for a specific category
     */
    private getAvailableToolsForCategory(category: string): any[] {
        return this.toolRegistry.getAllTools().filter(tool => tool.category === category);
    }

    /**
     * Get all available categories
     */
    private getAvailableCategories(): string[] {
        const categories = new Set<string>();
        this.toolRegistry.getAllTools().forEach(tool => {
            if (tool.category) {
                categories.add(tool.category);
            }
        });
        return Array.from(categories);
    }

    /**
     * Format tool execution result for language model
     */
    private formatToolResult(result: any, toolName: string): vscode.LanguageModelToolResult {
        if (result.success) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    typeof result.result === 'string' ? result.result : JSON.stringify(result.result, null, 2)
                )
            ]);
        } else {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    `Tool "${toolName}" failed: ${result.error || 'Unknown error'}`
                )
            ]);
        }
    }

    /**
     * Get available tools for a participant
     */
    public getAvailableTools(participantId: string): string[] {
        const tools = this.toolRegistry.getToolsForParticipant(participantId);
        return tools.map(tool => tool.name);
    }

    /**
     * Get tool information for help/documentation
     */
    public getToolInfo(toolName: string, participantId: string): any {
        const tool = this.toolRegistry.getToolByName(toolName, participantId);
        if (!tool) {
            return null;
        }

        return {
            name: tool.name,
            description: tool.description,
            category: tool.category,
            serverId: tool.serverId,
            inputSchema: tool.inputSchema
        };
    }

    /**
     * Validate tool input against schema
     */
    private validateToolInput(input: any, schema: any): boolean {
        // Basic validation - can be enhanced with a JSON schema validator
        if (!schema || typeof schema !== 'object') {
            return true; // No schema to validate against
        }

        if (schema.required && Array.isArray(schema.required)) {
            for (const required of schema.required) {
                if (!(required in input)) {
                    throw new Error(`Missing required parameter: ${required}`);
                }
            }
        }

        return true;
    }
} 