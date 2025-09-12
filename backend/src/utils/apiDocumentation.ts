/**
 * API Documentation Generator
 * API文档生成和标准化响应格式模块
 */

import { Router, Request, Response, NextFunction } from 'express';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import logger from './logger';

/**
 * API文档接口定义
 */
export interface ApiEndpoint {
  path: string;
  method: string;
  summary: string;
  description?: string;
  parameters?: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses: ApiResponse[];
  tags?: string[];
  authentication?: boolean;
  rateLimit?: {
    requests: number;
    window: string;
  };
}

export interface ApiParameter {
  name: string;
  in: 'path' | 'query' | 'header';
  type: string;
  required: boolean;
  description?: string;
  example?: any;
  enum?: string[];
}

export interface ApiRequestBody {
  contentType: string;
  schema: any;
  example?: any;
  description?: string;
}

export interface ApiResponse {
  statusCode: number;
  description: string;
  schema?: any;
  example?: any;
}

/**
 * 标准化API响应格式
 */
export interface StandardApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      hasNext: boolean;
    };
    performance?: {
      responseTime: number;
      cacheHit?: boolean;
    };
  };
}

/**
 * API文档生成器类
 */
export class ApiDocumentationGenerator {
  private endpoints: Map<string, ApiEndpoint> = new Map();
  private schemas: Map<string, any> = new Map();
  private apiInfo = {
    title: 'Email Assist API',
    version: '1.0.0',
    description: 'AI驱动的智能邮件管理系统API',
    baseUrl: '/api/v1',
    contact: {
      name: 'API Support',
      email: 'support@emailassist.com'
    }
  };

  /**
   * 注册API端点
   */
  registerEndpoint(endpoint: ApiEndpoint): void {
    const key = `${endpoint.method.toUpperCase()} ${endpoint.path}`;
    this.endpoints.set(key, endpoint);
  }

  /**
   * 注册数据模型
   */
  registerSchema(name: string, schema: any): void {
    this.schemas.set(name, schema);
  }

  /**
   * 从路由文件自动提取API文档
   */
  extractFromRoutes(routesDir: string): void {
    try {
      const routeFiles = this.getRouteFiles(routesDir);
      
      for (const file of routeFiles) {
        const filePath = join(routesDir, file);
        const content = readFileSync(filePath, 'utf8');
        const endpoints = this.parseRouteFile(content, file);
        
        endpoints.forEach(endpoint => {
          this.registerEndpoint(endpoint);
        });
      }
      
      logger.info('API documentation extracted from routes', {
        totalEndpoints: this.endpoints.size,
        routeFiles: routeFiles.length
      });
    } catch (error) {
      logger.error('Failed to extract API documentation from routes', { error });
    }
  }

