import { NotificationTemplate } from '../types';

export class TemplateEngine {
  
  /**
   * Render template content with provided data
   */
  async renderTemplate(
    template: NotificationTemplate,
    channelId: string,
    data: Record<string, any>
  ): Promise<{
    subject?: string;
    htmlBody?: string;
    textBody?: string;
    title?: string;
    message?: string;
    icon?: string;
    payload?: Record<string, any>;
  }> {
    try {
      // Find channel configuration in template
      const channelConfig = template.channels.find(c => c.channelId === channelId);
      if (!channelConfig) {
        throw new Error(`Channel ${channelId} not found in template ${template.id}`);
      }

      const templateContent = channelConfig.templateContent;
      
      // Validate required variables
      await this.validateTemplateData(template, data);
      
      // Render each content field
      const rendered: any = {};

      if (templateContent.subject) {
        rendered.subject = this.interpolateString(templateContent.subject, data);
      }

      if (templateContent.htmlBody) {
        rendered.htmlBody = this.interpolateString(templateContent.htmlBody, data);
      }

      if (templateContent.textBody) {
        rendered.textBody = this.interpolateString(templateContent.textBody, data);
      }

      if (templateContent.title) {
        rendered.title = this.interpolateString(templateContent.title, data);
      }

      if (templateContent.message) {
        rendered.message = this.interpolateString(templateContent.message, data);
      }

      if (templateContent.icon) {
        rendered.icon = this.interpolateString(templateContent.icon, data);
      }

      if (templateContent.payload) {
        rendered.payload = this.interpolateObject(templateContent.payload, data);
      }

      return rendered;
    } catch (error) {
      console.error('Error rendering template:', error);
      throw error;
    }
  }

  /**
   * Validate template data against template variables
   */
  private async validateTemplateData(template: NotificationTemplate, data: Record<string, any>): Promise<void> {
    const missingRequired: string[] = [];

    for (const variable of template.variables || []) {
      if (variable.required && !(variable.name in data)) {
        // Check if variable has a default value
        if (variable.defaultValue === undefined) {
          missingRequired.push(variable.name);
        } else {
          // Set default value
          data[variable.name] = variable.defaultValue;
        }
      }
    }

    if (missingRequired.length > 0) {
      throw new Error(`Missing required template variables: ${missingRequired.join(', ')}`);
    }
  }

