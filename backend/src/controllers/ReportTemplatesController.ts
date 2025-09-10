/**
 * 报告模板控制器
 * 处理报告模板的CRUD操作和管理
 */

import { Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { 
  CreateReportTemplateData,
  UpdateReportTemplateData,
  ReportTemplateQuery,
  ReportType
} from '../models/Report';
import { ReportTemplateService } from '../services/ReportTemplateService';
import { AuthRequest } from '../types';
import logger from '../utils/logger';
import { formatResponse } from '../utils/response';

export class ReportTemplatesController {
  private templateService: ReportTemplateService;

  constructor(templateService: ReportTemplateService) {
    this.templateService = templateService;
  }

  /**
   * 获取模板列表
   */
  async getTemplates(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatResponse(errors.array(), '请求参数无效', 400));
        return;
      }

      const query: ReportTemplateQuery = {
        category: req.query.category as string,
        report_type: req.query.report_type as ReportType,
        is_system: req.query.is_system ? req.query.is_system === 'true' : undefined,
        created_by: req.query.created_by as string,
        search: req.query.search as string,
        limit: parseInt(req.query.limit as string) || 20,
        offset: parseInt(req.query.offset as string) || 0
      };

      const result = await this.templateService.getAllTemplates(query);

      res.json(formatResponse({
        templates: result.templates,
        pagination: {
          total: result.total,
          limit: query.limit,
          offset: query.offset,
          hasNext: result.total > (query.offset + query.limit)
        }
      }, '获取模板列表成功', 200));

    } catch (error) {
      logger.error('获取模板列表失败:', error);
      res.status(500).json(formatResponse(null, '获取模板列表失败', 500));
    }
  }

  /**
   * 获取模板详情
   */
  async getTemplateById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatResponse(errors.array(), '请求参数无效', 400));
        return;
      }

      const templateId = req.params.id;
      const template = await this.templateService.getTemplateById(templateId);

      if (!template) {
        res.status(404).json(formatResponse(null, '模板不存在', 404));
        return;
      }

      res.json(formatResponse(template, '获取模板详情成功', 200));

    } catch (error) {
      logger.error(`获取模板详情失败: ${req.params.id}`, error);
      res.status(500).json(formatResponse(null, '获取模板详情失败', 500));
    }
  }

  /**
   * 创建自定义模板
   */
  async createTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatResponse(errors.array(), '请求参数无效', 400));
        return;
      }

      const data: CreateReportTemplateData = {
        name: req.body.name,
        description: req.body.description,
        category: req.body.category,
        report_type: req.body.report_type,
        default_parameters: req.body.default_parameters || {},
        layout_config: req.body.layout_config,
        chart_configs: req.body.chart_configs || []
      };

      // 验证模板配置
      const validationErrors = this.templateService.validateTemplate(data);
      if (validationErrors.length > 0) {
        res.status(400).json(formatResponse(validationErrors, '模板配置无效', 400));
        return;
      }

      const template = await this.templateService.createTemplate(data, req.user!.id);

      res.status(201).json(formatResponse(template, '创建模板成功', 201));

    } catch (error) {
      logger.error('创建模板失败:', error);
      res.status(500).json(formatResponse(null, '创建模板失败', 500));
    }
  }

  /**
   * 更新模板
   */
  async updateTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatResponse(errors.array(), '请求参数无效', 400));
        return;
      }

      const templateId = req.params.id;
      const data: UpdateReportTemplateData = {};

      // 只更新提供的字段
      if (req.body.name !== undefined) data.name = req.body.name;
      if (req.body.description !== undefined) data.description = req.body.description;
      if (req.body.category !== undefined) data.category = req.body.category;
      if (req.body.default_parameters !== undefined) data.default_parameters = req.body.default_parameters;
      if (req.body.layout_config !== undefined) data.layout_config = req.body.layout_config;
      if (req.body.chart_configs !== undefined) data.chart_configs = req.body.chart_configs;

      // 验证模板配置
      const validationErrors = this.templateService.validateTemplate(data);
      if (validationErrors.length > 0) {
        res.status(400).json(formatResponse(validationErrors, '模板配置无效', 400));
        return;
      }

      const template = await this.templateService.updateTemplate(templateId, data, req.user!.id);

      res.json(formatResponse(template, '更新模板成功', 200));

    } catch (error) {
      logger.error(`更新模板失败: ${req.params.id}`, error);
      if (error.message === '系统模板不允许修改' || error.message === '只能修改自己创建的模板') {
        res.status(403).json(formatResponse(null, error.message, 403));
      } else if (error.message === '模板不存在') {
        res.status(404).json(formatResponse(null, error.message, 404));
      } else {
        res.status(500).json(formatResponse(null, '更新模板失败', 500));
      }
    }
  }

  /**
   * 删除模板
   */
  async deleteTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatResponse(errors.array(), '请求参数无效', 400));
        return;
      }

      const templateId = req.params.id;
      await this.templateService.deleteTemplate(templateId, req.user!.id);

      res.json(formatResponse(null, '删除模板成功', 200));

    } catch (error) {
      logger.error(`删除模板失败: ${req.params.id}`, error);
      if (error.message === '系统模板不允许删除' || error.message === '只能删除自己创建的模板') {
        res.status(403).json(formatResponse(null, error.message, 403));
      } else if (error.message === '模板不存在') {
        res.status(404).json(formatResponse(null, error.message, 404));
      } else {
        res.status(500).json(formatResponse(null, '删除模板失败', 500));
      }
    }
  }

  /**
   * 复制模板
   */
  async duplicateTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatResponse(errors.array(), '请求参数无效', 400));
        return;
      }

      const sourceTemplateId = req.params.id;
      const newName = req.body.name;

      const newTemplate = await this.templateService.duplicateTemplate(
        sourceTemplateId, 
        newName, 
        req.user!.id
      );

      res.status(201).json(formatResponse(newTemplate, '复制模板成功', 201));

    } catch (error) {
      logger.error(`复制模板失败: ${req.params.id}`, error);
      if (error.message === '源模板不存在') {
        res.status(404).json(formatResponse(null, error.message, 404));
      } else {
        res.status(500).json(formatResponse(null, '复制模板失败', 500));
      }
    }
  }

  /**
   * 获取模板分类列表
   */
  async getCategories(req: AuthRequest, res: Response): Promise<void> {
    try {
      const categories = await this.templateService.getCategories();

      res.json(formatResponse({ categories }, '获取模板分类成功', 200));

    } catch (error) {
      logger.error('获取模板分类失败:', error);
      res.status(500).json(formatResponse(null, '获取模板分类失败', 500));
    }
  }

  /**
   * 获取使用统计
   */
  async getUsageStatistics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const statistics = await this.templateService.getUsageStatistics();

      res.json(formatResponse(statistics, '获取使用统计成功', 200));

    } catch (error) {
      logger.error('获取使用统计失败:', error);
      res.status(500).json(formatResponse(null, '获取使用统计失败', 500));
    }
  }

  /**
   * 从模板创建报告
   */
  async createReportFromTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatResponse(errors.array(), '请求参数无效', 400));
        return;
      }

      const templateId = req.params.id;
      
      // 验证模板存在
      const template = await this.templateService.getTemplateById(templateId);
      if (!template) {
        res.status(404).json(formatResponse(null, '模板不存在', 404));
        return;
      }

      // 合并模板默认参数和用户提供的参数
      const reportConfig = {
        title: req.body.title || `${template.name} - ${new Date().toLocaleDateString()}`,
        description: req.body.description || template.description,
        report_type: template.report_type,
        date_range: {
          start_date: new Date(req.body.date_range.start_date),
          end_date: new Date(req.body.date_range.end_date),
          timezone: req.body.date_range.timezone || 'Asia/Shanghai'
        },
        format: req.body.format || ['pdf'],
        parameters: {
          ...template.default_parameters,
          ...req.body.parameters
        },
        template_id: templateId
      };

      // 增加模板使用次数
      await this.templateService.incrementUsageCount(templateId);

      res.json(formatResponse({
        report_config: reportConfig,
        template_info: {
          id: template.id,
          name: template.name,
          category: template.category
        }
      }, '基于模板创建报告配置成功', 200));

    } catch (error) {
      logger.error(`从模板创建报告失败: ${req.params.id}`, error);
      res.status(500).json(formatResponse(null, '从模板创建报告失败', 500));
    }
  }
}

