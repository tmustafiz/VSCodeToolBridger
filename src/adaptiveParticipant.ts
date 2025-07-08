import * as vscode from 'vscode';
import { DatabaseToolCallRound, DatabaseToolMetadata } from './types';
import { DynamicToolRegistry } from './dynamicToolRegistry';
import { ProxyToolHandlers } from './proxyToolHandlers';

function isDatabaseToolMetadata(obj: unknown): obj is DatabaseToolMetadata {
    return !!obj &&
        !!(obj as DatabaseToolMetadata).toolCallsMetadata &&
        Array.isArray((obj as DatabaseToolMetadata).toolCallsMetadata.toolCallRounds);
}

interface RequestAnalysis {
    primaryDomain: string;
    secondaryDomains: string[];
    requiredCapabilities: string[];
    confidence: number;
}

interface DomainCapabilities {
    domain: string;
    tools: string[];
    description: string;
    examples: string[];
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
                continue;
            }
        }

        const allModels = await vscode.lm.selectChatModels({
            vendor: 'copilot'
        });
        
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
        const models = await vscode.lm.selectChatModels({
            vendor: 'copilot',
            family: 'gpt-4o'
        });
        return models[0];
    }
}

class RequestAnalyzer {
    private readonly domainPatterns = new Map<string, string[]>([
        ['database', ['database', 'db', 'sql', 'query', 'table', 'schema', 'postgres', 'mysql', 'sqlite', 'select', 'insert', 'update', 'delete', 'join', 'index', 'column', 'row', 'erd', 'diagram', 'migration', 'orm']],
        ['git', ['git', 'github', 'gitlab', 'repo', 'repository', 'commit', 'push', 'pull', 'merge', 'branch', 'checkout', 'clone', 'fork', 'pr', 'pull request', 'issue', 'diff', 'log', 'status', 'add', 'stash', 'rebase', 'cherry-pick']],
        ['file-system', ['file', 'folder', 'directory', 'path', 'read', 'write', 'copy', 'move', 'delete', 'search', 'find', 'ls', 'cat', 'mkdir', 'rmdir', 'chmod', 'chown', 'stat', 'size', 'exists', 'permissions']],
        ['web', ['http', 'https', 'url', 'api', 'rest', 'graphql', 'fetch', 'request', 'response', 'json', 'xml', 'html', 'css', 'javascript', 'curl', 'wget', 'browser', 'web', 'internet', 'scrape']],
        ['development', ['code', 'programming', 'function', 'class', 'method', 'variable', 'debug', 'test', 'build', 'compile', 'deploy', 'ci', 'cd', 'pipeline', 'lint', 'format', 'refactor', 'review']],
        ['analysis', ['analyze', 'analysis', 'data', 'statistics', 'report', 'chart', 'graph', 'visualization', 'trend', 'pattern', 'insight', 'metric', 'kpi', 'dashboard', 'summary', 'aggregate', 'calculate', 'count', 'average', 'sum']],
        ['system', ['system', 'process', 'service', 'daemon', 'cpu', 'memory', 'disk', 'network', 'performance', 'monitor', 'log', 'event', 'alert', 'health', 'status', 'uptime', 'load', 'resource']],
        ['security', ['security', 'auth', 'authentication', 'authorization', 'token', 'jwt', 'oauth', 'password', 'encrypt', 'decrypt', 'hash', 'ssl', 'tls', 'certificate', 'key', 'vulnerability', 'scan', 'firewall', 'permission']],
        ['communication', ['email', 'mail', 'message', 'chat', 'slack', 'teams', 'notification', 'alert', 'webhook', 'sms', 'phone', 'call', 'meeting', 'calendar', 'schedule', 'reminder', 'broadcast']]
    ]);

