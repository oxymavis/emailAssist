/**
 * API Testing Utilities
 * API端点测试和验证工具
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import logger from './logger';

/**
 * API测试结果接口
 */
export interface ApiTestResult {
  endpoint: string;
  method: string;
  status: 'pass' | 'fail' | 'skip';
  responseTime: number;
  statusCode?: number;
  error?: string;
  response?: any;
}

/**
 * 测试套件接口
 */
export interface TestSuite {
  name: string;
  description: string;
  tests: ApiTest[];
}

/**
 * API测试接口
 */
export interface ApiTest {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  headers?: Record<string, string>;
  body?: any;
  queryParams?: Record<string, any>;
  expectedStatus?: number;
  expectedResponse?: any;
  timeout?: number;
  skip?: boolean;
  skipReason?: string;
}

/**
 * API测试客户端
 */
export class ApiTestClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private authToken?: string;

  constructor(baseUrl: string, timeout: number = 10000) {
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: baseUrl,
      timeout,
      validateStatus: () => true // 接受所有状态码
    });
  }

  /**
   * 设置认证令牌
   */
  setAuthToken(token: string): void {
    this.authToken = token;
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  /**
   * 执行单个API测试
   */
  async runTest(test: ApiTest): Promise<ApiTestResult> {
    const startTime = Date.now();
    
    try {
      if (test.skip) {
        return {
          endpoint: test.path,
          method: test.method,
          status: 'skip',
          responseTime: 0,
          error: test.skipReason || 'Test skipped'
        };
      }

      // 准备请求配置
      const config: any = {
        method: test.method.toLowerCase(),
        url: test.path,
        headers: { ...test.headers },
        timeout: test.timeout || 10000
      };

      // 添加查询参数
      if (test.queryParams) {
        config.params = test.queryParams;
      }

      // 添加请求体
      if (test.body && ['POST', 'PUT', 'PATCH'].includes(test.method)) {
        config.data = test.body;
      }

      // 执行请求
      const response: AxiosResponse = await this.client.request(config);
      const responseTime = Date.now() - startTime;

      // 验证状态码
      const expectedStatus = test.expectedStatus || 200;
      if (response.status !== expectedStatus) {
        return {
          endpoint: test.path,
          method: test.method,
          status: 'fail',
          responseTime,
          statusCode: response.status,
          error: `Expected status ${expectedStatus}, got ${response.status}`,
          response: response.data
        };
      }

      // 验证响应内容
      if (test.expectedResponse) {
        const validationResult = this.validateResponse(response.data, test.expectedResponse);
        if (!validationResult.valid) {
          return {
            endpoint: test.path,
            method: test.method,
            status: 'fail',
            responseTime,
            statusCode: response.status,
            error: `Response validation failed: ${validationResult.error}`,
            response: response.data
          };
        }
      }

      return {
        endpoint: test.path,
        method: test.method,
        status: 'pass',
        responseTime,
        statusCode: response.status,
        response: response.data
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        endpoint: test.path,
        method: test.method,
        status: 'fail',
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 验证响应内容
   */
  private validateResponse(actual: any, expected: any): { valid: boolean; error?: string } {
    try {
      if (typeof expected === 'object' && expected !== null) {
        for (const key in expected) {
          if (!(key in actual)) {
            return { valid: false, error: `Missing property: ${key}` };
          }
          
          if (typeof expected[key] === 'object') {
            const nestedResult = this.validateResponse(actual[key], expected[key]);
            if (!nestedResult.valid) {
              return nestedResult;
            }
          } else if (actual[key] !== expected[key]) {
            return { 
              valid: false, 
              error: `Property ${key}: expected ${expected[key]}, got ${actual[key]}` 
            };
          }
        }
      } else if (actual !== expected) {
        return { valid: false, error: `Expected ${expected}, got ${actual}` };
      }
      
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * 运行测试套件
   */
  async runTestSuite(suite: TestSuite): Promise<{
    suiteName: string;
    results: ApiTestResult[];
    summary: {
      total: number;
      passed: number;
      failed: number;
      skipped: number;
      passRate: number;
      averageResponseTime: number;
    };
  }> {
    logger.info(`Running test suite: ${suite.name}`);
    
    const results: ApiTestResult[] = [];
    
    for (const test of suite.tests) {
      logger.debug(`Running test: ${test.name}`);
      const result = await this.runTest(test);
      results.push(result);
      
      // 短暂延迟以避免过度负载
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 计算统计信息
    const summary = this.calculateSummary(results);
    
    logger.info(`Test suite completed: ${suite.name}`, summary);
    
    return {
      suiteName: suite.name,
      results,
      summary
    };
  }

  /**
   * 计算测试摘要
   */
  private calculateSummary(results: ApiTestResult[]) {
    const total = results.length;
    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const skipped = results.filter(r => r.status === 'skip').length;
    const passRate = total > 0 ? (passed / total) * 100 : 0;
    const averageResponseTime = results.length > 0 ? 
      results.reduce((sum, r) => sum + r.responseTime, 0) / results.length : 0;

    return {
      total,
      passed,
      failed,
      skipped,
      passRate: Math.round(passRate * 100) / 100,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100
    };
  }
}

/**
 * 预定义的测试套件
 */
export class EmailAssistTestSuites {
  /**
   * 基础健康检查测试
   */
  static getHealthCheckSuite(): TestSuite {
    return {
      name: 'Health Check',
      description: '基础API健康检查测试',
      tests: [
        {
          name: 'API Health Check',
          method: 'GET',
          path: '/health',
          expectedStatus: 200,
          expectedResponse: {
            success: true
          }
        },
        {
          name: 'API Documentation',
          method: 'GET',
          path: '/api/v1/docs/endpoints',
          expectedStatus: 200
        }
      ]
    };
  }

  /**
   * 邮件分析API测试
   */
  static getAnalysisApiSuite(): TestSuite {
    return {
      name: 'Email Analysis API',
      description: '邮件分析功能API测试',
      tests: [
        {
          name: 'Get Analysis Stats',
          method: 'GET',
          path: '/api/v1/analysis/stats',
          expectedStatus: 200,
          expectedResponse: {
            success: true
          }
        },
        {
          name: 'Get Analysis History',
          method: 'GET',
          path: '/api/v1/analysis/history',
          queryParams: {
            page: 1,
            limit: 10
          },
          expectedStatus: 200
        },
        {
          name: 'Get Performance Metrics',
          method: 'GET',
          path: '/api/v1/analysis/performance-metrics',
          queryParams: {
            timeframe: '24h'
          },
          expectedStatus: 200
        },
        {
          name: 'Get Realtime Status',
          method: 'GET',
          path: '/api/v1/analysis/realtime-status',
          expectedStatus: 200
        },
        {
          name: 'Get Queue Status',
          method: 'GET',
          path: '/api/v1/analysis/queue-status',
          expectedStatus: 200
        }
      ]
    };
  }

  /**
   * 规则管理API测试
   */
  static getRulesApiSuite(): TestSuite {
    return {
      name: 'Rules Management API',
      description: '规则管理功能API测试',
      tests: [
        {
          name: 'Get Rules List',
          method: 'GET',
          path: '/api/v1/rules',
          queryParams: {
            page: 1,
            limit: 10
          },
          expectedStatus: 200,
          expectedResponse: {
            success: true
          }
        },
        {
          name: 'Get Rule Templates',
          method: 'GET',
          path: '/api/v1/rules/templates',
          expectedStatus: 200
        },
        {
          name: 'Get Rule Statistics',
          method: 'GET',
          path: '/api/v1/rules/statistics',
          expectedStatus: 200
        },
        {
          name: 'Export Rules',
          method: 'GET',
          path: '/api/v1/rules/export',
          expectedStatus: 200
        },
        {
          name: 'Get Performance Analysis',
          method: 'GET',
          path: '/api/v1/rules/performance-analysis',
          queryParams: {
            timeframe: '7d'
          },
          expectedStatus: 200
        },
        {
          name: 'Get Health Check',
          method: 'GET',
          path: '/api/v1/rules/health-check',
          expectedStatus: 200
        }
      ]
    };
  }

  /**
   * 认证相关测试
   */
  static getAuthenticationSuite(): TestSuite {
    return {
      name: 'Authentication',
      description: '认证和授权测试',
      tests: [
        {
          name: 'Unauthorized Access - Analysis',
          method: 'GET',
          path: '/api/v1/analysis/stats',
          headers: {
            // 不提供Authorization头
          },
          expectedStatus: 401
        },
        {
          name: 'Unauthorized Access - Rules',
          method: 'GET',
          path: '/api/v1/rules',
          expectedStatus: 401
        }
      ]
    };
  }

  /**
   * 错误处理测试
   */
  static getErrorHandlingSuite(): TestSuite {
    return {
      name: 'Error Handling',
      description: '错误处理和验证测试',
      tests: [
        {
          name: 'Invalid Route',
          method: 'GET',
          path: '/api/v1/nonexistent',
          expectedStatus: 404
        },
        {
          name: 'Invalid Method',
          method: 'POST',
          path: '/api/v1/analysis/stats',
          expectedStatus: 405,
          skip: true,
          skipReason: 'Method not allowed check disabled'
        },
        {
          name: 'Invalid Parameters',
          method: 'GET',
          path: '/api/v1/analysis/history',
          queryParams: {
            page: -1,
            limit: 1000
          },
          expectedStatus: 400
        }
      ]
    };
  }

  /**
   * 获取所有测试套件
   */
  static getAllSuites(): TestSuite[] {
    return [
      this.getHealthCheckSuite(),
      this.getAnalysisApiSuite(),
      this.getRulesApiSuite(),
      this.getAuthenticationSuite(),
      this.getErrorHandlingSuite()
    ];
  }
}

/**
 * API测试运行器
 */
export class ApiTestRunner {
  private client: ApiTestClient;

  constructor(baseUrl: string) {
    this.client = new ApiTestClient(baseUrl);
  }

  /**
   * 设置认证信息
   */
  setAuth(token: string): void {
    this.client.setAuthToken(token);
  }

  /**
   * 运行所有测试套件
   */
  async runAllTests(): Promise<{
    overall: {
      suitesRun: number;
      totalTests: number;
      totalPassed: number;
      totalFailed: number;
      totalSkipped: number;
      overallPassRate: number;
    };
    suiteResults: any[];
  }> {
    const suites = EmailAssistTestSuites.getAllSuites();
    const suiteResults = [];
    
    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    for (const suite of suites) {
      const result = await this.client.runTestSuite(suite);
      suiteResults.push(result);
      
      totalTests += result.summary.total;
      totalPassed += result.summary.passed;
      totalFailed += result.summary.failed;
      totalSkipped += result.summary.skipped;
    }

    const overallPassRate = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;

    return {
      overall: {
        suitesRun: suites.length,
        totalTests,
        totalPassed,
        totalFailed,
        totalSkipped,
        overallPassRate: Math.round(overallPassRate * 100) / 100
      },
      suiteResults
    };
  }

  /**
   * 生成测试报告
   */
  generateReport(results: any): string {
    const { overall, suiteResults } = results;
    
    let report = `
# API测试报告

## 总体统计
- 测试套件数: ${overall.suitesRun}
- 总测试数: ${overall.totalTests}
- 通过: ${overall.totalPassed}
- 失败: ${overall.totalFailed}
- 跳过: ${overall.totalSkipped}
- 总体通过率: ${overall.overallPassRate}%

## 详细结果

`;

    for (const suiteResult of suiteResults) {
      report += `### ${suiteResult.suiteName}
- 通过: ${suiteResult.summary.passed}/${suiteResult.summary.total}
- 通过率: ${suiteResult.summary.passRate}%
- 平均响应时间: ${suiteResult.summary.averageResponseTime}ms

`;

      // 添加失败的测试详情
      const failedTests = suiteResult.results.filter((r: ApiTestResult) => r.status === 'fail');
      if (failedTests.length > 0) {
        report += `#### 失败的测试:
`;
        for (const test of failedTests) {
          report += `- **${test.method} ${test.endpoint}**: ${test.error}
`;
        }
        report += `
`;
      }
    }

    return report;
  }
}

/**
 * 快速测试工具函数
 */
export async function quickApiTest(baseUrl: string, authToken?: string): Promise<void> {
  const runner = new ApiTestRunner(baseUrl);
  
  if (authToken) {
    runner.setAuth(authToken);
  }

  try {
    logger.info('Starting API tests...');
    const results = await runner.runAllTests();
    
    const report = runner.generateReport(results);
    logger.info('API test completed', results.overall);
    
    console.log(report);
    
    if (results.overall.overallPassRate < 80) {
      logger.warn('API test pass rate is below 80%', {
        passRate: results.overall.overallPassRate,
        failed: results.overall.totalFailed
      });
    }
    
  } catch (error) {
    logger.error('API test failed', { error });
    throw error;
  }
}

// 主要类和函数已在上面定义并导出