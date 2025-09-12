/**
 * System Resource Monitor
 * 系统资源监控服务，提供CPU、内存、磁盘、网络等系统级别的监控
 */

import EventEmitter from 'events';
import os from 'os';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '@/utils/logger';
import { Redis } from 'ioredis';

const execAsync = promisify(exec);

export interface CPUMetrics {
  usage: number;           // CPU使用率 (%)
  loadAverage: number[];   // 负载平均值 [1min, 5min, 15min]
  cores: number;           // CPU核心数
  frequency: number;       // CPU频率 (MHz)
  temperature?: number;    // CPU温度 (°C)
}

export interface MemoryMetrics {
  total: number;          // 总内存 (bytes)
  free: number;           // 空闲内存 (bytes)
  used: number;           // 已用内存 (bytes)
  usage: number;          // 使用率 (%)
  available: number;      // 可用内存 (bytes)
  buffers?: number;       // 缓冲区 (bytes)
  cached?: number;        // 缓存 (bytes)
  swapTotal?: number;     // 交换分区总量 (bytes)
  swapUsed?: number;      // 交换分区使用量 (bytes)
}

export interface DiskMetrics {
  total: number;          // 总空间 (bytes)
  free: number;           // 空闲空间 (bytes)
  used: number;           // 已用空间 (bytes)
  usage: number;          // 使用率 (%)
  readOps: number;        // 读操作次数
  writeOps: number;       // 写操作次数
  readBytes: number;      // 读取字节数
  writeBytes: number;     // 写入字节数
  ioUtilization: number;  // IO使用率 (%)
}

export interface NetworkMetrics {
  bytesReceived: number;  // 接收字节数
  bytesSent: number;      // 发送字节数
  packetsReceived: number; // 接收包数
  packetsSent: number;    // 发送包数
  errorsReceived: number; // 接收错误数
  errorsSent: number;     // 发送错误数
  droppedReceived: number; // 丢弃的接收包数
  droppedSent: number;    // 丢弃的发送包数
}

export interface ProcessMetrics {
  pid: number;            // 进程ID
  name: string;           // 进程名称
  cpuUsage: number;       // CPU使用率 (%)
  memoryUsage: number;    // 内存使用量 (bytes)
  memoryPercent: number;  // 内存使用率 (%)
  handles?: number;       // 文件句柄数
  threads?: number;       // 线程数
  uptime: number;         // 运行时间 (seconds)
}

export interface SystemResourceMetrics {
  timestamp: Date;
  cpu: CPUMetrics;
  memory: MemoryMetrics;
  disk: DiskMetrics;
  network: NetworkMetrics;
  process: ProcessMetrics;
  system: {
    uptime: number;       // 系统运行时间 (seconds)
    hostname: string;     // 主机名
    platform: string;    // 平台
    arch: string;         // 架构
  };
}

export interface ResourceAlert {
  id: string;
  type: 'cpu' | 'memory' | 'disk' | 'network' | 'process';
  level: 'warning' | 'critical';
  metric: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  resolved?: Date;
}

export interface ResourceThreshold {
  metric: string;
  warning: number;
  critical: number;
  enabled: boolean;
}