    analyzeRequest(prompt: string): RequestAnalysis {
        const words = prompt.toLowerCase().split(/\s+/);
        const domainScores = new Map<string, number>();

        // Score each domain based on keyword matches
        for (const [domain, keywords] of this.domainPatterns) {
            let score = 0;
            for (const keyword of keywords) {
                const matches = words.filter(word => 
                    word.includes(keyword) || keyword.includes(word)
                ).length;
                score += matches;
            }
            if (score > 0) {
                domainScores.set(domain, score);
            }
        }

        // Sort domains by score
        const sortedDomains = Array.from(domainScores.entries())
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0]);

        const primaryDomain = sortedDomains[0] || 'general';
        const secondaryDomains = sortedDomains.slice(1, 3);
        const topScore = domainScores.get(primaryDomain) || 0;
        const confidence = Math.min(topScore * 0.2, 1.0);

        return {
            primaryDomain,
            secondaryDomains,
            requiredCapabilities: this.extractCapabilities(prompt),
            confidence
        };
    }

    private extractCapabilities(prompt: string): string[] {
        const capabilities: string[] = [];
        const lowerPrompt = prompt.toLowerCase();

        // Extract specific capabilities based on verbs and actions
        if (lowerPrompt.includes('list') || lowerPrompt.includes('show') || lowerPrompt.includes('get')) {
            capabilities.push('read');
        }
        if (lowerPrompt.includes('create') || lowerPrompt.includes('add') || lowerPrompt.includes('insert')) {
            capabilities.push('create');
        }
        if (lowerPrompt.includes('update') || lowerPrompt.includes('modify') || lowerPrompt.includes('change')) {
            capabilities.push('update');
        }
        if (lowerPrompt.includes('delete') || lowerPrompt.includes('remove') || lowerPrompt.includes('drop')) {
            capabilities.push('delete');
        }
        if (lowerPrompt.includes('search') || lowerPrompt.includes('find') || lowerPrompt.includes('query')) {
            capabilities.push('search');
        }
        if (lowerPrompt.includes('generate') || lowerPrompt.includes('create') || lowerPrompt.includes('build')) {
            capabilities.push('generate');
        }
        if (lowerPrompt.includes('analyze') || lowerPrompt.includes('calculate') || lowerPrompt.includes('process')) {
            capabilities.push('analyze');
        }

        return capabilities;
    }
}

class AdaptivePersonaGenerator {
    private readonly toolRegistry: DynamicToolRegistry;
    private readonly requestAnalyzer: RequestAnalyzer;

    constructor(toolRegistry: DynamicToolRegistry) {
        this.toolRegistry = toolRegistry;
        this.requestAnalyzer = new RequestAnalyzer();
    }

    generatePersona(request: string): { persona: string; availableTools: string; capabilities: DomainCapabilities[] } {
        const analysis = this.requestAnalyzer.analyzeRequest(request);
        const allTools = this.toolRegistry.getAllTools();
        
        // Group tools by domain/category
        const toolsByDomain = new Map<string, string[]>();
        for (const tool of allTools) {
            const domain = this.mapCategoryToDomain(tool.category || 'general');
            if (!toolsByDomain.has(domain)) {
                toolsByDomain.set(domain, []);
            }
            toolsByDomain.get(domain)!.push(tool.name);
        }

        // Generate capabilities based on available tools
        const capabilities: DomainCapabilities[] = [];
        for (const [domain, tools] of toolsByDomain) {
            if (tools.length > 0) {
                capabilities.push({
                    domain,
                    tools,
                    description: this.getDomainDescription(domain),
                    examples: this.getDomainExamples(domain)
                });
            }
        }

        // Generate adaptive persona
        const persona = this.buildPersona(analysis, capabilities);
        const availableTools = this.buildToolsDescription(capabilities);

        return { persona, availableTools, capabilities };
    }

    private mapCategoryToDomain(category: string): string {
        const categoryMap: Record<string, string> = {
            'database': 'database',
            'query': 'database',
            'analysis': 'analysis',
            'general': 'general',
            'git': 'git',
            'file-system': 'file-system',
            'web': 'web',
            'development': 'development',
            'system': 'system',
            'security': 'security',
            'communication': 'communication'
        };
        return categoryMap[category] || 'general';
    }

    private getDomainDescription(domain: string): string {
        const descriptions: Record<string, string> = {
            'database': 'Database operations, queries, and schema management',
            'git': 'Version control and repository management',
            'file-system': 'File and directory operations',
            'web': 'Web requests and API interactions',
            'development': 'Code analysis and development tools',
            'analysis': 'Data analysis and reporting',
            'system': 'System monitoring and management',
            'security': 'Security and authentication operations',
            'communication': 'Messaging and notification services',
            'general': 'General utility operations'
        };
        return descriptions[domain] || 'General operations';
    }

    private getDomainExamples(domain: string): string[] {
        const examples: Record<string, string[]> = {
            'database': ['List database schemas', 'Execute SQL queries', 'Generate ERD diagrams'],
            'git': ['Check repository status', 'Review code changes', 'Manage branches'],
            'file-system': ['Search files', 'Read file contents', 'Manage directories'],
            'web': ['Make HTTP requests', 'Fetch API data', 'Parse web content'],
            'development': ['Analyze code', 'Run tests', 'Build projects'],
            'analysis': ['Process data', 'Generate reports', 'Create visualizations'],
            'system': ['Monitor processes', 'Check system health', 'Manage services'],
            'security': ['Authenticate users', 'Encrypt data', 'Scan vulnerabilities'],
            'communication': ['Send notifications', 'Schedule meetings', 'Broadcast messages'],
            'general': ['Process information', 'Perform calculations', 'Manage data']
        };
        return examples[domain] || ['General operations'];
    }

