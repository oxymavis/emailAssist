/**
 * 报告生成引擎服务
 * 负责数据收集、分析、报告生成和文件导出
 */

import { Pool } from 'pg';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import DatabaseManager from '@/config/database';
import RedisManager from '@/config/redis';
import {
  Report,
  ReportData,
  ReportType,
  ReportFormat,
  ReportStatus,
  DateRange,
  ReportParameters,
  ReportStatistics,
  EmailFilter,
  ChartConfig,
  LayoutConfig
} from '../models/Report';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class ReportGenerationService {
  private db: Pool;
  private redis: typeof RedisManager;
  private reportsDir: string;

  constructor(db: Pool, redis: typeof RedisManager) {
    this.db = db;
    this.redis = redis;
    this.reportsDir = path.join(process.cwd(), 'storage', 'reports');
    this.ensureReportsDirectory();
  }

  /**
   * 确保报告存储目录存在
   */
  private ensureReportsDirectory(): void {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * 生成报告
   */
  async generateReport(reportId: string): Promise<void> {
    const startTime = Date.now();
    logger.info(`开始生成报告: ${reportId}`);

    try {
      // 更新报告状态为生成中
      await this.updateReportStatus(reportId, ReportStatus.GENERATING);

      // 获取报告配置
      const reportConfig = await this.getReportConfig(reportId);
      if (!reportConfig) {
        throw new Error(`报告配置未找到: ${reportId}`);
      }

      // 收集报告数据
      const reportData = await this.collectReportData(reportConfig);

      // 生成各种格式的报告文件
      const filePaths: string[] = [];
      let totalFileSize = 0;

      for (const format of reportConfig.format) {
        const filePath = await this.generateReportFile(reportConfig, reportData, format);
        filePaths.push(filePath);
        
        const stats = fs.statSync(filePath);
        totalFileSize += stats.size;
      }

      // 计算统计信息
      const statistics: ReportStatistics = {
        total_emails: reportData.summary.total_emails,
        processed_emails: reportData.detailed_stats.by_sender.reduce((sum, item) => sum + item.count, 0),
        generation_time_ms: Date.now() - startTime,
        file_size_bytes: totalFileSize,
        chart_count: this.countCharts(reportData),
        table_count: this.countTables(reportData),
        error_count: 0
      };

      // 更新报告状态为完成
      await this.updateReportCompletion(reportId, filePaths, totalFileSize, statistics);

      logger.info(`报告生成完成: ${reportId}, 耗时: ${statistics.generation_time_ms}ms`);

    } catch (error) {
      logger.error(`报告生成失败: ${reportId}`, error);
      await this.updateReportStatus(reportId, ReportStatus.FAILED, error.message);
      throw error;
    }
  }

  /**
   * 收集报告数据
   */
  private async collectReportData(reportConfig: Report): Promise<ReportData> {
    logger.info(`收集报告数据: ${reportConfig.title}`);

    // 基于报告类型和参数收集数据
    const emailData = await this.getEmailData(reportConfig.date_range, reportConfig.parameters);
    const aiAnalysisData = await this.getAIAnalysisData(reportConfig.date_range, reportConfig.parameters);
    const rulePerformanceData = await this.getRulePerformanceData(reportConfig.date_range, reportConfig.parameters);

    // 组装报告数据
    const reportData: ReportData = {
      metadata: {
        title: reportConfig.title,
        description: reportConfig.description,
        generated_at: new Date(),
        date_range: reportConfig.date_range,
        total_records: emailData.total_count,
        filters_applied: reportConfig.parameters.email_filters || []
      },
      summary: await this.calculateSummaryStats(emailData),
      detailed_stats: await this.calculateDetailedStats(emailData),
      ai_insights: await this.calculateAIInsights(aiAnalysisData),
      rule_performance: await this.calculateRulePerformance(rulePerformanceData),
      recommendations: await this.generateRecommendations(emailData, aiAnalysisData)
    };

    return reportData;
  }

  /**
   * 获取邮件数据
   */
  private async getEmailData(dateRange: DateRange, parameters: ReportParameters): Promise<any> {
    let query = `
      SELECT 
        m.*,
        a.sentiment_score,
        a.priority_score,
        a.category,
        a.urgency_level
      FROM messages m
      LEFT JOIN ai_analysis a ON m.id = a.message_id
      WHERE m.received_date >= $1 AND m.received_date <= $2
    `;
    
    const queryParams = [dateRange.start_date, dateRange.end_date];
    let paramIndex = 3;

    // 应用邮件过滤器
    if (parameters.email_filters && parameters.email_filters.length > 0) {
      const filterConditions = parameters.email_filters.map(filter => {
        queryParams.push(filter.value);
        return `${filter.field} ${this.getOperatorSQL(filter.operator)} $${paramIndex++}`;
      });
      query += ` AND (${filterConditions.join(' AND ')})`;
    }

    query += ` ORDER BY m.received_date DESC`;

    const result = await this.db.query(query, queryParams);
    
    return {
      total_count: result.rows.length,
      emails: result.rows
    };
  }

  /**
   * 获取AI分析数据
   */
  private async getAIAnalysisData(dateRange: DateRange, parameters: ReportParameters): Promise<any> {
    const query = `
      SELECT 
        a.*,
        m.subject,
        m.sender_email,
        m.received_date
      FROM ai_analysis a
      JOIN messages m ON a.message_id = m.id
      WHERE m.received_date >= $1 AND m.received_date <= $2
      ORDER BY a.created_at DESC
    `;

    const result = await this.db.query(query, [dateRange.start_date, dateRange.end_date]);
    return result.rows;
  }

  /**
   * 获取规则性能数据
   */
  private async getRulePerformanceData(dateRange: DateRange, parameters: ReportParameters): Promise<any> {
    const query = `
      SELECT 
        r.name as rule_name,
        COUNT(rel.id) as execution_count,
        SUM(CASE WHEN rel.success THEN 1 ELSE 0 END) as success_count,
        AVG(rel.execution_time_ms) as avg_execution_time
      FROM filter_rules r
      LEFT JOIN rule_execution_logs rel ON r.id = rel.rule_id 
        AND rel.created_at >= $1 AND rel.created_at <= $2
      WHERE r.is_active = true
      GROUP BY r.id, r.name
      ORDER BY execution_count DESC
    `;

    const result = await this.db.query(query, [dateRange.start_date, dateRange.end_date]);
    return result.rows;
  }

  /**
   * 计算摘要统计
   */
  private async calculateSummaryStats(emailData: any): Promise<any> {
    const emails = emailData.emails;
    
    return {
      total_emails: emails.length,
      unread_emails: emails.filter(e => !e.is_read).length,
      high_priority: emails.filter(e => e.priority_score && e.priority_score > 0.7).length,
      medium_priority: emails.filter(e => e.priority_score && e.priority_score > 0.4 && e.priority_score <= 0.7).length,
      low_priority: emails.filter(e => e.priority_score && e.priority_score <= 0.4).length,
      avg_response_time: this.calculateAverageResponseTime(emails),
      total_attachments: emails.reduce((sum, e) => sum + (e.attachment_count || 0), 0)
    };
  }

  /**
   * 计算详细统计
   */
  private async calculateDetailedStats(emailData: any): Promise<any> {
    const emails = emailData.emails;

    return {
      by_sender: this.groupBySender(emails),
      by_subject_keywords: await this.extractSubjectKeywords(emails),
      by_time_distribution: this.groupByHourDistribution(emails),
      by_day_of_week: this.groupByDayOfWeek(emails),
      by_priority: this.groupByPriority(emails),
      by_category: this.groupByCategory(emails)
    };
  }

  /**
   * 计算AI洞察
   */
  private async calculateAIInsights(aiData: any[]): Promise<any> {
    return {
      sentiment_distribution: this.calculateSentimentDistribution(aiData),
      top_topics: await this.extractTopTopics(aiData),
      urgency_analysis: this.analyzeUrgency(aiData),
      anomalies: await this.detectAnomalies(aiData)
    };
  }

  /**
   * 计算规则性能
   */
  private async calculateRulePerformance(ruleData: any[]): Promise<any> {
    const totalRules = await this.getTotalRulesCount();
    const activeRules = await this.getActiveRulesCount();

    return {
      total_rules: totalRules,
      active_rules: activeRules,
      rules_triggered: ruleData.map(rule => ({
        rule_name: rule.rule_name,
        count: parseInt(rule.execution_count),
        success_rate: rule.execution_count > 0 ? 
          (parseInt(rule.success_count) / parseInt(rule.execution_count)) * 100 : 0
      })),
      processing_efficiency: {
        avg_time: ruleData.reduce((sum, r) => sum + (parseFloat(r.avg_execution_time) || 0), 0) / ruleData.length || 0,
        success_rate: ruleData.reduce((sum, r) => sum + (r.execution_count > 0 ? 
          (parseInt(r.success_count) / parseInt(r.execution_count)) * 100 : 0), 0) / ruleData.length || 0
      }
    };
  }

  /**
   * 生成推荐
   */
  private async generateRecommendations(emailData: any, aiData: any[]): Promise<any[]> {
    const recommendations = [];

    // 基于邮件量和响应时间的推荐
    if (emailData.emails.length > 100) {
      recommendations.push({
        type: 'automation',
        title: '考虑增加自动化规则',
        description: '检测到大量邮件处理，建议创建更多自动化规则来提高效率',
        priority: 'medium',
        estimated_impact: '可减少30%的手动处理时间'
      });
    }

    // 基于优先级分布的推荐
    const highPriorityRatio = emailData.emails.filter(e => e.priority_score > 0.7).length / emailData.emails.length;
    if (highPriorityRatio > 0.3) {
      recommendations.push({
        type: 'priority',
        title: '优化优先级判断规则',
        description: '高优先级邮件占比较高，建议调整AI分析参数',
        priority: 'high',
        estimated_impact: '提高20%的邮件处理准确率'
      });
    }

    // 基于情感分析的推荐
    const negativeSentiment = aiData.filter(a => a.sentiment_score < -0.5).length;
    if (negativeSentiment > aiData.length * 0.2) {
      recommendations.push({
        type: 'response',
        title: '关注负面情感邮件',
        description: '检测到较多负面情感邮件，建议优先处理',
        priority: 'high',
        estimated_impact: '改善客户满意度'
      });
    }

    return recommendations;
  }

  /**
   * 生成报告文件
   */
  private async generateReportFile(
    reportConfig: Report, 
    reportData: ReportData, 
    format: ReportFormat
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${reportConfig.title.replace(/[^\w\s]/gi, '')}_${timestamp}`;

    switch (format) {
      case ReportFormat.PDF:
        return await this.generatePDFReport(filename, reportData);
      case ReportFormat.EXCEL:
        return await this.generateExcelReport(filename, reportData);
      case ReportFormat.JSON:
        return await this.generateJSONReport(filename, reportData);
      case ReportFormat.CSV:
        return await this.generateCSVReport(filename, reportData);
      default:
        throw new Error(`不支持的报告格式: ${format}`);
    }
  }

  /**
   * 生成PDF报告
   */
  private async generatePDFReport(filename: string, data: ReportData): Promise<string> {
    const filePath = path.join(this.reportsDir, `${filename}.pdf`);
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // 标题页
    doc.fontSize(24).text(data.metadata.title, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`生成时间: ${data.metadata.generated_at.toLocaleString()}`);
    doc.text(`数据范围: ${data.metadata.date_range.start_date.toLocaleDateString()} - ${data.metadata.date_range.end_date.toLocaleDateString()}`);
    doc.text(`总记录数: ${data.metadata.total_records}`);
    doc.addPage();

    // 概要统计
    doc.fontSize(18).text('概要统计', { underline: true });
    doc.moveDown();
    doc.fontSize(12);
    doc.text(`总邮件数: ${data.summary.total_emails}`);
    doc.text(`未读邮件: ${data.summary.unread_emails}`);
    doc.text(`高优先级: ${data.summary.high_priority}`);
    doc.text(`中优先级: ${data.summary.medium_priority}`);
    doc.text(`低优先级: ${data.summary.low_priority}`);
    doc.text(`平均响应时间: ${data.summary.avg_response_time.toFixed(2)} 小时`);
    doc.addPage();

    // AI洞察
    doc.fontSize(18).text('AI分析洞察', { underline: true });
    doc.moveDown();
    doc.fontSize(12);
    doc.text('情感分布:');
    doc.text(`  正面: ${data.ai_insights.sentiment_distribution.positive}`);
    doc.text(`  中性: ${data.ai_insights.sentiment_distribution.neutral}`);
    doc.text(`  负面: ${data.ai_insights.sentiment_distribution.negative}`);
    doc.moveDown();

    doc.text('热门话题:');
    data.ai_insights.top_topics.slice(0, 5).forEach(topic => {
      doc.text(`  ${topic.topic}: ${topic.frequency} 次 (情感: ${topic.sentiment.toFixed(2)})`);
    });
    doc.addPage();

    // 规则性能
    doc.fontSize(18).text('规则执行性能', { underline: true });
    doc.moveDown();
    doc.fontSize(12);
    doc.text(`总规则数: ${data.rule_performance.total_rules}`);
    doc.text(`活跃规则: ${data.rule_performance.active_rules}`);
    doc.text(`平均执行时间: ${data.rule_performance.processing_efficiency.avg_time.toFixed(2)} ms`);
    doc.text(`成功率: ${data.rule_performance.processing_efficiency.success_rate.toFixed(2)}%`);
    doc.moveDown();

    // 推荐
    if (data.recommendations.length > 0) {
      doc.addPage();
      doc.fontSize(18).text('优化建议', { underline: true });
      doc.moveDown();
      doc.fontSize(12);
      data.recommendations.forEach((rec, index) => {
        doc.text(`${index + 1}. ${rec.title} (${rec.priority})`);
        doc.text(`   ${rec.description}`);
        doc.text(`   预期影响: ${rec.estimated_impact}`);
        doc.moveDown();
      });
    }

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve(filePath));
      stream.on('error', reject);
    });
  }

  /**
   * 生成Excel报告
   */
  private async generateExcelReport(filename: string, data: ReportData): Promise<string> {
    const filePath = path.join(this.reportsDir, `${filename}.xlsx`);
    const workbook = new ExcelJS.Workbook();

    // 概要统计表
    const summarySheet = workbook.addWorksheet('概要统计');
    summarySheet.addRow(['报告标题', data.metadata.title]);
    summarySheet.addRow(['生成时间', data.metadata.generated_at]);
    summarySheet.addRow(['数据范围', `${data.metadata.date_range.start_date.toLocaleDateString()} - ${data.metadata.date_range.end_date.toLocaleDateString()}`]);
    summarySheet.addRow([]);
    summarySheet.addRow(['指标', '数值']);
    summarySheet.addRow(['总邮件数', data.summary.total_emails]);
    summarySheet.addRow(['未读邮件', data.summary.unread_emails]);
    summarySheet.addRow(['高优先级', data.summary.high_priority]);
    summarySheet.addRow(['中优先级', data.summary.medium_priority]);
    summarySheet.addRow(['低优先级', data.summary.low_priority]);
    summarySheet.addRow(['平均响应时间(小时)', data.summary.avg_response_time]);
    summarySheet.addRow(['附件总数', data.summary.total_attachments]);

    // 发件人统计表
    const senderSheet = workbook.addWorksheet('发件人统计');
    senderSheet.addRow(['发件人', '邮件数量', '平均响应时间']);
    data.detailed_stats.by_sender.forEach(sender => {
      senderSheet.addRow([sender.sender, sender.count, sender.avg_response]);
    });

    // 时间分布表
    const timeSheet = workbook.addWorksheet('时间分布');
    timeSheet.addRow(['小时', '邮件数量']);
    data.detailed_stats.by_time_distribution.forEach(hour => {
      timeSheet.addRow([hour.hour, hour.count]);
    });

    // 规则性能表
    const ruleSheet = workbook.addWorksheet('规则性能');
    ruleSheet.addRow(['规则名称', '执行次数', '成功率(%)']);
    data.rule_performance.rules_triggered.forEach(rule => {
      ruleSheet.addRow([rule.rule_name, rule.count, rule.success_rate]);
    });

    // AI洞察表
    const aiSheet = workbook.addWorksheet('AI洞察');
    aiSheet.addRow(['话题', '频次', '情感分值']);
    data.ai_insights.top_topics.forEach(topic => {
      aiSheet.addRow([topic.topic, topic.frequency, topic.sentiment]);
    });

    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }

  /**
   * 生成JSON报告
   */
  private async generateJSONReport(filename: string, data: ReportData): Promise<string> {
    const filePath = path.join(this.reportsDir, `${filename}.json`);
    const jsonContent = JSON.stringify(data, null, 2);
    
    await promisify(fs.writeFile)(filePath, jsonContent, 'utf8');
    return filePath;
  }

  /**
   * 生成CSV报告
   */
  private async generateCSVReport(filename: string, data: ReportData): Promise<string> {
    const filePath = path.join(this.reportsDir, `${filename}.csv`);
    
    // 创建CSV内容（简化版，主要包含关键统计数据）
    const csvRows = [];
    csvRows.push(['类别', '项目', '数值', '备注']);
    
    // 基本统计
    csvRows.push(['基本统计', '总邮件数', data.summary.total_emails, '']);
    csvRows.push(['基本统计', '未读邮件', data.summary.unread_emails, '']);
    csvRows.push(['基本统计', '高优先级', data.summary.high_priority, '']);
    csvRows.push(['基本统计', '平均响应时间', data.summary.avg_response_time, '小时']);
    
    // 发件人统计
    data.detailed_stats.by_sender.slice(0, 10).forEach(sender => {
      csvRows.push(['发件人统计', sender.sender, sender.count, `响应时间: ${sender.avg_response.toFixed(2)}h`]);
    });

    // 规则性能
    data.rule_performance.rules_triggered.slice(0, 10).forEach(rule => {
      csvRows.push(['规则性能', rule.rule_name, rule.count, `成功率: ${rule.success_rate.toFixed(2)}%`]);
    });

    const csvContent = csvRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    await promisify(fs.writeFile)(filePath, csvContent, 'utf8');
    return filePath;
  }

  // 辅助方法
  private getOperatorSQL(operator: string): string {
    const operators = {
      'equals': '=',
      'not_equals': '!=',
      'contains': 'ILIKE',
      'not_contains': 'NOT ILIKE',
      'starts_with': 'ILIKE',
      'ends_with': 'ILIKE',
      'gt': '>',
      'gte': '>=',
      'lt': '<',
      'lte': '<=',
      'regex': '~*'
    };
    
    return operators[operator] || '=';
  }

  private calculateAverageResponseTime(emails: any[]): number {
    // 简化实现，实际需要根据邮件回复链计算
    return emails.reduce((sum, email) => {
      const responseTime = email.response_time_hours || 0;
      return sum + responseTime;
    }, 0) / emails.length || 0;
  }

  private groupBySender(emails: any[]): Array<{ sender: string; count: number; avg_response: number }> {
    const senderMap = new Map();
    
    emails.forEach(email => {
      const sender = email.sender_email;
      if (!senderMap.has(sender)) {
        senderMap.set(sender, { count: 0, totalResponse: 0 });
      }
      const data = senderMap.get(sender);
      data.count++;
      data.totalResponse += email.response_time_hours || 0;
    });

    return Array.from(senderMap.entries()).map(([sender, data]) => ({
      sender,
      count: data.count,
      avg_response: data.totalResponse / data.count || 0
    })).sort((a, b) => b.count - a.count);
  }

  private async extractSubjectKeywords(emails: any[]): Promise<Array<{ keyword: string; count: number; sentiment: number }>> {
    const keywordMap = new Map();
    
    emails.forEach(email => {
      if (email.subject) {
        // 简单的关键词提取（实际应使用NLP库）
        const words = email.subject.toLowerCase().match(/\b\w+\b/g) || [];
        words.filter(word => word.length > 3).forEach(word => {
          if (!keywordMap.has(word)) {
            keywordMap.set(word, { count: 0, totalSentiment: 0 });
          }
          const data = keywordMap.get(word);
          data.count++;
          data.totalSentiment += email.sentiment_score || 0;
        });
      }
    });

    return Array.from(keywordMap.entries())
      .map(([keyword, data]) => ({
        keyword,
        count: data.count,
        sentiment: data.totalSentiment / data.count || 0
      }))
      .filter(item => item.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }

  private groupByHourDistribution(emails: any[]): Array<{ hour: number; count: number }> {
    const hourMap = new Map();
    
    emails.forEach(email => {
      const hour = new Date(email.received_date).getHours();
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
    });

    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: hourMap.get(hour) || 0
    }));
  }

  private groupByDayOfWeek(emails: any[]): Array<{ day: string; count: number }> {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayMap = new Map();
    
    emails.forEach(email => {
      const day = new Date(email.received_date).getDay();
      dayMap.set(day, (dayMap.get(day) || 0) + 1);
    });

    return days.map((dayName, index) => ({
      day: dayName,
      count: dayMap.get(index) || 0
    }));
  }

  private groupByPriority(emails: any[]): Array<{ priority: string; count: number; percentage: number }> {
    const total = emails.length;
    const high = emails.filter(e => e.priority_score > 0.7).length;
    const medium = emails.filter(e => e.priority_score > 0.4 && e.priority_score <= 0.7).length;
    const low = emails.filter(e => e.priority_score <= 0.4).length;

    return [
      { priority: 'High', count: high, percentage: (high / total) * 100 },
      { priority: 'Medium', count: medium, percentage: (medium / total) * 100 },
      { priority: 'Low', count: low, percentage: (low / total) * 100 }
    ];
  }

  private groupByCategory(emails: any[]): Array<{ category: string; count: number; percentage: number }> {
    const categoryMap = new Map();
    emails.forEach(email => {
      const category = email.category || 'Unknown';
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    });

    const total = emails.length;
    return Array.from(categoryMap.entries()).map(([category, count]) => ({
      category,
      count,
      percentage: (count / total) * 100
    })).sort((a, b) => b.count - a.count);
  }

  private calculateSentimentDistribution(aiData: any[]): { positive: number; neutral: number; negative: number } {
    const positive = aiData.filter(a => a.sentiment_score > 0.1).length;
    const negative = aiData.filter(a => a.sentiment_score < -0.1).length;
    const neutral = aiData.length - positive - negative;

    return { positive, neutral, negative };
  }

  private async extractTopTopics(aiData: any[]): Promise<Array<{ topic: string; frequency: number; sentiment: number }>> {
    const topicMap = new Map();
    
    aiData.forEach(analysis => {
      if (analysis.extracted_keywords) {
        const keywords = JSON.parse(analysis.extracted_keywords || '[]');
        keywords.forEach(keyword => {
          if (!topicMap.has(keyword)) {
            topicMap.set(keyword, { frequency: 0, totalSentiment: 0 });
          }
          const data = topicMap.get(keyword);
          data.frequency++;
          data.totalSentiment += analysis.sentiment_score || 0;
        });
      }
    });

    return Array.from(topicMap.entries())
      .map(([topic, data]) => ({
        topic,
        frequency: data.frequency,
        sentiment: data.totalSentiment / data.frequency || 0
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
  }

  private analyzeUrgency(aiData: any[]): Array<{ level: string; count: number; avg_response: number }> {
    const urgencyMap = new Map();
    
    aiData.forEach(analysis => {
      const level = analysis.urgency_level || 'normal';
      if (!urgencyMap.has(level)) {
        urgencyMap.set(level, { count: 0, totalResponse: 0 });
      }
      const data = urgencyMap.get(level);
      data.count++;
      data.totalResponse += analysis.estimated_response_time || 0;
    });

    return Array.from(urgencyMap.entries()).map(([level, data]) => ({
      level,
      count: data.count,
      avg_response: data.totalResponse / data.count || 0
    }));
  }

  private async detectAnomalies(aiData: any[]): Promise<Array<{ type: string; description: string; impact: string }>> {
    const anomalies = [];

    // 检测异常高的负面情感
    const negativeCount = aiData.filter(a => a.sentiment_score < -0.5).length;
    const negativeRatio = negativeCount / aiData.length;
    
    if (negativeRatio > 0.3) {
      anomalies.push({
        type: 'sentiment',
        description: '检测到异常高的负面情感邮件比例',
        impact: '可能影响客户满意度和响应效率'
      });
    }

    // 检测异常的优先级分布
    const highPriorityCount = aiData.filter(a => a.priority_score > 0.8).length;
    const highPriorityRatio = highPriorityCount / aiData.length;
    
    if (highPriorityRatio > 0.4) {
      anomalies.push({
        type: 'priority',
        description: '高优先级邮件比例异常偏高',
        impact: '可能需要调整优先级判断算法'
      });
    }

    return anomalies;
  }

  private countCharts(data: ReportData): number {
    // 基于数据内容计算潜在的图表数量
    return 5; // 固定返回5个图表（时间分布、优先级分布、发件人分布、情感分布、规则性能）
  }

  private countTables(data: ReportData): number {
    // 基于数据内容计算表格数量
    return 4; // 固定返回4个表格（发件人统计、关键词、规则性能、AI洞察）
  }

  private async getTotalRulesCount(): Promise<number> {
    const result = await this.db.query('SELECT COUNT(*) as count FROM filter_rules WHERE deleted_at IS NULL');
    return parseInt(result.rows[0].count);
  }

  private async getActiveRulesCount(): Promise<number> {
    const result = await this.db.query('SELECT COUNT(*) as count FROM filter_rules WHERE is_active = true AND deleted_at IS NULL');
    return parseInt(result.rows[0].count);
  }

  private async getReportConfig(reportId: string): Promise<Report | null> {
    const result = await this.db.query('SELECT * FROM reports WHERE id = $1', [reportId]);
    return result.rows[0] || null;
  }

  private async updateReportStatus(reportId: string, status: ReportStatus, errorMessage?: string): Promise<void> {
    const updateData = { status, updated_at: new Date() };
    if (errorMessage) {
      updateData['error_message'] = errorMessage;
    }

    const setClause = Object.keys(updateData).map((key, index) => `${key} = $${index + 2}`).join(', ');
    const values = [reportId, ...Object.values(updateData)];

    await this.db.query(`UPDATE reports SET ${setClause} WHERE id = $1`, values);
  }

  private async updateReportCompletion(
    reportId: string, 
    filePaths: string[], 
    fileSize: number, 
    statistics: ReportStatistics
  ): Promise<void> {
    await this.db.query(`
      UPDATE reports SET 
        status = $2,
        file_paths = $3,
        file_size = $4,
        generated_at = $5,
        statistics = $6,
        updated_at = $7
      WHERE id = $1
    `, [
      reportId,
      ReportStatus.COMPLETED,
      JSON.stringify(filePaths),
      fileSize,
      new Date(),
      JSON.stringify(statistics),
      new Date()
    ]);
  }
}