export class SystemResourceMonitor extends EventEmitter {
  private redis: Redis;
  private metrics: SystemResourceMetrics[] = [];
  private alerts: ResourceAlert[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  
  private readonly MAX_METRICS_HISTORY = 2880; // 24小时，每30秒一次
  private readonly MAX_ALERTS_HISTORY = 1000;
  
  // 资源监控阈值
  private readonly thresholds: ResourceThreshold[] = [
    {
      metric: 'cpu.usage',
      warning: 80,
      critical: 95,
      enabled: true
    },
    {
      metric: 'memory.usage',
      warning: 85,
      critical: 95,
      enabled: true
    },
    {
      metric: 'disk.usage',
      warning: 85,
      critical: 95,
      enabled: true
    },
    {
      metric: 'disk.ioUtilization',
      warning: 80,
      critical: 90,
      enabled: true
    },
    {
      metric: 'process.cpuUsage',
      warning: 70,
      critical: 90,
      enabled: true
    },
    {
      metric: 'process.memoryPercent',
      warning: 50,
      critical: 70,
      enabled: true
    }
  ];

  // 网络统计基线
  private networkBaseline: NetworkMetrics = {
    bytesReceived: 0,
    bytesSent: 0,
    packetsReceived: 0,
    packetsSent: 0,
    errorsReceived: 0,
    errorsSent: 0,
    droppedReceived: 0,
    droppedSent: 0
  };

  // 磁盘IO统计基线
  private diskIOBaseline: { readOps: number; writeOps: number; readBytes: number; writeBytes: number } = {
    readOps: 0,
    writeOps: 0,
    readBytes: 0,
    writeBytes: 0
  };

  constructor(redis: Redis) {
    super();
    this.redis = redis;
  }

  /**
   * 启动系统资源监控
   */
  async startMonitoring(intervalMs: number = 30000): Promise<void> {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    logger.info('Starting system resource monitoring', { intervalMs });

    // 初始化基线数据
    await this.initializeBaselines();

    this.monitoringInterval = setInterval(async () => {
      await this.collectSystemMetrics();
    }, intervalMs);

    // 立即收集一次指标
    await this.collectSystemMetrics();
  }

  /**
   * 停止监控
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    logger.info('System resource monitoring stopped');
  }

  /**
   * 初始化基线数据
   */
  private async initializeBaselines(): Promise<void> {
    try {
      // 初始化网络基线
      const networkStats = await this.collectNetworkMetrics();
      this.networkBaseline = { ...networkStats };

      // 初始化磁盘IO基线
      const diskStats = await this.collectDiskMetrics();
      this.diskIOBaseline = {
        readOps: diskStats.readOps,
        writeOps: diskStats.writeOps,
        readBytes: diskStats.readBytes,
        writeBytes: diskStats.writeBytes
      };

      logger.info('System monitoring baselines initialized');

    } catch (error) {
      logger.error('Failed to initialize baselines', error);
    }
  }

  /**
   * 收集系统指标
   */
  private async collectSystemMetrics(): Promise<void> {
    try {
      const timestamp = new Date();

      const [cpuMetrics, memoryMetrics, diskMetrics, networkMetrics, processMetrics] = await Promise.all([
        this.collectCPUMetrics(),
        this.collectMemoryMetrics(),
        this.collectDiskMetrics(),
        this.collectNetworkMetrics(),
        this.collectProcessMetrics()
      ]);

      const systemMetrics: SystemResourceMetrics = {
        timestamp,
        cpu: cpuMetrics,
        memory: memoryMetrics,
        disk: diskMetrics,
        network: networkMetrics,
        process: processMetrics,
        system: {
          uptime: os.uptime(),
          hostname: os.hostname(),
          platform: os.platform(),
          arch: os.arch()
        }
      };

      // 存储指标
      this.metrics.push(systemMetrics);
      if (this.metrics.length > this.MAX_METRICS_HISTORY) {
        this.metrics.shift();
      }

      // 检查阈值
      await this.checkResourceThresholds(systemMetrics);

      // 缓存指标
      await this.cacheMetrics(systemMetrics);

      // 发出事件
      this.emit('systemMetrics', systemMetrics);

      logger.debug('System metrics collected', {
        cpuUsage: cpuMetrics.usage,
        memoryUsage: memoryMetrics.usage,
        diskUsage: diskMetrics.usage
      });

    } catch (error) {
      logger.error('Failed to collect system metrics', error);
    }
  }

  /**
   * 收集CPU指标
   */
  private async collectCPUMetrics(): Promise<CPUMetrics> {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    
    // 计算CPU使用率
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type];
      }
      totalIdle += cpu.times.idle;
    });

    const usage = Math.round((1 - totalIdle / totalTick) * 100);
    const frequency = cpus[0]?.speed || 0;
    
    // 尝试获取CPU温度（Linux系统）
    let temperature: number | undefined;
    try {
      if (os.platform() === 'linux') {
        const tempData = await fs.readFile('/sys/class/thermal/thermal_zone0/temp', 'utf8');
        temperature = parseInt(tempData.trim()) / 1000;
      }
    } catch (error) {
      // 温度获取失败，忽略
    }

    return {
      usage,
      loadAverage: loadAvg,
      cores: cpus.length,
      frequency,
      temperature
    };
  }

  /**
   * 收集内存指标
   */
  private async collectMemoryMetrics(): Promise<MemoryMetrics> {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const usage = Math.round((used / total) * 100);

    let memoryMetrics: MemoryMetrics = {
      total,
      free,
      used,
      usage,
      available: free
    };

    // 在Linux系统上获取更详细的内存信息
    if (os.platform() === 'linux') {
      try {
        const meminfo = await fs.readFile('/proc/meminfo', 'utf8');
        const lines = meminfo.split('\n');
        
        const parseMemLine = (name: string): number => {
          const line = lines.find(l => l.startsWith(name));
          if (line) {
            const match = line.match(/(\d+) kB/);
            return match ? parseInt(match[1]) * 1024 : 0;
          }
          return 0;
        };

        memoryMetrics.available = parseMemLine('MemAvailable');
        memoryMetrics.buffers = parseMemLine('Buffers');
        memoryMetrics.cached = parseMemLine('Cached');
        memoryMetrics.swapTotal = parseMemLine('SwapTotal');
        memoryMetrics.swapUsed = parseMemLine('SwapTotal') - parseMemLine('SwapFree');

      } catch (error) {
        logger.debug('Failed to read detailed memory info', error);
      }
    }

    return memoryMetrics;
  }

  /**
   * 收集磁盘指标
   */
  private async collectDiskMetrics(): Promise<DiskMetrics> {
    let diskMetrics: DiskMetrics = {
      total: 0,
      free: 0,
      used: 0,
      usage: 0,
      readOps: 0,
      writeOps: 0,
      readBytes: 0,
      writeBytes: 0,
      ioUtilization: 0
    };

    try {
      // 获取磁盘空间信息
      if (os.platform() === 'linux' || os.platform() === 'darwin') {
        const { stdout } = await execAsync('df -B1 / | tail -1');
        const parts = stdout.trim().split(/\s+/);
        if (parts.length >= 4) {
          diskMetrics.total = parseInt(parts[1]) || 0;
          diskMetrics.used = parseInt(parts[2]) || 0;
          diskMetrics.free = parseInt(parts[3]) || 0;
          diskMetrics.usage = diskMetrics.total > 0 ? Math.round((diskMetrics.used / diskMetrics.total) * 100) : 0;
        }
      }

      // 获取磁盘IO信息（Linux）
      if (os.platform() === 'linux') {
        const iostatOutput = await execAsync('cat /proc/diskstats').catch(() => ({ stdout: '' }));
        const lines = iostatOutput.stdout.split('\n');
        
        let totalReadOps = 0;
        let totalWriteOps = 0;
        let totalReadBytes = 0;
        let totalWriteBytes = 0;

        lines.forEach(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 14 && parts[2] && !parts[2].includes('loop')) {
            totalReadOps += parseInt(parts[3]) || 0;
            totalWriteOps += parseInt(parts[7]) || 0;
            totalReadBytes += (parseInt(parts[5]) || 0) * 512;
            totalWriteBytes += (parseInt(parts[9]) || 0) * 512;
          }
        });

        // 计算相对于基线的增量
        diskMetrics.readOps = Math.max(0, totalReadOps - this.diskIOBaseline.readOps);
        diskMetrics.writeOps = Math.max(0, totalWriteOps - this.diskIOBaseline.writeOps);
        diskMetrics.readBytes = Math.max(0, totalReadBytes - this.diskIOBaseline.readBytes);
        diskMetrics.writeBytes = Math.max(0, totalWriteBytes - this.diskIOBaseline.writeBytes);

        // 更新基线
        this.diskIOBaseline = {
          readOps: totalReadOps,
          writeOps: totalWriteOps,
          readBytes: totalReadBytes,
          writeBytes: totalWriteBytes
        };

        // 简单的IO利用率估算
        const totalOps = diskMetrics.readOps + diskMetrics.writeOps;
        diskMetrics.ioUtilization = Math.min(100, Math.round(totalOps / 1000 * 100)); // 粗略估算
      }

    } catch (error) {
      logger.debug('Failed to collect disk metrics', error);
    }

    return diskMetrics;
  }

  /**
   * 收集网络指标
   */
  private async collectNetworkMetrics(): Promise<NetworkMetrics> {
    let networkMetrics: NetworkMetrics = {
      bytesReceived: 0,
      bytesSent: 0,
      packetsReceived: 0,
      packetsSent: 0,
      errorsReceived: 0,
      errorsSent: 0,
      droppedReceived: 0,
      droppedSent: 0
    };

    try {
      if (os.platform() === 'linux') {
        const netdev = await fs.readFile('/proc/net/dev', 'utf8');
        const lines = netdev.split('\n').slice(2); // 跳过头部

        let totalRxBytes = 0;
        let totalTxBytes = 0;
        let totalRxPackets = 0;
        let totalTxPackets = 0;
        let totalRxErrors = 0;
        let totalTxErrors = 0;
        let totalRxDropped = 0;
        let totalTxDropped = 0;

        lines.forEach(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 17 && parts[0].includes(':') && !parts[0].includes('lo:')) {
            totalRxBytes += parseInt(parts[1]) || 0;
            totalRxPackets += parseInt(parts[2]) || 0;
            totalRxErrors += parseInt(parts[3]) || 0;
            totalRxDropped += parseInt(parts[4]) || 0;
            totalTxBytes += parseInt(parts[9]) || 0;
            totalTxPackets += parseInt(parts[10]) || 0;
            totalTxErrors += parseInt(parts[11]) || 0;
            totalTxDropped += parseInt(parts[12]) || 0;
          }
        });

        // 计算相对于基线的增量
        networkMetrics.bytesReceived = Math.max(0, totalRxBytes - this.networkBaseline.bytesReceived);
        networkMetrics.bytesSent = Math.max(0, totalTxBytes - this.networkBaseline.bytesSent);
        networkMetrics.packetsReceived = Math.max(0, totalRxPackets - this.networkBaseline.packetsReceived);
        networkMetrics.packetsSent = Math.max(0, totalTxPackets - this.networkBaseline.packetsSent);
        networkMetrics.errorsReceived = Math.max(0, totalRxErrors - this.networkBaseline.errorsReceived);
        networkMetrics.errorsSent = Math.max(0, totalTxErrors - this.networkBaseline.errorsSent);
        networkMetrics.droppedReceived = Math.max(0, totalRxDropped - this.networkBaseline.droppedReceived);
        networkMetrics.droppedSent = Math.max(0, totalTxDropped - this.networkBaseline.droppedSent);

        // 更新基线
        this.networkBaseline = {
          bytesReceived: totalRxBytes,
          bytesSent: totalTxBytes,
          packetsReceived: totalRxPackets,
          packetsSent: totalTxPackets,
          errorsReceived: totalRxErrors,
          errorsSent: totalTxErrors,
          droppedReceived: totalRxDropped,
          droppedSent: totalTxDropped
        };
      }

    } catch (error) {
      logger.debug('Failed to collect network metrics', error);
    }

    return networkMetrics;
  }

  /**
   * 收集进程指标
   */
  private async collectProcessMetrics(): Promise<ProcessMetrics> {
    const pid = process.pid;
    
    let processMetrics: ProcessMetrics = {
      pid,
      name: process.title || 'node',
      cpuUsage: 0,
      memoryUsage: 0,
      memoryPercent: 0,
      uptime: process.uptime()
    };

    try {
      // 获取内存使用情况
      const memUsage = process.memoryUsage();
      processMetrics.memoryUsage = memUsage.rss;
      processMetrics.memoryPercent = Math.round((memUsage.rss / os.totalmem()) * 100);

      // 获取CPU使用率
      const cpuUsage = process.cpuUsage();
      const totalCpuTime = cpuUsage.user + cpuUsage.system;
      
      // 简单的CPU使用率估算（需要两次采样来计算差值）
      const cachedCpuTime = await this.redis.get(`process_cpu_time:${pid}`) || '0';
      const lastCpuTime = parseInt(cachedCpuTime);
      
      if (lastCpuTime > 0) {
        const cpuDelta = totalCpuTime - lastCpuTime;
        const timeDelta = 30000 * 1000; // 30秒转微秒
        processMetrics.cpuUsage = Math.round((cpuDelta / timeDelta) * 100);
      }
      
      await this.redis.setex(`process_cpu_time:${pid}`, 60, totalCpuTime.toString());

      // 在Linux上获取更多进程信息
      if (os.platform() === 'linux') {
        try {
          const statData = await fs.readFile(`/proc/${pid}/stat`, 'utf8');
          const statParts = statData.split(' ');
          
          if (statParts.length >= 20) {
            processMetrics.threads = parseInt(statParts[19]) || 0;
          }

          const fdDir = await fs.readdir(`/proc/${pid}/fd`).catch(() => []);
          processMetrics.handles = fdDir.length;

        } catch (error) {
          logger.debug('Failed to collect detailed process metrics', error);
        }
      }

    } catch (error) {
      logger.debug('Failed to collect process metrics', error);
    }

    return processMetrics;
  }

  /**
   * 检查资源阈值
   */
  private async checkResourceThresholds(metrics: SystemResourceMetrics): Promise<void> {
    for (const threshold of this.thresholds) {
      if (!threshold.enabled) continue;

      const value = this.getMetricValue(metrics, threshold.metric);
      if (value === undefined) continue;

      let alertLevel: 'warning' | 'critical' | null = null;
      let thresholdValue: number = 0;

      if (value >= threshold.critical) {
        alertLevel = 'critical';
        thresholdValue = threshold.critical;
      } else if (value >= threshold.warning) {
        alertLevel = 'warning';
        thresholdValue = threshold.warning;
      }

      if (alertLevel) {
        await this.createResourceAlert(threshold, alertLevel, value, thresholdValue, metrics);
      }
    }
  }

  /**
   * 获取指标值
   */
  private getMetricValue(metrics: SystemResourceMetrics, path: string): number | undefined {
    const parts = path.split('.');
    let value: any = metrics;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return typeof value === 'number' ? value : undefined;
  }

  /**
   * 创建资源告警
   */
  private async createResourceAlert(
    threshold: ResourceThreshold,
    level: 'warning' | 'critical',
    value: number,
    thresholdValue: number,
    metrics: SystemResourceMetrics
  ): Promise<void> {
    const alertId = `resource_${threshold.metric}_${level}_${Date.now()}`;
    
    // 检查是否存在相同的未解决告警
    const existingAlert = this.alerts.find(alert =>
      alert.metric === threshold.metric &&
      alert.level === level &&
      !alert.resolved
    );

    if (existingAlert) return; // 避免重复告警

    const alert: ResourceAlert = {
      id: alertId,
      type: threshold.metric.split('.')[0] as ResourceAlert['type'],
      level,
      metric: threshold.metric,
      message: this.generateAlertMessage(threshold.metric, level, value, thresholdValue),
      value,
      threshold: thresholdValue,
      timestamp: new Date()
    };

    this.alerts.push(alert);
    if (this.alerts.length > this.MAX_ALERTS_HISTORY) {
      this.alerts.shift();
    }

    // 缓存告警
    await this.cacheAlert(alert);

    this.emit('resourceAlert', alert);
    
    if (level === 'critical') {
      logger.error('Critical resource alert', alert);
    } else {
      logger.warn('Resource warning', alert);
    }
  }

  /**
   * 生成告警消息
   */
  private generateAlertMessage(
    metric: string,
    level: string,
    value: number,
    threshold: number
  ): string {
    const metricNames: Record<string, string> = {
      'cpu.usage': 'CPU使用率',
      'memory.usage': '内存使用率',
      'disk.usage': '磁盘使用率',
      'disk.ioUtilization': '磁盘IO使用率',
      'process.cpuUsage': '进程CPU使用率',
      'process.memoryPercent': '进程内存使用率'
    };

    const metricName = metricNames[metric] || metric;
    const unit = metric.includes('usage') || metric.includes('Percent') ? '%' : '';
    
    return `${metricName}${level === 'critical' ? '严重' : '警告'}：当前值${value.toFixed(1)}${unit}，超过${level === 'critical' ? '严重' : '警告'}阈值${threshold}${unit}`;
  }

  /**
   * 缓存指标数据
   */
  private async cacheMetrics(metrics: SystemResourceMetrics): Promise<void> {
    try {
      const cacheKey = `system_metrics:latest`;
      const metricsData = JSON.stringify(metrics);
      await this.redis.setex(cacheKey, 3600, metricsData);

      // 存储时序数据
      const timeSeriesKey = `system_metrics:${metrics.timestamp.toISOString().split('T')[0]}`;
      await this.redis.zadd(timeSeriesKey, metrics.timestamp.getTime(), metricsData);
      await this.redis.expire(timeSeriesKey, 7 * 24 * 3600); // 保存7天

    } catch (error) {
      logger.error('Failed to cache system metrics', error);
    }
  }

  /**
   * 缓存告警信息
   */
  private async cacheAlert(alert: ResourceAlert): Promise<void> {
    try {
      const alertKey = `system_alerts:${alert.type}`;
      const alertData = JSON.stringify(alert);
      await this.redis.zadd(alertKey, alert.timestamp.getTime(), alertData);
      await this.redis.expire(alertKey, 30 * 24 * 3600); // 保存30天

    } catch (error) {
      logger.error('Failed to cache system alert', error);
    }
  }

  /**
   * 获取当前系统状态
   */
  getCurrentSystemStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    metrics: SystemResourceMetrics | null;
    activeAlerts: ResourceAlert[];
    summary: string;
  } {
    const currentMetrics = this.metrics[this.metrics.length - 1] || null;
    const activeAlerts = this.alerts.filter(alert => !alert.resolved);
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (activeAlerts.some(alert => alert.level === 'critical')) {
      status = 'critical';
    } else if (activeAlerts.some(alert => alert.level === 'warning')) {
      status = 'warning';
    }

    const summary = this.generateSystemStatusSummary(status, activeAlerts.length, currentMetrics);

    return {
      status,
      metrics: currentMetrics,
      activeAlerts,
      summary
    };
  }

  /**
   * 生成系统状态摘要
   */
  private generateSystemStatusSummary(
    status: string,
    alertCount: number,
    metrics: SystemResourceMetrics | null
  ): string {
    if (status === 'critical') {
      return `系统资源严重告警：存在${alertCount}个严重问题，系统性能受到严重影响`;
    } else if (status === 'warning') {
      return `系统资源警告：存在${alertCount}个警告，建议及时处理以避免性能问题`;
    } else {
      if (!metrics) {
        return '系统资源监控正在初始化中';
      }
      return `系统资源正常：CPU使用率${metrics.cpu.usage}%，` +
             `内存使用率${metrics.memory.usage}%，` +
             `磁盘使用率${metrics.disk.usage}%`;
    }
  }

  /**
   * 获取系统指标历史
   */
  getSystemMetricsHistory(hours: number = 24): SystemResourceMetrics[] {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (hours * 60 * 60 * 1000));
    
    return this.metrics.filter(m => 
      m.timestamp >= startTime && m.timestamp <= endTime
    );
  }

  /**
   * 获取资源告警历史
   */
  getResourceAlertsHistory(hours: number = 24): ResourceAlert[] {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (hours * 60 * 60 * 1000));
    
    return this.alerts.filter(a => 
      a.timestamp >= startTime && a.timestamp <= endTime
    );
  }

  /**
   * 解决资源告警
   */
  resolveResourceAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId && !a.resolved);
    if (alert) {
      alert.resolved = new Date();
      this.emit('resourceAlertResolved', alert);
      logger.info('Resource alert resolved', { alertId, type: alert.type, metric: alert.metric });
      return true;
    }
    return false;
  }

  /**
   * 获取系统资源报告
   */
  getSystemResourceReport(hours: number = 24): {
    timeRange: { start: Date; end: Date };
    summary: {
      avgCpuUsage: number;
      maxCpuUsage: number;
      avgMemoryUsage: number;
      maxMemoryUsage: number;
      avgDiskUsage: number;
      maxDiskUsage: number;
    };
    alertSummary: {
      total: number;
      byLevel: Record<string, number>;
      byType: Record<string, number>;
    };
    trends: {
      metric: string;
      trend: 'improving' | 'stable' | 'degrading';
      change: number;
    }[];
  } {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (hours * 60 * 60 * 1000));
    
    const reportMetrics = this.metrics.filter(m => 
      m.timestamp >= startTime && m.timestamp <= endTime
    );

    const reportAlerts = this.alerts.filter(a =>
      a.timestamp >= startTime && a.timestamp <= endTime
    );

    // 计算摘要统计
    const summary = this.calculateResourceSummary(reportMetrics);

    // 告警汇总
    const alertSummary = {
      total: reportAlerts.length,
      byLevel: this.groupBy(reportAlerts, 'level'),
      byType: this.groupBy(reportAlerts, 'type')
    };

    // 趋势分析
    const trends = this.analyzeResourceTrends(reportMetrics);

    return {
      timeRange: { start: startTime, end: endTime },
      summary,
      alertSummary,
      trends
    };
  }

  /**
   * 计算资源摘要
   */
  private calculateResourceSummary(metrics: SystemResourceMetrics[]): {
    avgCpuUsage: number;
    maxCpuUsage: number;
    avgMemoryUsage: number;
    maxMemoryUsage: number;
    avgDiskUsage: number;
    maxDiskUsage: number;
  } {
    if (metrics.length === 0) {
      return {
        avgCpuUsage: 0,
        maxCpuUsage: 0,
        avgMemoryUsage: 0,
        maxMemoryUsage: 0,
        avgDiskUsage: 0,
        maxDiskUsage: 0
      };
    }

    const cpuUsages = metrics.map(m => m.cpu.usage);
    const memoryUsages = metrics.map(m => m.memory.usage);
    const diskUsages = metrics.map(m => m.disk.usage);

    return {
      avgCpuUsage: Math.round(cpuUsages.reduce((a, b) => a + b, 0) / cpuUsages.length),
      maxCpuUsage: Math.max(...cpuUsages),
      avgMemoryUsage: Math.round(memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length),
      maxMemoryUsage: Math.max(...memoryUsages),
      avgDiskUsage: Math.round(diskUsages.reduce((a, b) => a + b, 0) / diskUsages.length),
      maxDiskUsage: Math.max(...diskUsages)
    };
  }

  /**
   * 分析资源趋势
   */
  private analyzeResourceTrends(metrics: SystemResourceMetrics[]): Array<{
    metric: string;
    trend: 'improving' | 'stable' | 'degrading';
    change: number;
  }> {
    if (metrics.length < 10) return [];

    const recent = metrics.slice(-5);
    const previous = metrics.slice(-10, -5);

    const trendMetrics = ['cpu.usage', 'memory.usage', 'disk.usage'];

    return trendMetrics.map(metric => {
      const recentAvg = recent.reduce((sum, m) => sum + this.getMetricValue(m, metric)!, 0) / recent.length;
      const previousAvg = previous.reduce((sum, m) => sum + this.getMetricValue(m, metric)!, 0) / previous.length;
      
      const change = ((recentAvg - previousAvg) / previousAvg) * 100;
      
      let trend: 'improving' | 'stable' | 'degrading' = 'stable';
      if (Math.abs(change) > 10) {
        // 对于使用率指标，降低是好的
        trend = change < 0 ? 'improving' : 'degrading';
      }

      return { metric, trend, change: Math.round(change * 100) / 100 };
    });
  }

  /**
   * 分组统计
   */
  private groupBy<T>(items: T[], key: keyof T): Record<string, number> {
    return items.reduce((acc, item) => {
      const value = String(item[key]);
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}

export default SystemResourceMonitor;