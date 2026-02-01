/**
 * Android Code Search API Client
 * Reverse-engineered from cs.android.com
 */

const API_BASE = 'https://grimoireoss-pa.clients6.google.com';
const API_KEY = 'AIzaSyD1ZDuAdU_IZqa3Wscr053WydRT7FoJdmQ';

export interface SearchOptions {
  query: string;
  pageSize?: number;
  pageToken?: string;
  repositoryScope?: RepositoryScope;
  numberOfContextLines?: number;
}

export interface RepositoryScope {
  ossProject?: string;
  repositoryName?: string;
  refSpec?: string;
}

export interface FileSpec {
  sourceRoot: {
    repositoryKey: {
      repositoryName: string;
      ossProject: string;
    };
    refSpec: string;
  };
  path: string;
  type?: string;
}

export interface SearchResult {
  fileSearchResult?: {
    fileSpec: FileSpec;
    snippets?: Array<{
      snippetLines: Array<{
        lineText: string;
        lineNumber: string;
      }>;
    }>;
  };
  resultToken?: string;
}

export interface SearchResponse {
  searchResults: SearchResult[];
  nextPageToken?: string;
  totalResults?: number;
}

export interface SuggestResponse {
  suggestions: Array<{
    title: string;
    symbol?: {
      type: string;
    };
    fileSpec: FileSpec;
    lineNumber: number;
    match?: {
      lineNumber: number;
      lineText: string;
    };
  }>;
}

export interface FileContentResponse {
  content: string;
  mimeType?: string;
  size?: string;
}

function generateBoundary(): string {
  return 'batch' + Math.random().toString().slice(2);
}

function generateSessionId(): string {
  return Math.random().toString(36).slice(2, 14);
}

function generateActionId(): string {
  return Math.random().toString(36).slice(2, 14);
}