    private buildPersona(analysis: RequestAnalysis, capabilities: DomainCapabilities[]): string {
        const { primaryDomain, confidence } = analysis;
        const availableDomains = capabilities.map(c => c.domain);
        
        let persona = `You are an adaptive AI assistant with access to various tools from connected MCP (Model Context Protocol) servers. `;
        
        if (confidence > 0.5 && availableDomains.includes(primaryDomain)) {
            // High confidence in domain, specialize
            persona += `Based on your request, I'm focusing on ${primaryDomain} operations. `;
            const domainCapability = capabilities.find(c => c.domain === primaryDomain);
            if (domainCapability) {
                persona += `I have ${domainCapability.tools.length} ${primaryDomain} tools available. `;
            }
        } else {
            // Low confidence or no matching tools, be general
            persona += `I can help with various tasks across multiple domains. `;
        }

        persona += `\n\nAvailable domains: ${availableDomains.join(', ')}`;
        
        if (availableDomains.length === 0) {
            persona += `\n\nCurrently, no MCP servers are connected. Please configure MCP servers to enable tool-based assistance.`;
        }

        persona += `\n\nI will analyze your request and use the most appropriate tools to help you. `;
        persona += `I always prioritize safety and will ask for confirmation before performing any potentially destructive operations.`;

        return persona;
    }

    private buildToolsDescription(capabilities: DomainCapabilities[]): string {
        if (capabilities.length === 0) {
            return "No tools are currently available. Please configure MCP servers to enable tool-based assistance.";
        }

        let description = "Available tools organized by domain:\n\n";
        
        for (const capability of capabilities) {
            description += `**${capability.domain.toUpperCase()}** (${capability.tools.length} tools)\n`;
            description += `- ${capability.description}\n`;
            description += `- Tools: ${capability.tools.join(', ')}\n`;
            description += `- Examples: ${capability.examples.join(', ')}\n\n`;
        }

        return description;
    }
}

