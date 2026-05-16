#!/usr/bin/env node
/**
 * Android Code Search MCP Server
 * Provides tools to search and browse Android source code via cs.android.com
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  searchCode,
  getSuggestions,
  getFileContents,
  getAvailableProjects,
  type SearchResponse,
  type FileSpec,
} from './api.js';

const server = new Server(
  {
    name: 'cs-android-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_android_code',
        description: 'Search for code in Android source repositories (cs.android.com). Returns matching files and code snippets.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query. Supports regex and special operators like file:, class:, function:, etc.',
            },
            project: {
              type: 'string',
              description: 'Filter by project: android, androidx, android-studio, android-llvm',
              enum: ['android', 'androidx', 'android-studio', 'android-llvm'],
            },
            pageSize: {
              type: 'number',
              description: 'Number of results to return (default: 10, max: 50)',
              default: 10,
            },
            contextLines: {
              type: 'number',
              description: 'Number of context lines around matches (default: 1)',
              default: 1,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_file_content',
        description: 'Get the full content of a source file from Android repositories',
        inputSchema: {
          type: 'object',
          properties: {
            project: {
              type: 'string',
              description: 'Project name: android, androidx, android-studio, android-llvm',
              enum: ['android', 'androidx', 'android-studio', 'android-llvm'],
            },
            repository: {
              type: 'string',
              description: 'Repository name (e.g., platform/superproject/main, platform/frameworks/support)',
            },
            branch: {
              type: 'string',
              description: 'Branch name (e.g., main, master, androidx-main)',
            },
            path: {
              type: 'string',
              description: 'File path within the repository',
            },
          },
          required: ['project', 'repository', 'branch', 'path'],
        },
      },
      {
        name: 'suggest_symbols',
        description: 'Get symbol suggestions for a partial query (classes, methods, files)',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Partial query to get suggestions for',
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of suggestions (default: 7)',
              default: 7,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'list_projects',
        description: 'List available Android source projects that can be searched',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_android_code': {
        const query = args?.query as string;
        const project = args?.project as string | undefined;
        const pageSize = Math.min((args?.pageSize as number) || 10, 50);
        const contextLines = (args?.contextLines as number) || 1;

        const repositoryScope = project ? { ossProject: project } : {};

        const response: SearchResponse = await searchCode({
          query,
          pageSize,
          numberOfContextLines: contextLines,
          repositoryScope,
        });

        const results = formatSearchResults(response);
        return {
          content: [
            {
              type: 'text',
              text: results,
            },
          ],
        };
      }

      case 'get_file_content': {
        const project = args?.project as string;
        const repository = args?.repository as string;
        const branch = args?.branch as string;
        const path = args?.path as string;

        const response = await getFileContents(project, repository, branch, path);

        return {
          content: [
            {
              type: 'text',
              text: `# File: ${path}\n\n\`\`\`\n${response.content}\n\`\`\`\n\nSize: ${response.size} bytes\nMIME Type: ${response.mimeType}`,
            },
          ],
        };
      }

      case 'suggest_symbols': {
        const query = args?.query as string;
        const maxResults = (args?.maxResults as number) || 7;

        const response = await getSuggestions(query, maxResults);

        const suggestions = response.suggestions.map((s, i) => {
          const symbolType = s.symbol?.type || 'FILE';
          const location = `${s.fileSpec.sourceRoot.repositoryKey.ossProject}/${s.fileSpec.sourceRoot.repositoryKey.repositoryName}`;
          return `${i + 1}. [${symbolType}] ${s.title}\n   Location: ${location}\n   Path: ${s.fileSpec.path}:${s.lineNumber}`;
        }).join('\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `# Symbol Suggestions for "${query}"\n\n${suggestions || 'No suggestions found.'}`,
            },
          ],
        };
      }

      case 'list_projects': {
        const projects = getAvailableProjects();
        const projectList = projects.map(p =>
          `- **${p.name}** (${p.id}): ${p.description}`
        ).join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `# Available Android Source Projects\n\n${projectList}\n\nUse the project ID when searching or fetching files.`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// List resources (predefined quick-access resources)
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: androidResourceUri(
          'android',
          'platform/superproject',
          'main',
          'frameworks/base/core/java/android/app/Activity.java'
        ),
        name: 'Activity.java',
        description: 'Android Activity base class source code',
        mimeType: 'text/x-java',
      },
      {
        uri: androidResourceUri(
          'android',
          'platform/superproject',
          'main',
          'frameworks/base/core/java/android/view/View.java'
        ),
        name: 'View.java',
        description: 'Android View base class source code',
        mimeType: 'text/x-java',
      },
      {
        uri: androidResourceUri(
          'android',
          'platform/superproject',
          'main',
          'frameworks/base/core/java/android/content/Context.java'
        ),
        name: 'Context.java',
        description: 'Android Context abstract class source code',
        mimeType: 'text/x-java',
      },
    ],
  };
});

// Read resource
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  const { project, repository, branch, path } = parseAndroidResourceUri(uri);

  const response = await getFileContents(project, repository, branch, path);

  return {
    contents: [
      {
        uri,
        mimeType: response.mimeType || 'text/plain',
        text: response.content,
      },
    ],
  };
});

function androidResourceUri(
  project: string,
  repository: string,
  branch: string,
  path: string
): string {
  const params = new URLSearchParams({ project, repository, branch, path });
  return `android://source?${params.toString()}`;
}

function parseAndroidResourceUri(uri: string): {
  project: string;
  repository: string;
  branch: string;
  path: string;
} {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    throw new Error(`Invalid resource URI: ${uri}`);
  }

  if (url.protocol !== 'android:' || url.hostname !== 'source') {
    throw new Error(`Invalid resource URI: ${uri}`);
  }

  const project = url.searchParams.get('project');
  const repository = url.searchParams.get('repository');
  const branch = url.searchParams.get('branch');
  const path = url.searchParams.get('path');

  if (!project || !repository || !branch || !path) {
    throw new Error(`Invalid resource URI: ${uri}`);
  }

  return { project, repository, branch, path };
}

function formatSearchResults(response: SearchResponse): string {
  if (!response.searchResults || response.searchResults.length === 0) {
    return 'No results found.';
  }

  const results = response.searchResults.map((result, index) => {
    const fileResult = result.fileSearchResult;
    if (!fileResult) return '';

    const fileSpec = fileResult.fileSpec;
    const project = fileSpec.sourceRoot.repositoryKey.ossProject;
    const repo = fileSpec.sourceRoot.repositoryKey.repositoryName;
    const branch = fileSpec.sourceRoot.refSpec.replace('refs/heads/', '');
    const path = fileSpec.path;

    let output = `## ${index + 1}. ${path}\n`;
    output += `**Project:** ${project} | **Repository:** ${repo} | **Branch:** ${branch}\n`;
    output += `**URL:** https://cs.android.com/${project}/${repo}/+/${branch}:${path}\n\n`;

    if (fileResult.snippets && fileResult.snippets.length > 0) {
      output += '```\n';
      for (const snippet of fileResult.snippets) {
        for (const line of snippet.snippetLines) {
          output += `${line.lineNumber}: ${line.lineText}\n`;
        }
      }
      output += '```\n';
    }

    return output;
  }).filter(Boolean);

  return `# Search Results\n\nFound ${response.searchResults.length} results\n\n${results.join('\n---\n\n')}`;
}

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Android Code Search MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
