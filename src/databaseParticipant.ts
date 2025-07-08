import * as vscode from 'vscode';
import { DatabaseToolCallRound, DatabaseToolMetadata } from './types';
import { McpClient } from './mcpClient';

function isDatabaseToolMetadata(obj: unknown): obj is DatabaseToolMetadata {
    return !!obj &&
        !!(obj as DatabaseToolMetadata).toolCallsMetadata &&
        Array.isArray((obj as DatabaseToolMetadata).toolCallsMetadata.toolCallRounds);
}

async function selectFallbackModel(): Promise<vscode.LanguageModelChat> {
    const config = vscode.workspace.getConfiguration('toolsBridger');
    const fallbackModel = config.get<string>('fallbackModel', 'auto');

    try {
        if (fallbackModel === 'gpt-4.1') {
            const models = await vscode.lm.selectChatModels({
                vendor: 'copilot',
                family: 'gpt-4.1'
            });
            if (models.length > 0) return models[0];
        } else if (fallbackModel === 'gpt-4o') {
            const models = await vscode.lm.selectChatModels({
                vendor: 'copilot',
                family: 'gpt-4o'
            });
            if (models.length > 0) return models[0];
        } else if (fallbackModel === 'gpt-4o-mini') {
            const models = await vscode.lm.selectChatModels({
                vendor: 'copilot',
                family: 'gpt-4o-mini'
            });
            if (models.length > 0) return models[0];
        }

        // Auto mode or fallback: try in order of preference
        const preferredFamilies = ['gpt-4.1', 'gpt-4o', 'gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo'];
        
        for (const family of preferredFamilies) {
            try {
                const models = await vscode.lm.selectChatModels({
                    vendor: 'copilot',
                    family: family
                });
                if (models.length > 0) {
                    console.log(`Selected fallback model: ${family}`);
                    return models[0];
                }
            } catch (error) {
                // Continue to next family if this one fails
                continue;
            }
        }

        // Last resort: try any available tool-capable model
        const allModels = await vscode.lm.selectChatModels({
            vendor: 'copilot'
        });
        
        // Filter out o1 models and return the first available
        const toolCapableModels = allModels.filter(m => 
            !m.family.startsWith('o1')
        );
        
        if (toolCapableModels.length > 0) {
            console.log(`Selected fallback model: ${toolCapableModels[0].family}`);
            return toolCapableModels[0];
        }

        throw new Error('No tool-capable models available');
    } catch (error) {
        console.error('Failed to select fallback model:', error);
        // Final fallback to GPT-4o
        const models = await vscode.lm.selectChatModels({
            vendor: 'copilot',
            family: 'gpt-4o'
        });
        return models[0];
    }
}