  /**
   * Interpolate string template with data using handlebars-like syntax
   */
  private interpolateString(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const value = this.getNestedValue(data, path);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Interpolate object template with data
   */
  private interpolateObject(template: Record<string, any>, data: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(template)) {
      if (typeof value === 'string') {
        result[key] = this.interpolateString(value, data);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.interpolateObject(value, data);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Validate template syntax
   */
  async validateTemplateSyntax(templateContent: string): Promise<{
    isValid: boolean;
    errors: string[];
    variables: string[];
  }> {
    const errors: string[] = [];
    const variables: string[] = [];
    
    try {
      // Extract variables using regex
      const variableMatches = templateContent.match(/\{\{(\w+(?:\.\w+)*)\}\}/g);
      
      if (variableMatches) {
        for (const match of variableMatches) {
          const variable = match.replace(/\{\{|\}\}/g, '');
          if (!variables.includes(variable)) {
            variables.push(variable);
          }
        }
      }

      // Check for unmatched brackets
      const openBrackets = (templateContent.match(/\{\{/g) || []).length;
      const closeBrackets = (templateContent.match(/\}\}/g) || []).length;
      
      if (openBrackets !== closeBrackets) {
        errors.push('Unmatched template brackets');
      }

      // Check for invalid variable names
      for (const variable of variables) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(variable)) {
          errors.push(`Invalid variable name: ${variable}`);
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        variables
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Template validation error: ${error.message}`],
        variables
      };
    }
  }

  /**
   * Generate template preview with sample data
   */
  async generatePreview(
    template: NotificationTemplate,
    channelId: string,
    sampleData?: Record<string, any>
  ): Promise<{
    subject?: string;
    htmlBody?: string;
    textBody?: string;
    title?: string;
    message?: string;
    icon?: string;
    payload?: Record<string, any>;
  }> {
    // Generate default sample data based on template variables
    const defaultSampleData: Record<string, any> = {};
    
    for (const variable of template.variables || []) {
      switch (variable.type) {
        case 'string':
          defaultSampleData[variable.name] = variable.defaultValue || `Sample ${variable.name}`;
          break;
        case 'number':
          defaultSampleData[variable.name] = variable.defaultValue || 42;
          break;
        case 'boolean':
          defaultSampleData[variable.name] = variable.defaultValue || true;
          break;
        case 'date':
          defaultSampleData[variable.name] = variable.defaultValue || new Date().toISOString();
          break;
        default:
          defaultSampleData[variable.name] = variable.defaultValue || `Sample ${variable.name}`;
      }
    }

    // Merge with provided sample data
    const finalSampleData = { ...defaultSampleData, ...sampleData };

    return await this.renderTemplate(template, channelId, finalSampleData);
  }

  /**
   * Extract variables from template content
   */
  extractVariables(templateContent: string): string[] {
    const variables: string[] = [];
    const matches = templateContent.match(/\{\{(\w+(?:\.\w+)*)\}\}/g);
    
    if (matches) {
      for (const match of matches) {
        const variable = match.replace(/\{\{|\}\}/g, '');
        if (!variables.includes(variable)) {
          variables.push(variable);
        }
      }
    }

    return variables;
  }

  /**
   * Convert template to different formats
   */
  async convertTemplate(
    templateContent: string,
    fromFormat: 'html' | 'text',
    toFormat: 'html' | 'text'
  ): Promise<string> {
    if (fromFormat === toFormat) {
      return templateContent;
    }

    try {
      if (fromFormat === 'html' && toFormat === 'text') {
        // Convert HTML to plain text
        return this.htmlToText(templateContent);
      } else if (fromFormat === 'text' && toFormat === 'html') {
        // Convert plain text to HTML
        return this.textToHtml(templateContent);
      }

      return templateContent;
    } catch (error) {
      console.error('Error converting template format:', error);
      return templateContent;
    }
  }

  /**
   * Convert HTML to plain text
   */
  private htmlToText(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  /**
   * Convert plain text to HTML
   */
  private textToHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  }

  /**
   * Get template performance metrics
   */
  async getTemplateMetrics(templateId: string): Promise<{
    renderCount: number;
    avgRenderTime: number;
    errorRate: number;
    lastUsed: Date | null;
  }> {
    // This would typically query a metrics database
    // For now, return placeholder data
    return {
      renderCount: 0,
      avgRenderTime: 0,
      errorRate: 0,
      lastUsed: null
    };
  }

  /**
   * Optimize template for performance
   */
  async optimizeTemplate(templateContent: string): Promise<{
    optimized: string;
    improvements: string[];
  }> {
    const improvements: string[] = [];
    let optimized = templateContent;

    // Remove unnecessary whitespace
    const beforeLength = optimized.length;
    optimized = optimized.replace(/\s+/g, ' ').trim();
    if (optimized.length < beforeLength) {
      improvements.push('Removed unnecessary whitespace');
    }

    // Cache commonly used expressions
    const expressions = this.extractVariables(optimized);
    if (expressions.length > 10) {
      improvements.push('Consider caching template expressions for better performance');
    }

    return {
      optimized,
      improvements
    };
  }

  /**
   * Clone template with modifications
   */
  async cloneTemplate(
    original: NotificationTemplate,
    modifications: Partial<NotificationTemplate>
  ): Promise<Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>> {
    return {
      name: modifications.name || `${original.name} (Copy)`,
      description: modifications.description || original.description,
      category: modifications.category || original.category,
      channels: modifications.channels || original.channels,
      variables: modifications.variables || original.variables,
      isSystem: false, // Cloned templates are never system templates
      createdBy: modifications.createdBy || original.createdBy
    };
  }
}