// 验证中间件
export const validateGetTemplates = [
  query('category').optional().isLength({ min: 1, max: 50 }),
  query('report_type').optional().isIn(Object.values(ReportType)),
  query('is_system').optional().isBoolean(),
  query('created_by').optional().isUUID(),
  query('search').optional().isLength({ min: 1, max: 100 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
];

export const validateTemplateId = [
  param('id').isUUID().withMessage('模板ID格式无效')
];

export const validateCreateTemplate = [
  body('name').isLength({ min: 1, max: 100 }).withMessage('模板名称长度必须在1-100字符之间'),
  body('description').optional().isLength({ max: 500 }).withMessage('描述不能超过500字符'),
  body('category').isLength({ min: 1, max: 50 }).withMessage('分类不能为空'),
  body('report_type').isIn(Object.values(ReportType)).withMessage('无效的报告类型'),
  body('default_parameters').optional().isObject(),
  body('layout_config').isObject().withMessage('布局配置必须是对象'),
  body('layout_config.page_size').isIn(['A4', 'A3', 'Letter']).withMessage('无效的页面大小'),
  body('layout_config.orientation').isIn(['portrait', 'landscape']).withMessage('无效的页面方向'),
  body('chart_configs').optional().isArray()
];

export const validateUpdateTemplate = [
  body('name').optional().isLength({ min: 1, max: 100 }).withMessage('模板名称长度必须在1-100字符之间'),
  body('description').optional().isLength({ max: 500 }).withMessage('描述不能超过500字符'),
  body('category').optional().isLength({ min: 1, max: 50 }).withMessage('分类不能为空'),
  body('default_parameters').optional().isObject(),
  body('layout_config').optional().isObject(),
  body('chart_configs').optional().isArray()
];

export const validateDuplicateTemplate = [
  body('name').isLength({ min: 1, max: 100 }).withMessage('新模板名称长度必须在1-100字符之间')
];

export const validateCreateReportFromTemplate = [
  body('title').optional().isLength({ min: 1, max: 200 }).withMessage('标题长度必须在1-200字符之间'),
  body('description').optional().isLength({ max: 500 }).withMessage('描述不能超过500字符'),
  body('date_range.start_date').isISO8601().withMessage('开始日期格式无效'),
  body('date_range.end_date').isISO8601().withMessage('结束日期格式无效'),
  body('date_range.timezone').optional().isLength({ min: 1, max: 50 }),
  body('format').optional().isArray({ min: 1 }).withMessage('至少选择一种输出格式'),
  body('parameters').optional().isObject()
];