export function registerDatabaseToolsParticipant(context: vscode.ExtensionContext, mcpClient: McpClient) {
    const handler: vscode.ChatRequestHandler = async (
        request: vscode.ChatRequest, 
        chatContext: vscode.ChatContext, 
        stream: vscode.ChatResponseStream, 
        token: vscode.CancellationToken
    ) => {
        if (request.command === 'list') {
            // List the available database tools (static list)
            const tools = vscode.lm.tools.filter(tool => tool.tags.includes('database-tools'));
            const toolNames = tools.map(tool => tool.name).join(', ');
            stream.markdown(`Available database tools: ${toolNames}\n\n`);
            
            // Show detailed information about each tool
            for (const tool of tools) {
                stream.markdown(`### ${tool.name}\n`);
                stream.markdown(`${tool.description}\n\n`);
                if (tool.tags.length > 0) {
                    stream.markdown(`**Tags:** ${tool.tags.join(', ')}\n\n`);
                }
            }
            
            return;
        }

        let model = request.model;
        if (model.vendor === 'copilot' && model.family.startsWith('o1')) {
            // The o1 models do not currently support tools
            model = await selectFallbackModel();
        }

        // Use all available tools or only database-specific tools
        const tools = request.command === 'all' ?
            vscode.lm.tools :
            vscode.lm.tools.filter(tool => tool.tags.includes('database-tools'));

        const options: vscode.LanguageModelChatRequestOptions = {
            justification: 'To make a database request to @dbTools',
        };

        // Create initial messages
        const messages = [
            vscode.LanguageModelChatMessage.User(`You are a PostgreSQL database assistant that helps users interact with their PostgreSQL database through specialized tools. 
            You can execute SQL queries, inspect database schemas, get table information, generate ERD diagrams, find column matches, and perform other PostgreSQL database operations.
            Always prioritize data safety and security. For destructive operations (DELETE, DROP, etc.), ask for confirmation.
            When querying data, consider using LIMIT clauses for large result sets unless specifically asked for all data.
            If you need to understand the database structure before answering a question, use the schema inspection tools first.
            Format query results in a clear, readable way. Use tables or lists as appropriate.
            If an error occurs, explain what went wrong and suggest possible solutions.
            Don't make assumptions about database structure - explore first if needed.
            Always use the available PostgreSQL tools to interact with the database rather than providing hypothetical responses.
            
            Available PostgreSQL tools include:
            - List schemas and tables
            - Get column information with types
            - Generate ERD diagrams (Mermaid and JSON)
            - Find columns by keyword with fuzzy matching
            - Sample column data for inspection
            - Find related tables via foreign keys
            - Describe relationships between tables
            - Execute SELECT queries safely
            
            User request: ${request.prompt}`)
        ];

        const toolReferences = [...request.toolReferences];
        const accumulatedToolResults: Record<string, vscode.LanguageModelToolResult> = {};
        const toolCallRounds: DatabaseToolCallRound[] = [];

        const runWithTools = async (): Promise<void> => {
            // If a toolReference is present, force the model to call that tool
            const requestedTool = toolReferences.shift();
            if (requestedTool) {
                options.toolMode = vscode.LanguageModelChatToolMode.Required;
                options.tools = vscode.lm.tools.filter(tool => tool.name === requestedTool.name);
            } else {
                options.toolMode = undefined;
                options.tools = [...tools];
            }

            // Send the request to the LanguageModelChat
            const response = await model.sendRequest(messages, options, token);

            // Stream text output and collect tool calls from the response
            const toolCalls: vscode.LanguageModelToolCallPart[] = [];
            let responseStr = '';
            for await (const part of response.stream) {
                if (part instanceof vscode.LanguageModelTextPart) {
                    stream.markdown(part.value);
                    responseStr += part.value;
                } else if (part instanceof vscode.LanguageModelToolCallPart) {
                    toolCalls.push(part);
                }
            }

            if (toolCalls.length) {
                // Add progress indicator for tool execution
                stream.progress('Executing database operations...');
                
                // Store tool call round
                toolCallRounds.push({
                    response: responseStr,
                    toolCalls
                });

                // Create assistant message with tool calls
                const assistantContent: (vscode.LanguageModelTextPart | vscode.LanguageModelToolCallPart)[] = [];
                if (responseStr) {
                    assistantContent.push(new vscode.LanguageModelTextPart(responseStr));
                }
                assistantContent.push(...toolCalls);
                messages.push(vscode.LanguageModelChatMessage.Assistant(assistantContent));

                // Execute each tool call and add results to messages
                const toolResults: vscode.LanguageModelToolResultPart[] = [];
                
                for (const toolCall of toolCalls) {
                    try {
                        // Execute the tool
                        const toolResult = await vscode.lm.invokeTool(toolCall.name, {
                            toolInvocationToken: request.toolInvocationToken,
                            input: toolCall.input
                        }, token);
                        toolResults.push(new vscode.LanguageModelToolResultPart(toolCall.callId, toolResult.content));
                        
                        // Store result for metadata
                        accumulatedToolResults[toolCall.callId] = toolResult;
                        
                        // Stream the tool result to the user
                        if (toolResult.content) {
                            for (const content of toolResult.content) {
                                if (content instanceof vscode.LanguageModelTextPart) {
                                    stream.markdown(`\n**${toolCall.name}:**\n\`\`\`\n${content.value}\n\`\`\`\n`);
                                }
                            }
                        }
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                        stream.markdown(`\n❌ **Error executing ${toolCall.name}:** ${errorMessage}\n`);
                        console.error(`Error executing tool ${toolCall.name}:`, error);
                        
                        // Create an error result
                        const errorContent = [new vscode.LanguageModelTextPart(`Error: ${errorMessage}`)];
                        toolResults.push(new vscode.LanguageModelToolResultPart(toolCall.callId, errorContent));
                    }
                }

                // Add tool results as a user message
                messages.push(vscode.LanguageModelChatMessage.User(toolResults));

                // Continue with tool calling loop
                return runWithTools();
            }
        };

        try {
            await runWithTools();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            stream.markdown(`\n\n❌ **Error:** ${errorMessage}`);
            
            // Log the error for debugging
            console.error('Database tools participant error:', error);
        }

        return {
            metadata: {
                toolCallsMetadata: {
                    toolCallResults: accumulatedToolResults,
                    toolCallRounds
                }
            } satisfies DatabaseToolMetadata,
        };
    };

    const databaseParticipant = vscode.chat.createChatParticipant('database-tools-participant.dbTools', handler);
    databaseParticipant.iconPath = new vscode.ThemeIcon('database');
    
    // Add followup provider for common database operations
    databaseParticipant.followupProvider = {
        provideFollowups(result: vscode.ChatResult, context: vscode.ChatContext, token: vscode.CancellationToken) {
            const followups: vscode.ChatFollowup[] = [];
            
            // Check if we have database metadata to suggest relevant followups
            const metadata = result.metadata;
            if (isDatabaseToolMetadata(metadata)) {
                // Suggest common database operations
                followups.push(
                    {
                        prompt: 'list tables',
                        label: 'List Tables',
                        command: 'all'
                    },
                    {
                        prompt: 'show table schema',
                        label: 'Show Schema',
                        command: 'all'
                    },
                    {
                        prompt: 'execute query',
                        label: 'Execute Query',
                        command: 'all'
                    }
                );
            }
            
            return followups;
        }
    };
    
    context.subscriptions.push(databaseParticipant);
} 