async function batchRequest(endpoint: string, body: object): Promise<any> {
  const boundary = generateBoundary();
  const sessionId = generateSessionId();
  const actionId = generateActionId();

  const innerRequest = `POST ${endpoint}?alt=json&key=${API_KEY}
sessionid: ${sessionId}
actionid: ${actionId}
X-JavaScript-User-Agent: google-api-javascript-client/1.1.0
X-Requested-With: XMLHttpRequest
Content-Type: application/json
X-Goog-Encode-Response-If-Executable: base64

${JSON.stringify(body)}`;

  const multipartBody = `--${boundary}
Content-Type: application/http
Content-Transfer-Encoding: binary
Content-ID: <${boundary}+gapiRequest@googleapis.com>

${innerRequest}
--${boundary}--`;

  const response = await fetch(`${API_BASE}/batch?$ct=multipart/mixed;%20boundary=${boundary}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Origin': 'https://cs.android.com',
      'Referer': 'https://cs.android.com/',
    },
    body: multipartBody,
  });

  const responseText = await response.text();

  // Parse multipart response to extract JSON
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  throw new Error('Failed to parse response');
}

async function grpcRequest(service: string, method: string, body: any[]): Promise<any> {
  const url = `${API_BASE}/$rpc/${service}/${method}?$httpHeaders=` +
    encodeURIComponent([
      `X-Goog-Api-Key:${API_KEY}`,
      'X-Goog-Api-Client:grpc-web/1.0.0 grimoire/1.0.0',
      'X-Server-Timeout:60',
      'Content-Type:application/json+protobuf',
      'X-User-Agent:grpc-web-javascript/0.1',
    ].join('\r\n'));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'Origin': 'https://cs.android.com',
      'Referer': 'https://cs.android.com/',
    },
    body: JSON.stringify(body),
  });

  return response.json();
}

/**
 * Search for code in Android source
 */
export async function searchCode(options: SearchOptions): Promise<SearchResponse> {
  const body = {
    queryString: options.query,
    searchOptions: {
      enableDiagnostics: false,
      exhaustive: false,
      isDedupResultsEnabled: false,
      numberOfContextLines: options.numberOfContextLines ?? 1,
      pageSize: options.pageSize ?? 10,
      pageToken: options.pageToken ?? '',
      pathPrefix: '',
      repositoryScope: options.repositoryScope ?? {},
      retrieveMultibranchResults: true,
      savedQuery: '',
      scoringModel: '',
      showPersonalizedResults: false,
      suppressGitLegacyResults: false,
    },
    snippetOptions: {
      minSnippetLinesPerFile: 10,
      minSnippetLinesPerPage: 60,
      numberOfContextLines: options.numberOfContextLines ?? 1,
    },
  };

  return batchRequest('/v1/contents/search', body);
}

/**
 * Get search suggestions
 */
export async function getSuggestions(query: string, maxSuggestions = 7): Promise<SuggestResponse> {
  const body = {
    queryString: query,
    suggestOptions: {
      enableDiagnostics: false,
      maxSuggestions,
      pathPrefix: '',
      repositoryScope: {},
      retrieveMultibranchResults: true,
      savedQuery: '',
      showPersonalizedResults: false,
      suppressGitLegacyResults: false,
    },
  };

  return batchRequest('/v1/contents/suggest', body);
}

/**
 * Get file contents
 */
export async function getFileContents(
  ossProject: string,
  repositoryName: string,
  branch: string,
  filePath: string
): Promise<FileContentResponse> {
  const body = [
    [
      [
        [null, repositoryName, null, null, ossProject],
        null,
        branch,
        branch,
      ],
      filePath,
    ],
    1,    // include content
    null,
    1,    // include metadata
    null,
    null,
    null,
    null,
    1,    // include rendered HTML
  ];

  const response = await grpcRequest(
    'devtools.grimoire.FileService',
    'GetContentsStreaming',
    body
  );

  // Parse the gRPC response
  // Response structure: [[[null, [metadata], content, size, null, [html]]]]
  // The content is a string that contains the actual source code
  try {
    if (Array.isArray(response) && response[0]) {
      const outerArray = response[0];
      if (Array.isArray(outerArray) && outerArray[0]) {
        const fileDataArray = outerArray[0];
        // fileDataArray structure: [null, [metadata], "content string", "size", ...]

        // Find the content - it's the first long string with newlines (source code)
        let content = '';
        let size = '0';
        let mimeType = 'text/plain';

        for (let i = 0; i < fileDataArray.length; i++) {
          const item = fileDataArray[i];

          // Extract MIME type from metadata array
          if (Array.isArray(item) && item[1] && Array.isArray(item[1])) {
            const metadata = item[1];
            if (typeof metadata[0] === 'string' && metadata[0].startsWith('text/')) {
              mimeType = metadata[0];
            }
          }

          // The content is a string with newlines (source code)
          if (typeof item === 'string') {
            if (item.includes('\n') && item.length > 100 && !item.startsWith('<div') && !item.startsWith('http')) {
              content = item;
            } else if (/^\d+$/.test(item)) {
              size = item;
            }
          }
        }

        if (content) {
          return { content, mimeType, size };
        }
      }
    }
  } catch (e) {
    // Fall through to deep search
  }

  // Fallback: deep search for content
  return {
    content: extractContentFromResponse(response),
    mimeType: extractMimeType(response),
    size: extractSize(response),
  };
}

function findStringContent(arr: any[]): string {
  for (const item of arr) {
    if (typeof item === 'string' && item.length > 100) {
      return item;
    }
    if (Array.isArray(item)) {
      const found = findStringContent(item);
      if (found) return found;
    }
  }
  return '';
}

function extractContentFromResponse(response: any): string {
  // Deep search for the content string in the response
  const jsonStr = JSON.stringify(response);

  // Look for the actual source code content
  // It's usually a long string with newlines
  function searchForContent(obj: any): string {
    if (typeof obj === 'string' && obj.includes('\n') && obj.length > 50) {
      // Check if it looks like source code (not HTML)
      if (!obj.startsWith('<div') && !obj.startsWith('http')) {
        return obj;
      }
    }
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = searchForContent(item);
        if (found) return found;
      }
    }
    if (obj && typeof obj === 'object') {
      for (const value of Object.values(obj)) {
        const found = searchForContent(value);
        if (found) return found;
      }
    }
    return '';
  }

  return searchForContent(response);
}

function extractMimeType(response: any): string {
  function search(obj: any): string {
    if (typeof obj === 'string' && obj.startsWith('text/')) {
      return obj;
    }
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = search(item);
        if (found) return found;
      }
    }
    return '';
  }
  return search(response) || 'text/plain';
}

function extractSize(response: any): string {
  // Size is usually a numeric string in the response
  function search(obj: any): string {
    if (typeof obj === 'string' && /^\d+$/.test(obj) && obj.length < 10) {
      return obj;
    }
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = search(item);
        if (found) return found;
      }
    }
    return '';
  }
  return search(response) || '0';
}

/**
 * List available projects/repositories
 */
export function getAvailableProjects(): Array<{id: string; name: string; description: string}> {
  return [
    { id: 'android', name: 'Android', description: 'Android mobile operating system' },
    { id: 'androidx', name: 'AndroidX', description: 'Libraries for Android development' },
    { id: 'android-studio', name: 'Android Studio', description: 'Android Studio IDE projects' },
    { id: 'android-llvm', name: 'Android-LLVM', description: 'Android branch of the LLVM Project' },
  ];
}
