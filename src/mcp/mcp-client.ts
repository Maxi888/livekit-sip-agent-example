/**
 * MCP Client for LiveKit SIP Agent
 * 
 * This module provides integration with Model Context Protocol (MCP) servers.
 * It allows the agent to communicate with external MCP servers to access
 * additional tools and capabilities.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolRequest, ListToolsRequest } from '@modelcontextprotocol/sdk/types.js';

interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

interface MCPCallResult {
  success: boolean;
  result?: any;
  error?: string;
}

export class MCPClientService {
  private client: Client | null = null;
  private isConnected = false;
  private readonly serverUrl: string;
  private availableTools: MCPTool[] = [];

  constructor(serverUrl?: string) {
    this.serverUrl = serverUrl || process.env.MCP_SERVER_URL || 'https://prod-backend.maltesten.com:9000';
    console.log(`MCP Client initialized for server: ${this.serverUrl}`);
  }

  /**
   * Connect to the MCP server and initialize tools
   */
  async connect(): Promise<boolean> {
    try {
      console.log(`🔗 Connecting to MCP server: ${this.serverUrl}`);
      
      // For HTTP-based MCP servers, we'll use a different approach
      // Since the SDK's StdioClientTransport is for stdio, we'll implement HTTP transport
      await this.connectHttp();
      
      // Fetch available tools
      await this.loadAvailableTools();
      
      this.isConnected = true;
      console.log(`✅ MCP Client connected successfully. Available tools: ${this.availableTools.length}`);
      return true;
      
    } catch (error) {
      console.error('❌ Failed to connect to MCP server:', error);
      console.log('⚠️ Agent will continue without MCP tools. Only built-in functions (weather, endCall) will be available.');
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Connect via HTTP (since your server is HTTP-based)
   */
  private async connectHttp(): Promise<void> {
    // Test connection to the MCP server
    try {
      console.log(`🔍 Testing MCP server connection to: ${this.serverUrl}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Try different health endpoints
      const healthEndpoints = ['/health', '/api/health', '/mcp/health', '/'];
      let healthCheckPassed = false;
      
      for (const endpoint of healthEndpoints) {
        try {
          const response = await fetch(`${this.serverUrl}${endpoint}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          });

          // Accept any response (including 404) as server being alive
          if (response.status < 500) {
            console.log(`✅ MCP server responding at ${endpoint} (status: ${response.status})`);
            healthCheckPassed = true;
            break;
          }
        } catch (err) {
          // Continue trying other endpoints
          continue;
        }
      }

      clearTimeout(timeoutId);

      if (!healthCheckPassed) {
        throw new Error('No responsive endpoints found');
      }

      console.log('✅ MCP server health check passed');
    } catch (error) {
      console.error('❌ MCP server health check failed:', error);
      
      // Provide more detailed error information
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error('🕐 MCP server connection timed out after 5 seconds');
        } else if (error.message.includes('fetch')) {
          console.error('🌐 Network error connecting to MCP server - check if server is running and accessible');
        }
      }
      
      throw new Error(`Failed to connect to MCP server: ${error}`);
    }
  }

  /**
   * Load available tools from the MCP server
   */
  private async loadAvailableTools(): Promise<void> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Try different tools endpoints
      const toolsEndpoints = ['/tools', '/api/tools', '/mcp/tools', '/api/mcp'];
      let toolsLoaded = false;

      for (const endpoint of toolsEndpoints) {
        try {
          const response = await fetch(`${this.serverUrl}${endpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'tools/list',
              params: {}
            }),
            signal: controller.signal,
          });

          if (response.ok) {
            const data: any = await response.json();
            
            if (data.result && data.result.tools) {
              this.availableTools = data.result.tools.map((tool: any) => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema,
              }));
              
              console.log(`📋 Loaded ${this.availableTools.length} MCP tools from ${endpoint}:`, this.availableTools.map(t => t.name));
              toolsLoaded = true;
              break;
            }
          } else {
            console.log(`⚠️ Tools endpoint ${endpoint} returned status: ${response.status}`);
          }
        } catch (err) {
          console.log(`⚠️ Failed to connect to tools endpoint ${endpoint}:`, err instanceof Error ? err.message : 'Unknown error');
          continue;
        }
      }

      clearTimeout(timeoutId);

      if (!toolsLoaded) {
        console.log('⚠️ No working tools endpoints found. MCP server may use different API structure.');
        this.availableTools = [];
      }
    } catch (error) {
      console.error('❌ Failed to load MCP tools:', error);
      this.availableTools = [];
    }
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(toolName: string, arguments_: any): Promise<MCPCallResult> {
    if (!this.isConnected) {
      return {
        success: false,
        error: 'MCP client is not connected',
      };
    }

    try {
      console.log(`🔧 Calling MCP tool: ${toolName} with args:`, arguments_);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.serverUrl}/tools/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: arguments_,
          }
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: any = await response.json();

      if (data.error) {
        console.error(`❌ MCP tool call failed:`, data.error);
        return {
          success: false,
          error: data.error.message || 'Tool call failed',
        };
      }

      console.log(`✅ MCP tool call successful:`, data.result);
      return {
        success: true,
        result: data.result,
      };

    } catch (error) {
      console.error(`❌ MCP tool call error for ${toolName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get list of available tools for OpenAI function definitions
   */
  getToolDefinitions(): any[] {
    return this.availableTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema || {
        type: 'object',
        properties: {},
        required: [],
      },
    }));
  }

  /**
   * Check if a specific tool is available
   */
  hasToolP(toolName: string): boolean {
    return this.availableTools.some(tool => tool.name === toolName);
  }

  /**
   * Get all available tool names
   */
  getAvailableToolNames(): string[] {
    return this.availableTools.map(tool => tool.name);
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        console.error('Error closing MCP client:', error);
      }
    }
    
    this.isConnected = false;
    this.client = null;
    console.log('🔌 MCP Client disconnected');
  }

  /**
   * Check if client is connected
   */
  isClientConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Test MCP server connectivity without full initialization
   */
  async testConnection(): Promise<{ success: boolean; error?: string; tools?: string[] }> {
    try {
      console.log(`🧪 Testing MCP server connectivity: ${this.serverUrl}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${this.serverUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      // Try to get tools list
      const toolsController = new AbortController();
      const toolsTimeoutId = setTimeout(() => toolsController.abort(), 3000);

      const toolsResponse = await fetch(`${this.serverUrl}/tools`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {}
        }),
        signal: toolsController.signal,
      });

      clearTimeout(toolsTimeoutId);

      if (toolsResponse.ok) {
        const data: any = await toolsResponse.json();
        const tools = data.result?.tools?.map((tool: any) => tool.name) || [];
        return {
          success: true,
          tools,
        };
      }

      return {
        success: true,
        tools: [],
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Create singleton instance
export const mcpClient = new MCPClientService();

// Helper function to initialize MCP client
export async function initializeMCP(): Promise<boolean> {
  return await mcpClient.connect();
}

// Export types for use in other modules
export type { MCPTool, MCPCallResult }; 