  /**
   * 获取路由文件列表
   */
  private getRouteFiles(dir: string): string[] {
    const files: string[] = [];
    
    try {
      const items = readdirSync(dir);
      
      for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);
        
        if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.js'))) {
          files.push(item);
        }
      }
    } catch (error) {
      logger.warn('Could not read routes directory', { dir, error });
    }
    
    return files;
  }

  /**
   * 解析路由文件提取API文档
   */
  private parseRouteFile(content: string, filename: string): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];
    const lines = content.split('\\n');
    
    let currentDoc: Partial<ApiEndpoint> = {};
    let inDocBlock = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 检测文档注释开始
      if (line.startsWith('/**')) {
        inDocBlock = true;
        currentDoc = {};
        continue;
      }
      
      // 检测文档注释结束
      if (line.includes('*/')) {
        inDocBlock = false;
        continue;
      }
      
      // 解析文档注释内容
      if (inDocBlock) {
        this.parseDocComment(line, currentDoc);
      }
      
      // 检测路由定义
      if (!inDocBlock && this.isRouteDefinition(line)) {
        const routeInfo = this.parseRouteDefinition(line);
        if (routeInfo && currentDoc.path) {
          const endpoint: ApiEndpoint = {
            path: currentDoc.path,
            method: routeInfo.method,
            summary: currentDoc.summary || `${routeInfo.method} ${currentDoc.path}`,
            description: currentDoc.description,
            parameters: currentDoc.parameters || [],
            requestBody: currentDoc.requestBody,
            responses: currentDoc.responses || [
              {
                statusCode: 200,
                description: 'Success'
              }
            ],
            tags: [filename.replace(/\\.(ts|js)$/, '')],
            authentication: true // 默认需要认证
          };
          
          endpoints.push(endpoint);
          currentDoc = {};
        }
      }
    }
    
    return endpoints;
  }

  /**
   * 解析文档注释
   */
  private parseDocComment(line: string, doc: Partial<ApiEndpoint>): void {
    const trimmed = line.replace(/^\\s*\\*\\s?/, '');
    
    if (trimmed.startsWith('@route')) {
      const routeMatch = trimmed.match(/@route\\s+(\\w+)\\s+(.+)/);
      if (routeMatch) {
        doc.method = routeMatch[1];
        doc.path = routeMatch[2];
      }
    } else if (trimmed.startsWith('@desc')) {
      doc.description = trimmed.replace('@desc', '').trim();
    } else if (trimmed.startsWith('@summary')) {
      doc.summary = trimmed.replace('@summary', '').trim();
    } else if (trimmed.startsWith('@param')) {
      const paramMatch = trimmed.match(/@param\\s+\\{([^}]+)\\}\\s+(\\w+)\\s*-\\s*(.+)/);
      if (paramMatch) {
        if (!doc.parameters) doc.parameters = [];
        doc.parameters.push({
          name: paramMatch[2],
          in: 'query',
          type: paramMatch[1],
          required: !paramMatch[1].includes('?'),
          description: paramMatch[3]
        });
      }
    } else if (trimmed.startsWith('@query')) {
      const queryMatch = trimmed.match(/@query\\s+\\{([^}]+)\\}\\s+(\\w+)\\s*-\\s*(.+)/);
      if (queryMatch) {
        if (!doc.parameters) doc.parameters = [];
        doc.parameters.push({
          name: queryMatch[2],
          in: 'query',
          type: queryMatch[1],
          required: !queryMatch[1].includes('?'),
          description: queryMatch[3]
        });
      }
    } else if (!trimmed.startsWith('@') && trimmed && !doc.summary) {
      doc.summary = trimmed;
    }
  }

  /**
   * 检查是否为路由定义
   */
  private isRouteDefinition(line: string): boolean {
    return /router\.(get|post|put|delete|patch)\s*\(/.test(line);
  }

  /**
   * 解析路由定义
   */
  private parseRouteDefinition(line: string): { method: string } | null {
    const match = line.match(/router\.(get|post|put|delete|patch)\s*\(/);
    if (match) {
      return { method: match[1].toUpperCase() };
    }
    return null;
  }

  /**
   * 生成OpenAPI 3.0规范
   */
  generateOpenApiSpec(): any {
    const paths: any = {};
    
    // 构建路径对象
    for (const [key, endpoint] of this.endpoints) {
      const { path, method } = endpoint;
      
      if (!paths[path]) {
        paths[path] = {};
      }
      
      paths[path][method.toLowerCase()] = {
        summary: endpoint.summary,
        description: endpoint.description,
        tags: endpoint.tags,
        security: endpoint.authentication ? [{ bearerAuth: [] }] : [],
        parameters: this.convertParameters(endpoint.parameters || []),
        requestBody: endpoint.requestBody ? this.convertRequestBody(endpoint.requestBody) : undefined,
        responses: this.convertResponses(endpoint.responses)
      };
    }

    // 构建完整的OpenAPI规范
    const spec = {
      openapi: '3.0.0',
      info: this.apiInfo,
      servers: [
        {
          url: process.env.API_BASE_URL || 'http://localhost:3001',
          description: 'Development server'
        }
      ],
      paths,
      components: {
        schemas: Object.fromEntries(this.schemas),
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        },
        responses: {
          ValidationError: {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          },
          NotFound: {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          },
          Unauthorized: {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          },
          RateLimit: {
            description: 'Rate limit exceeded',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    };

    // 注册标准响应模式
    this.registerStandardSchemas();

    return spec;
  }

  /**
   * 转换参数格式
   */
  private convertParameters(parameters: ApiParameter[]): any[] {
    return parameters.map(param => ({
      name: param.name,
      in: param.in,
      required: param.required,
      description: param.description,
      schema: {
        type: param.type,
        enum: param.enum
      },
      example: param.example
    }));
  }

  /**
   * 转换请求体格式
   */
  private convertRequestBody(requestBody: ApiRequestBody): any {
    return {
      description: requestBody.description,
      content: {
        [requestBody.contentType]: {
          schema: requestBody.schema,
          example: requestBody.example
        }
      }
    };
  }

  /**
   * 转换响应格式
   */
  private convertResponses(responses: ApiResponse[]): any {
    const converted: any = {};
    
    for (const response of responses) {
      converted[response.statusCode] = {
        description: response.description,
        content: response.schema ? {
          'application/json': {
            schema: response.schema,
            example: response.example
          }
        } : undefined
      };
    }
    
    return converted;
  }

  /**
   * 注册标准数据模式
   */
  private registerStandardSchemas(): void {
    // 标准响应格式
    this.registerSchema('StandardResponse', {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object' },
        error: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'object' }
          }
        },
        meta: {
          type: 'object',
          properties: {
            timestamp: { type: 'string', format: 'date-time' },
            requestId: { type: 'string' },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                hasNext: { type: 'boolean' }
              }
            }
          }
        }
      },
      required: ['success']
    });

    // 错误响应格式
    this.registerSchema('ErrorResponse', {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [false] },
        error: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'object' }
          },
          required: ['code', 'message']
        },
        meta: {
          type: 'object',
          properties: {
            timestamp: { type: 'string', format: 'date-time' },
            requestId: { type: 'string' }
          }
        }
      },
      required: ['success', 'error']
    });

    // 分页响应格式
    this.registerSchema('PaginatedResponse', {
      allOf: [
        { $ref: '#/components/schemas/StandardResponse' },
        {
          type: 'object',
          properties: {
            meta: {
              type: 'object',
              properties: {
                pagination: {
                  type: 'object',
                  properties: {
                    page: { type: 'integer', minimum: 1 },
                    limit: { type: 'integer', minimum: 1, maximum: 100 },
                    total: { type: 'integer', minimum: 0 },
                    hasNext: { type: 'boolean' }
                  },
                  required: ['page', 'limit', 'total', 'hasNext']
                }
              }
            }
          }
        }
      ]
    });
  }

  /**
   * 生成API文档HTML页面
   */
  generateDocumentationHtml(): string {
    const spec = this.generateOpenApiSpec();
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>${this.apiInfo.title} - API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui.css" />
    <style>
        html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
        *, *:before, *:after { box-sizing: inherit; }
        body { margin:0; background: #fafafa; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui-bundle.js"></script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                url: '/api/v1/docs/openapi.json',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIBundle.presets.standalone
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout"
            });
        };
    </script>
