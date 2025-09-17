import React, { useState } from 'react';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');

  // 菜单项配置
  const menuItems = [
    { id: 'dashboard', name: '📊 仪表板' },
    { id: 'emails', name: '📧 邮件列表' },
    { id: 'analysis', name: '🔍 智能分析' },
    { id: 'filters', name: '🎯 过滤规则' },
    { id: 'reports', name: '📊 报告' },
    { id: 'settings', name: '⚙️ 设置' }
  ];

  // 渲染仪表板内容
  const renderDashboard = () => (
    <div>
      <h2>📊 仪表板总览</h2>

      {/* 统计卡片 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <h3 style={{ color: '#1976d2', margin: '0 0 10px 0' }}>📧 总邮件数</h3>
          <p style={{ fontSize: '2em', margin: '0', fontWeight: 'bold' }}>2,456</p>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <h3 style={{ color: '#f44336', margin: '0 0 10px 0' }}>🔔 未读邮件</h3>
          <p style={{ fontSize: '2em', margin: '0', fontWeight: 'bold' }}>23</p>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <h3 style={{ color: '#ff9800', margin: '0 0 10px 0' }}>⏳ 待分析</h3>
          <p style={{ fontSize: '2em', margin: '0', fontWeight: 'bold' }}>5</p>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <h3 style={{ color: '#4caf50', margin: '0 0 10px 0' }}>🎯 规则匹配</h3>
          <p style={{ fontSize: '2em', margin: '0', fontWeight: 'bold' }}>18</p>
        </div>
      </div>

      {/* 快速操作 */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3>🚀 快速操作</h3>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setCurrentPage('emails')}
            style={{
              backgroundColor: '#1976d2',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            查看邮件
          </button>
          <button
            onClick={() => setCurrentPage('analysis')}
            style={{
              backgroundColor: '#4caf50',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            智能分析
          </button>
          <button
            onClick={() => setCurrentPage('filters')}
            style={{
              backgroundColor: '#ff9800',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            设置规则
          </button>
        </div>
      </div>
    </div>
  );

  // 渲染邮件列表
  const renderEmails = () => (
    <div>
      <h2>📧 邮件列表</h2>

      {/* 搜索栏 */}
      <div style={{
        backgroundColor: 'white',
        padding: '15px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <input
          type="text"
          placeholder="🔍 搜索邮件..."
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '5px',
            fontSize: '16px'
          }}
        />
      </div>

      {/* 邮件列表 */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ marginBottom: '15px', padding: '15px', border: '1px solid #eee', borderRadius: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
            <h4 style={{ margin: 0 }}>项目进度更新 - Q4计划</h4>
            <span style={{
              backgroundColor: '#f44336',
              color: 'white',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '12px'
            }}>高优先级</span>
            <span style={{
              backgroundColor: '#ff9800',
              color: 'white',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '12px'
            }}>未读</span>
          </div>
          <p style={{ margin: '5px 0', color: '#666' }}>来自: 张三 (zhangsan@company.com)</p>
          <p style={{ margin: '5px 0' }}>关于Q4项目计划的更新，需要您的确认...</p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <span style={{ backgroundColor: '#e3f2fd', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>情感: 中性</span>
            <span style={{ backgroundColor: '#fff3e0', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>紧急度: 80%</span>
          </div>
          <div style={{ marginTop: '10px' }}>
            <button style={{
              backgroundColor: '#1976d2',
              color: 'white',
              padding: '5px 15px',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              marginRight: '10px'
            }}>
              回复
            </button>
            <button style={{
              backgroundColor: '#4caf50',
              color: 'white',
              padding: '5px 15px',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer'
            }}>
              标记已读
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '15px', padding: '15px', border: '1px solid #eee', borderRadius: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
            <h4 style={{ margin: 0 }}>会议安排 - 下周一早上9点</h4>
            <span style={{
              backgroundColor: '#2196f3',
              color: 'white',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '12px'
            }}>中优先级</span>
          </div>
          <p style={{ margin: '5px 0', color: '#666' }}>来自: 王五 (wangwu@company.com)</p>
          <p style={{ margin: '5px 0' }}>下周一早上9点会议室A开会，请准时参加...</p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <span style={{ backgroundColor: '#e8f5e8', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>情感: 积极</span>
            <span style={{ backgroundColor: '#fff3e0', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>紧急度: 60%</span>
          </div>
          <div style={{ marginTop: '10px' }}>
            <button style={{
              backgroundColor: '#1976d2',
              color: 'white',
              padding: '5px 15px',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              marginRight: '10px'
            }}>
              回复
            </button>
            <button style={{
              backgroundColor: '#9e9e9e',
              color: 'white',
              padding: '5px 15px',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer'
            }}>
              已读
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '15px', padding: '15px', border: '1px solid #eee', borderRadius: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
            <h4 style={{ margin: 0 }}>客户反馈 - 产品改进建议</h4>
            <span style={{
              backgroundColor: '#f44336',
              color: 'white',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '12px'
            }}>高优先级</span>
            <span style={{
              backgroundColor: '#ff9800',
              color: 'white',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '12px'
            }}>未读</span>
          </div>
          <p style={{ margin: '5px 0', color: '#666' }}>来自: 李四 (lisi@client.com)</p>
          <p style={{ margin: '5px 0' }}>客户对我们的产品提出了一些改进建议...</p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <span style={{ backgroundColor: '#e8f5e8', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>情感: 积极</span>
            <span style={{ backgroundColor: '#ffebee', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>紧急度: 90%</span>
          </div>
          <div style={{ marginTop: '10px' }}>
            <button style={{
              backgroundColor: '#1976d2',
              color: 'white',
              padding: '5px 15px',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              marginRight: '10px'
            }}>
              回复
            </button>
            <button style={{
              backgroundColor: '#4caf50',
              color: 'white',
              padding: '5px 15px',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer'
            }}>
              标记已读
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // 渲染智能分析页面
  const renderAnalysis = () => (
    <div>
      <h2>🔍 智能分析</h2>

      {/* 分析概览 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3>📊 情感分析</h3>
          <div style={{ marginTop: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span>😊 积极</span>
              <span style={{ fontWeight: 'bold' }}>65%</span>
            </div>
            <div style={{ width: '100%', backgroundColor: '#f0f0f0', borderRadius: '10px', height: '8px' }}>
              <div style={{ width: '65%', backgroundColor: '#4caf50', borderRadius: '10px', height: '8px' }}></div>
            </div>
          </div>
          <div style={{ marginTop: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span>😐 中性</span>
              <span style={{ fontWeight: 'bold' }}>25%</span>
            </div>
            <div style={{ width: '100%', backgroundColor: '#f0f0f0', borderRadius: '10px', height: '8px' }}>
              <div style={{ width: '25%', backgroundColor: '#ff9800', borderRadius: '10px', height: '8px' }}></div>
            </div>
          </div>
          <div style={{ marginTop: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span>😠 消极</span>
              <span style={{ fontWeight: 'bold' }}>10%</span>
            </div>
            <div style={{ width: '100%', backgroundColor: '#f0f0f0', borderRadius: '10px', height: '8px' }}>
              <div style={{ width: '10%', backgroundColor: '#f44336', borderRadius: '10px', height: '8px' }}></div>
            </div>
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3>⚡ 紧急度分析</h3>
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <div style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              border: '8px solid #e0e0e0',
              borderTop: '8px solid #f44336',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: 'bold'
            }}>
              78%
            </div>
            <p style={{ marginTop: '15px', color: '#666' }}>平均紧急度</p>
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3>🎯 关键词分析</h3>
          <div style={{ marginTop: '15px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {['项目', '会议', '客户', '反馈', '计划', '更新', '紧急', '确认'].map((keyword) => (
                <span key={keyword} style={{
                  backgroundColor: '#e3f2fd',
                  padding: '5px 12px',
                  borderRadius: '15px',
                  fontSize: '14px',
                  color: '#1976d2'
                }}>
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* AI分析结果 */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <h3>🤖 AI智能建议</h3>
        <div style={{ marginTop: '15px' }}>
          <div style={{
            padding: '15px',
            backgroundColor: '#fff3e0',
            borderLeft: '4px solid #ff9800',
            borderRadius: '5px',
            marginBottom: '15px'
          }}>
            <strong>⚠️ 注意:</strong> 检测到3封高优先级邮件超过24小时未回复
          </div>
          <div style={{
            padding: '15px',
            backgroundColor: '#e8f5e8',
            borderLeft: '4px solid #4caf50',
            borderRadius: '5px',
            marginBottom: '15px'
          }}>
            <strong>✅ 建议:</strong> 客户邮件情感积极，建议优先处理产品改进反馈
          </div>
          <div style={{
            padding: '15px',
            backgroundColor: '#e3f2fd',
            borderLeft: '4px solid #2196f3',
            borderRadius: '5px'
          }}>
            <strong>💡 洞察:</strong> 本周"项目"相关邮件增长45%，建议创建专项过滤规则
          </div>
        </div>
      </div>

      {/* 分析操作 */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3>🔧 分析操作</h3>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '15px' }}>
          <button style={{
            backgroundColor: '#1976d2',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}>
            📊 生成详细报告
          </button>
          <button style={{
            backgroundColor: '#4caf50',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}>
            🎯 创建智能规则
          </button>
          <button style={{
            backgroundColor: '#ff9800',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}>
            📤 导出分析数据
          </button>
          <button
            onClick={() => setCurrentPage('dashboard')}
            style={{
              backgroundColor: '#9e9e9e',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            返回仪表板
          </button>
        </div>
      </div>
    </div>
  );

  // 渲染过滤规则页面
  const renderFilters = () => (
    <div>
      <h2>🎯 过滤规则管理</h2>

      {/* 快速创建规则 */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <h3>⚡ 快速创建规则</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px', marginTop: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>规则名称</label>
            <input
              type="text"
              placeholder="例如：高优先级客户邮件"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '5px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>触发条件</label>
            <select style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '5px'
            }}>
              <option>包含关键词</option>
              <option>发件人域名</option>
              <option>主题包含</option>
              <option>紧急度大于</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>执行动作</label>
            <select style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '5px'
            }}>
              <option>标记为重要</option>
              <option>移动到文件夹</option>
              <option>发送通知</option>
              <option>自动回复</option>
            </select>
          </div>
        </div>
        <button style={{
          backgroundColor: '#4caf50',
          color: 'white',
          padding: '10px 25px',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          marginTop: '15px'
        }}>
          创建规则
        </button>
      </div>

      {/* 现有规则列表 */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3>📋 现有规则</h3>
        <div style={{ marginTop: '15px' }}>
          {[
            { name: '高优先级客户邮件', condition: '发件人域名包含 @client.com', action: '标记为重要 + 发送通知', active: true },
            { name: '项目更新邮件', condition: '主题包含 "项目" 或 "更新"', action: '移动到项目文件夹', active: true },
            { name: '会议邀请处理', condition: '主题包含 "会议" 且紧急度 > 60%', action: '自动确认 + 添加日历', active: false }
          ].map((rule, index) => (
            <div key={index} style={{
              padding: '15px',
              border: '1px solid #eee',
              borderRadius: '5px',
              marginBottom: '10px',
              backgroundColor: rule.active ? '#f8fff8' : '#f8f8f8'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: '0 0 5px 0', color: rule.active ? '#4caf50' : '#9e9e9e' }}>
                    {rule.name} {rule.active ? '✅' : '⏸️'}
                  </h4>
                  <p style={{ margin: '5px 0', color: '#666', fontSize: '14px' }}>
                    <strong>条件:</strong> {rule.condition}
                  </p>
                  <p style={{ margin: '5px 0', color: '#666', fontSize: '14px' }}>
                    <strong>动作:</strong> {rule.action}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button style={{
                    backgroundColor: rule.active ? '#ff9800' : '#4caf50',
                    color: 'white',
                    padding: '5px 15px',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}>
                    {rule.active ? '暂停' : '启用'}
                  </button>
                  <button style={{
                    backgroundColor: '#1976d2',
                    color: 'white',
                    padding: '5px 15px',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}>
                    编辑
                  </button>
                  <button style={{
                    backgroundColor: '#f44336',
                    color: 'white',
                    padding: '5px 15px',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}>
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // 渲染报告页面
  const renderReports = () => (
    <div>
      <h2>📊 数据报告</h2>

      {/* 报告类型选择 */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <h3>📋 报告类型</h3>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '15px' }}>
          {[
            { name: '每日摘要', icon: '📅', active: true },
            { name: '周度分析', icon: '📈', active: false },
            { name: '月度报告', icon: '📊', active: false },
            { name: '自定义', icon: '⚙️', active: false }
          ].map((type, index) => (
            <button
              key={index}
              style={{
                backgroundColor: type.active ? '#1976d2' : '#f5f5f5',
                color: type.active ? 'white' : '#666',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              {type.icon} {type.name}
            </button>
          ))}
        </div>
      </div>

      {/* 数据可视化图表 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '20px',
        marginBottom: '20px'
      }}>
        {/* 邮件趋势图 */}
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3>📈 邮件处理趋势 (7天)</h3>
          <div style={{ height: '200px', position: 'relative', marginTop: '15px' }}>
            {/* 简单的条形图模拟 */}
            <div style={{ display: 'flex', alignItems: 'end', height: '180px', gap: '10px' }}>
              {[85, 92, 78, 95, 88, 76, 98].map((value, index) => (
                <div key={index} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{
                    backgroundColor: '#4caf50',
                    height: `${value}%`,
                    borderRadius: '4px 4px 0 0',
                    marginBottom: '5px',
                    minHeight: '10px'
                  }}></div>
                  <small style={{ color: '#666' }}>
                    {['周一', '周二', '周三', '周四', '周五', '周六', '周日'][index]}
                  </small>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 邮件分类饼图 */}
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3>🎯 邮件分类分布</h3>
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            {/* 简单饼图模拟 */}
            <div style={{
              width: '150px',
              height: '150px',
              borderRadius: '50%',
              background: 'conic-gradient(#4caf50 0deg 144deg, #ff9800 144deg 216deg, #f44336 216deg 288deg, #2196f3 288deg 360deg)',
              margin: '0 auto 20px'
            }}></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', textAlign: 'left' }}>
              <div><span style={{ color: '#4caf50' }}>●</span> 工作邮件 40%</div>
              <div><span style={{ color: '#ff9800' }}>●</span> 客户邮件 20%</div>
              <div><span style={{ color: '#f44336' }}>●</span> 紧急邮件 20%</div>
              <div><span style={{ color: '#2196f3' }}>●</span> 其他邮件 20%</div>
            </div>
          </div>
        </div>
      </div>

      {/* 详细统计表格 */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <h3>📋 详细统计数据</h3>
        <div style={{ overflowX: 'auto', marginTop: '15px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>指标</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>今日</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>本周</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>本月</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>变化趋势</th>
              </tr>
            </thead>
            <tbody>
              {[
                { metric: '收到邮件', today: '23', week: '156', month: '687', trend: '+5.2%', color: '#4caf50' },
                { metric: '已处理邮件', today: '18', week: '142', month: '634', trend: '+3.8%', color: '#4caf50' },
                { metric: '平均响应时间', today: '2.3小时', week: '2.1小时', month: '2.5小时', trend: '-8.7%', color: '#4caf50' },
                { metric: '高优先级邮件', today: '5', week: '34', month: '142', trend: '+12.1%', color: '#f44336' },
                { metric: '自动化处理', today: '12', week: '89', month: '356', trend: '+15.3%', color: '#4caf50' }
              ].map((row, index) => (
                <tr key={index}>
                  <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>{row.metric}</td>
                  <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>{row.today}</td>
                  <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>{row.week}</td>
                  <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>{row.month}</td>
                  <td style={{ padding: '12px', borderBottom: '1px solid #eee', color: row.color, fontWeight: 'bold' }}>
                    {row.trend}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 报告操作 */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3>🔧 报告操作</h3>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '15px' }}>
          <button style={{
            backgroundColor: '#1976d2',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}>
            📄 导出PDF报告
          </button>
          <button style={{
            backgroundColor: '#4caf50',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}>
            📊 导出Excel数据
          </button>
          <button style={{
            backgroundColor: '#ff9800',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}>
            📧 邮件发送报告
          </button>
          <button style={{
            backgroundColor: '#9c27b0',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}>
            ⏰ 设置定期报告
          </button>
        </div>
      </div>
    </div>
  );

  // 渲染设置页面
  const renderSettings = () => (
    <div>
      <h2>⚙️ 系统设置</h2>

      {/* 账户设置 */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <h3>👤 账户设置</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>用户名</label>
            <input
              type="text"
              defaultValue="admin@company.com"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '5px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>显示名称</label>
            <input
              type="text"
              defaultValue="系统管理员"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '5px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>时区</label>
            <select style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '5px'
            }}>
              <option>Asia/Shanghai (UTC+8)</option>
              <option>Asia/Tokyo (UTC+9)</option>
              <option>America/New_York (UTC-5)</option>
              <option>Europe/London (UTC+0)</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>语言</label>
            <select style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '5px'
            }}>
              <option>中文简体</option>
              <option>English</option>
              <option>日本語</option>
              <option>한국어</option>
            </select>
          </div>
        </div>
      </div>

      {/* 邮件设置 */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <h3>📧 邮件设置</h3>
        <div style={{ marginTop: '15px' }}>
          {[
            { name: '自动标记已读', desc: '阅读邮件后自动标记为已读', checked: true },
            { name: '智能分类', desc: '自动对邮件进行AI分类', checked: true },
            { name: '实时同步', desc: '实时同步邮件服务器数据', checked: false },
            { name: '桌面通知', desc: '接收到重要邮件时显示桌面通知', checked: true },
            { name: '邮件预览', desc: '在列表中显示邮件预览内容', checked: true }
          ].map((setting, index) => (
            <div key={index} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 0',
              borderBottom: index < 4 ? '1px solid #eee' : 'none'
            }}>
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{setting.name}</div>
                <div style={{ color: '#666', fontSize: '14px' }}>{setting.desc}</div>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '24px' }}>
                <input type="checkbox" defaultChecked={setting.checked} style={{ opacity: 0, width: 0, height: 0 }} />
                <span style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: setting.checked ? '#4caf50' : '#ccc',
                  borderRadius: '24px',
                  transition: '0.4s'
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '',
                    height: '18px',
                    width: '18px',
                    left: setting.checked ? '26px' : '3px',
                    bottom: '3px',
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    transition: '0.4s'
                  }}></span>
                </span>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* AI设置 */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <h3>🤖 AI智能设置</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>AI分析频率</label>
            <select style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '5px'
            }}>
              <option>实时分析</option>
              <option>每小时一次</option>
              <option>每日一次</option>
              <option>手动触发</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>情感分析敏感度</label>
            <input
              type="range"
              min="1"
              max="10"
              defaultValue="7"
              style={{
                width: '100%',
                marginTop: '10px'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666' }}>
              <span>低</span>
              <span>中</span>
              <span>高</span>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>自动回复模板</label>
            <textarea
              placeholder="设置AI自动回复模板..."
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '5px',
                minHeight: '80px',
                resize: 'vertical'
              }}
            />
          </div>
        </div>
      </div>

      {/* 保存设置 */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <button style={{
            backgroundColor: '#4caf50',
            color: 'white',
            padding: '12px 25px',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}>
            💾 保存设置
          </button>
          <button style={{
            backgroundColor: '#ff9800',
            color: 'white',
            padding: '12px 25px',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}>
            🔄 重置为默认
          </button>
          <button style={{
            backgroundColor: '#f44336',
            color: 'white',
            padding: '12px 25px',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}>
            📤 导出配置
          </button>
          <button
            onClick={() => setCurrentPage('dashboard')}
            style={{
              backgroundColor: '#9e9e9e',
              color: 'white',
              padding: '12px 25px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            返回仪表板
          </button>
        </div>
      </div>
    </div>
  );

  // 渲染其他页面
  const renderOtherPage = (title: string, content: string) => (
    <div>
      <h2>{title}</h2>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <h3>{content}</h3>
        <p style={{ color: '#666', marginTop: '20px' }}>
          这个功能正在开发中，敬请期待！
        </p>
        <button
          onClick={() => setCurrentPage('dashboard')}
          style={{
            backgroundColor: '#1976d2',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            marginTop: '20px'
          }}
        >
          返回仪表板
        </button>
      </div>
    </div>
  );

  // 根据当前页面渲染内容
  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return renderDashboard();
      case 'emails':
        return renderEmails();
      case 'analysis':
        return renderAnalysis();
      case 'filters':
        return renderFilters();
      case 'reports':
        return renderReports();
      case 'settings':
        return renderSettings();
      default:
        return renderDashboard();
    }
  };

  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      padding: '20px',
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    }}>
      <header style={{
        backgroundColor: '#1976d2',
        color: 'white',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h1>📧 Email Assist - 智能邮件管理系统</h1>
        <p>v2.0 - 正常运行中 ✅ | 当前页面: {menuItems.find(item => item.id === currentPage)?.name}</p>
      </header>

      <div style={{ display: 'flex', gap: '20px' }}>
        {/* 侧边栏 */}
        <nav style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          width: '250px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          height: 'fit-content'
        }}>
          <h3>导航菜单</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {menuItems.map((item) => (
              <li
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                style={{
                  padding: '12px',
                  borderBottom: '1px solid #eee',
                  cursor: 'pointer',
                  backgroundColor: currentPage === item.id ? '#e3f2fd' : 'transparent',
                  borderRadius: '5px',
                  marginBottom: '5px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (currentPage !== item.id) {
                    e.currentTarget.style.backgroundColor = '#f5f5f5';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPage !== item.id) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {item.name}
              </li>
            ))}
          </ul>
        </nav>

        {/* 主内容 */}
        <main style={{ flex: 1 }}>
          {renderContent()}
        </main>
      </div>

      <footer style={{
        textAlign: 'center',
        marginTop: '40px',
        padding: '20px',
        color: '#666'
      }}>
        <p>Email Assist v2.0 - 智能邮件管理系统 | 正常运行中 ✅</p>
      </footer>
    </div>
  );
};

export default App;