export function registerAdaptiveToolsParticipant(context: vscode.ExtensionContext, toolRegistry: DynamicToolRegistry, proxyHandlers: ProxyToolHandlers) {
    const personaGenerator = new AdaptivePersonaGenerator(toolRegistry);
    
    const handler: vscode.ChatRequestHandler = async (
        request: vscode.ChatRequest, 
        chatContext: vscode.ChatContext, 
        stream: vscode.ChatResponseStream, 
        token: vscode.CancellationToken
    ) => {
        if (request.command === 'list') {
            const tools = toolRegistry.getAllTools();
            if (tools.length === 0) {
                stream.markdown(`No tools are currently available. Please configure MCP servers to enable tool-based assistance.\n\n`);
                stream.markdown(`Use the command palette: "Tools Bridger: Add MCP Server" to add a server.`);
                return;
            }

            stream.markdown(`## Available Tools (${tools.length} total)\n\n`);
            
            const toolsByDomain = new Map<string, typeof tools>();
            for (const tool of tools) {
                const domain = tool.category || 'general';
                if (!toolsByDomain.has(domain)) {
                    toolsByDomain.set(domain, []);
                }
                toolsByDomain.get(domain)!.push(tool);
            }

            for (const [domain, domainTools] of toolsByDomain) {
                stream.markdown(`### ${domain.toUpperCase()} (${domainTools.length} tools)\n`);
                for (const tool of domainTools) {
                    stream.markdown(`- **${tool.name}** (${tool.serverId}): ${tool.description || 'No description'}\n`);
                }
                stream.markdown(`\n`);
            }
            
            return;
        }

        if (request.command === 'capabilities') {
            const { capabilities } = personaGenerator.generatePersona(request.prompt);
            
            stream.markdown(`## Current Capabilities\n\n`);
            
            if (capabilities.length === 0) {
                stream.markdown(`No tools are currently available. Please configure MCP servers to enable tool-based assistance.\n\n`);
                return;
            }

            for (const capability of capabilities) {
                stream.markdown(`### ${capability.domain.toUpperCase()}\n`);
                stream.markdown(`${capability.description}\n\n`);
                stream.markdown(`**Available Tools:** ${capability.tools.join(', ')}\n\n`);
                stream.markdown(`**Example Tasks:** ${capability.examples.join(', ')}\n\n`);
            }
            
            return;
        }

        if (request.command === 'servers') {
            const servers = toolRegistry.getAllTools();
            const serverMap = new Map<string, typeof servers>();
            
            for (const tool of servers) {
                if (!serverMap.has(tool.serverId)) {
                    serverMap.set(tool.serverId, []);
                }
                serverMap.get(tool.serverId)!.push(tool);
            }

            stream.markdown(`## Connected MCP Servers (${serverMap.size} total)\n\n`);
            
            if (serverMap.size === 0) {
                stream.markdown(`No MCP servers are currently connected.\n\n`);
                stream.markdown(`Use the command palette: "Tools Bridger: Add MCP Server" to add a server.`);
                return;
            }

            for (const [serverId, serverTools] of serverMap) {
                stream.markdown(`### ${serverId}\n`);
                stream.markdown(`**Tools:** ${serverTools.length}\n`);
                stream.markdown(`**Tool Names:** ${serverTools.map(t => t.name).join(', ')}\n\n`);
            }
            
            return;
        }

        // Generate adaptive persona based on request
        const { persona, availableTools } = personaGenerator.generatePersona(request.prompt);

        let model = request.model;
        if (model.vendor === 'copilot' && model.family.startsWith('o1')) {
            model = await selectFallbackModel();
        }

        // Use all available proxy tools
        const tools = vscode.lm.tools.filter(tool => tool.tags.includes('proxy') || tool.tags.includes('dynamic'));

        const options: vscode.LanguageModelChatRequestOptions = {
            justification: 'To provide adaptive assistance using available MCP tools',
        };

        // Create adaptive system message
        const messages = [
            vscode.LanguageModelChatMessage.User(`${persona}

${availableTools}

IMPORTANT: When using tools, you must specify the exact tool name and participant ID. For most operations, use participantId: "toolsAgent". The system will automatically route tools to the correct participant based on the tool's domain.

User request: ${request.prompt}`)
        ];

        const toolReferences = [...request.toolReferences];
        const accumulatedToolResults: Record<string, vscode.LanguageModelToolResult> = {};
        const toolCallRounds: DatabaseToolCallRound[] = [];

        const runWithTools = async (): Promise<void> => {
            const requestedTool = toolReferences.shift();
            if (requestedTool) {
                options.toolMode = vscode.LanguageModelChatToolMode.Required;
                options.tools = vscode.lm.tools.filter(tool => tool.name === requestedTool.name);
            } else {
                options.toolMode = undefined;
                options.tools = [...tools];
            }

            const response = await model.sendRequest(messages, options, token);

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
                stream.progress('Executing tools...');
                
                toolCallRounds.push({
                    response: responseStr,
                    toolCalls
                });

                const assistantContent: (vscode.LanguageModelTextPart | vscode.LanguageModelToolCallPart)[] = [];
                if (responseStr) {
                    assistantContent.push(new vscode.LanguageModelTextPart(responseStr));
                }
                assistantContent.push(...toolCalls);
                messages.push(vscode.LanguageModelChatMessage.Assistant(assistantContent));

                const toolResults: vscode.LanguageModelToolResultPart[] = [];
                
                for (const toolCall of toolCalls) {
                    try {
                        const result = await vscode.lm.invokeTool(toolCall.name, {
                            toolInvocationToken: request.toolInvocationToken,
                            input: toolCall.input
                        }, token);
                        
                        toolResults.push(new vscode.LanguageModelToolResultPart(toolCall.callId, result.content));
                        accumulatedToolResults[toolCall.callId] = result;
                    } catch (error) {
                        console.error(`Error invoking tool ${toolCall.name}:`, error);
                        const errorMessage = `Error invoking tool ${toolCall.name}: ${error}`;
                        const errorResult = new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(errorMessage)]);
                        toolResults.push(new vscode.LanguageModelToolResultPart(toolCall.callId, errorResult.content));
                        accumulatedToolResults[toolCall.callId] = errorResult;
                    }
                }

                messages.push(vscode.LanguageModelChatMessage.User(toolResults));
                await runWithTools();
            }
        };

        await runWithTools();
    };

    const participant = vscode.chat.createChatParticipant('adaptive-tools-participant.toolsAgent', handler);
    participant.iconPath = new vscode.ThemeIcon('tools');
    participant.followupProvider = {
        provideFollowups(result: vscode.ChatResult, context: vscode.ChatContext, token: vscode.CancellationToken) {
            return [
                {
                    prompt: 'What other tools are available?',
                    label: 'Show available tools',
                    command: 'list'
                },
                {
                    prompt: 'What are your current capabilities?',
                    label: 'Show capabilities',
                    command: 'capabilities'
                },
                {
                    prompt: 'Which MCP servers are connected?',
                    label: 'Show connected servers',
                    command: 'servers'
                }
            ];
        }
    };

    context.subscriptions.push(participant);
} 