</body>
</html>
    `;
  }

  /**
   * 创建文档路由
   */
  createDocumentationRoutes(): Router {
    const router = Router();

    // OpenAPI JSON规范
    router.get('/openapi.json', (req: Request, res: Response) => {
      const spec = this.generateOpenApiSpec();
      res.json(spec);
    });

    // API文档HTML页面
    router.get('/', (req: Request, res: Response) => {
      const html = this.generateDocumentationHtml();
      res.type('html').send(html);
    });

    // API端点列表
    router.get('/endpoints', (req: Request, res: Response) => {
      const endpoints = Array.from(this.endpoints.values()).map(endpoint => ({
        path: endpoint.path,
        method: endpoint.method,
        summary: endpoint.summary,
        tags: endpoint.tags
      }));
      
      res.json({
        success: true,
        data: {
          total: endpoints.length,
          endpoints: endpoints.sort((a, b) => a.path.localeCompare(b.path))
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
    });

    // API统计信息
    router.get('/stats', (req: Request, res: Response) => {
      const stats = this.generateApiStats();
      
      res.json({
        success: true,
        data: stats,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
    });

    return router;
  }

  /**
   * 生成API统计信息
   */
  private generateApiStats(): any {
    const endpoints = Array.from(this.endpoints.values());
    const methods = endpoints.reduce((acc, endpoint) => {
      acc[endpoint.method] = (acc[endpoint.method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const tags = endpoints.reduce((acc, endpoint) => {
      if (endpoint.tags) {
        endpoint.tags.forEach(tag => {
          acc[tag] = (acc[tag] || 0) + 1;
        });
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      totalEndpoints: endpoints.length,
      methodDistribution: methods,
      tagDistribution: tags,
      authenticationRequired: endpoints.filter(e => e.authentication).length,
      publicEndpoints: endpoints.filter(e => !e.authentication).length,
      averageParametersPerEndpoint: endpoints.reduce((sum, e) => sum + (e.parameters?.length || 0), 0) / endpoints.length
    };
  }
}

// 全局文档生成器实例
export const apiDocGenerator = new ApiDocumentationGenerator();

/**
 * 响应格式化工具类
 */
export class ResponseFormatter {
  /**
   * 格式化成功响应
   */
  static success<T>(
    data: T,
    message?: string,
    meta?: any
  ): StandardApiResponse<T> {
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta
      }
    };
  }

  /**
   * 格式化错误响应
   */
  static error(
    code: string,
    message: string,
    details?: any,
    meta?: any
  ): StandardApiResponse<never> {
    return {
      success: false,
      error: {
        code,
        message,
        details
      },
      meta: {
        timestamp: new Date().toISOString(),
        ...meta
      }
    };
  }

  /**
   * 格式化分页响应
   */
  static paginated<T>(
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
    },
    meta?: any
  ): StandardApiResponse<T[]> {
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        pagination: {
          ...pagination,
          hasNext: pagination.page * pagination.limit < pagination.total
        },
        ...meta
      }
    };
  }
}

/**
 * API版本管理工具
 */
export class ApiVersionManager {
  private versions = new Map<string, {
    supportedUntil?: Date;
    deprecated?: boolean;
    replacement?: string;
  }>();

  /**
   * 注册API版本
   */
  registerVersion(
    version: string,
    config: {
      supportedUntil?: Date;
      deprecated?: boolean;
      replacement?: string;
    }
  ): void {
    this.versions.set(version, config);
  }

  /**
   * 检查版本状态
   */
  checkVersion(version: string): {
    isSupported: boolean;
    isDeprecated: boolean;
    message?: string;
  } {
    const config = this.versions.get(version);
    
    if (!config) {
      return {
        isSupported: false,
        isDeprecated: false,
        message: `API version ${version} is not supported`
      };
    }

    const now = new Date();
    const isExpired = config.supportedUntil && now > config.supportedUntil;
    
    if (isExpired) {
      return {
        isSupported: false,
        isDeprecated: true,
        message: `API version ${version} is no longer supported. ${config.replacement ? `Please use ${config.replacement}` : ''}`
      };
    }

    if (config.deprecated) {
      return {
        isSupported: true,
        isDeprecated: true,
        message: `API version ${version} is deprecated. ${config.replacement ? `Please migrate to ${config.replacement}` : ''}`
      };
    }

    return {
      isSupported: true,
      isDeprecated: false
    };
  }

  /**
   * 创建版本验证中间件
   */
  createVersionMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const version = req.params.version || (Array.isArray(req.headers['api-version']) ? req.headers['api-version'][0] : req.headers['api-version']) || 'v1';
      const versionCheck = this.checkVersion(version);
      
      if (!versionCheck.isSupported) {
        return res.status(400).json(
          ResponseFormatter.error(
            'UNSUPPORTED_API_VERSION',
            versionCheck.message || 'API version not supported'
          )
        );
      }

      if (versionCheck.isDeprecated) {
        res.set('Warning', `299 - "API version ${version} is deprecated. ${versionCheck.message}"`);
      }

      next();
    };
  }
}

// 全局版本管理器实例
export const apiVersionManager = new ApiVersionManager();

// 注册支持的API版本
apiVersionManager.registerVersion('v1', {
  deprecated: false
});

// 导出响应格式化工具
export { ResponseFormatter as formatResponse };