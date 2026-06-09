import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Drawer,
  Form,
  Input,
  Select,
  DatePicker,
  Tabs,
  message,
  Row,
  Col,
  Descriptions,
  Collapse,
  Badge,
  Empty,
  Spin
} from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  DownloadOutlined,
  FilterOutlined,
  CodeOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getLogs,
  getLogDetail,
  getExceptionAggregation
} from '../services/logService.js'
import { getApps } from '../services/appService.js'

const { RangePicker } = DatePicker
const { Option } = Select
const { Panel } = Collapse
const { TabPane } = Tabs

// 日志检索页面
function LogSearch() {
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [apps, setApps] = useState([])
  const [logs, setLogs] = useState([])
  const [exceptionGroups, setExceptionGroups] = useState([])
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [currentLog, setCurrentLog] = useState(null)
  const [activeTab, setActiveTab] = useState('list')
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  })
  const [exceptionPagination, setExceptionPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  })
  const [form] = Form.useForm()

  // 加载应用列表
  const loadApps = async () => {
    try {
      const response = await getApps()
      if (response && response.success) {
        setApps(response.data || [])
      }
    } catch (error) {
      console.error('加载应用列表失败:', error)
      message.error('加载应用列表失败')
    }
  }

  // 格式化时间为 API 所需格式
  const formatTime = (date) => {
    return date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : null
  }

  // 字段映射：snake_case 转 camelCase 用于显示
  const mapLogFields = (log) => {
    const app = apps.find(a => a.id === log.app_id)
    return {
      ...log,
      appName: app ? app.name : log.app_id,
      stackTrace: log.stack_trace,
      exceptionType: log.exception_type,
      exceptionHash: log.exception_hash,
      extra: log.metadata,
      level: (log.level || '').toLowerCase()
    }
  }

  // 字段映射：异常聚合数据
  const mapExceptionFields = (exception) => {
    const app = apps.find(a => a.id === exception.app_id)
    return {
      ...exception,
      type: exception.exception_type,
      appName: app ? app.name : exception.app_id,
      lastOccurrence: exception.last_seen,
      firstOccurrence: exception.first_seen,
      samples: exception.sample_log ? [exception.sample_log] : []
    }
  }

  // 获取搜索参数
  const getSearchParams = (values) => {
    const params = {}
    if (values.app_id) params.app_id = values.app_id
    if (values.timeRange && values.timeRange.length === 2) {
      params.start_time = formatTime(values.timeRange[0])
      params.end_time = formatTime(values.timeRange[1])
    }
    if (values.keyword) params.keyword = values.keyword
    if (values.level && values.level.length > 0) params.level = values.level.join(',')
    if (values.source && values.source.length > 0) params.source = values.source.join(',')
    return params
  }

  // 加载日志列表
  const loadLogs = async (page = 1, pageSize = 20, filters = {}) => {
    setLoading(true)
    try {
      const values = form.getFieldsValue()
      const params = {
        ...getSearchParams(values),
        ...filters,
        page,
        page_size: pageSize
      }

      const response = await getLogs(params)
      if (response && response.success) {
        const data = response.data || { list: [], total: 0 }
        const mappedList = (data.list || []).map(mapLogFields)
        setLogs(mappedList)
        setPagination(prev => ({
          ...prev,
          current: data.page || page,
          pageSize: data.page_size || pageSize,
          total: data.total || 0
        }))
      } else {
        setLogs([])
        setPagination(prev => ({
          ...prev,
          current: page,
          pageSize,
          total: 0
        }))
      }
    } catch (error) {
      console.error('加载日志失败:', error)
      message.error('加载日志失败')
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  // 加载异常聚合数据
  const loadExceptions = async (page = 1, pageSize = 20) => {
    setLoading(true)
    try {
      const values = form.getFieldsValue()
      const params = {
        app_id: values.app_id,
        start_time: values.timeRange && values.timeRange.length === 2 ? formatTime(values.timeRange[0]) : null,
        end_time: values.timeRange && values.timeRange.length === 2 ? formatTime(values.timeRange[1]) : null,
        page,
        page_size: pageSize
      }

      const response = await getExceptionAggregation(params)
      if (response && response.success) {
        const data = response.data || { list: [], total: 0 }
        const mappedList = (data.list || []).map(mapExceptionFields)
        setExceptionGroups(mappedList)
        setExceptionPagination(prev => ({
          ...prev,
          current: page,
          pageSize,
          total: data.total || 0
        }))
      } else {
        setExceptionGroups([])
        setExceptionPagination(prev => ({
          ...prev,
          current: page,
          pageSize,
          total: 0
        }))
      }
    } catch (error) {
      console.error('加载异常聚合数据失败:', error)
      message.error('加载异常聚合数据失败')
      setExceptionGroups([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadApps()
  }, [])

  useEffect(() => {
    if (apps.length > 0) {
      if (activeTab === 'list') {
        loadLogs()
      } else if (activeTab === 'exceptions') {
        loadExceptions()
      }
    }
  }, [activeTab, apps])

  // 搜索日志
  const handleSearch = async () => {
    try {
      const values = await form.validateFields()
      console.log('搜索条件:', values)
      if (activeTab === 'list') {
        loadLogs(1, pagination.pageSize)
      } else if (activeTab === 'exceptions') {
        loadExceptions(1, exceptionPagination.pageSize)
      }
    } catch (error) {
      console.error('搜索失败:', error)
    }
  }

  // 重置搜索条件
  const handleReset = () => {
    form.resetFields()
    if (activeTab === 'list') {
      loadLogs()
    } else if (activeTab === 'exceptions') {
      loadExceptions()
    }
  }

  // 查看日志详情
  const handleViewDetail = async (log) => {
    setDetailLoading(true)
    setDrawerVisible(true)
    try {
      const response = await getLogDetail(log.id)
      if (response && response.success) {
        const mappedLog = mapLogFields(response.data)
        setCurrentLog(mappedLog)
      } else {
        setCurrentLog(log)
      }
    } catch (error) {
      console.error('加载日志详情失败:', error)
      message.error('加载日志详情失败')
      setCurrentLog(log)
    } finally {
      setDetailLoading(false)
    }
  }

  // 导出日志
  const handleExport = async () => {
    try {
      const values = form.getFieldsValue()
      const params = getSearchParams(values)
      message.success('日志导出功能已触发')
      console.log('导出参数:', params)
    } catch (error) {
      console.error('导出日志失败:', error)
      message.error('导出日志失败')
    }
  }

  // 分页变化
  const handleTableChange = (pag) => {
    loadLogs(pag.current, pag.pageSize)
  }

  // 异常分页变化
  const handleExceptionTableChange = (pag) => {
    loadExceptions(pag.current, pag.pageSize)
  }

  // 日志级别颜色映射
  const getLevelColor = (level) => {
    const colorMap = {
      debug: 'blue',
      info: 'green',
      warn: 'orange',
      error: 'red',
      fatal: 'red'
    }
    return colorMap[level] || 'default'
  }

  // 日志列表列配置
  const columns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      fixed: 'left'
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (level) => (
        <Tag color={getLevelColor(level)}>
          {level && level.toUpperCase()}
        </Tag>
      )
    },
    {
      title: '应用',
      dataIndex: 'appName',
      key: 'appName',
      width: 120
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 100,
      render: (source) => <Tag>{source}</Tag>
    },
    {
      title: '异常类型',
      dataIndex: 'exceptionType',
      key: 'exceptionType',
      width: 200,
      render: (type) => type ? (
        <span style={{ fontFamily: 'monospace', color: '#f5222d', fontSize: 12 }}>
          {type}
        </span>
      ) : null
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}
          size="small"
        >
          详情
        </Button>
      )
    }
  ]

  // 异常聚合列配置
  const exceptionColumns = [
    {
      title: '异常类型',
      dataIndex: 'type',
      key: 'type',
      width: 250,
      render: (text) => (
        <span style={{ fontFamily: 'monospace', color: '#f5222d', fontWeight: 'bold' }}>
          {text}
        </span>
      )
    },
    {
      title: '应用',
      dataIndex: 'appName',
      key: 'appName',
      width: 120
    },
    {
      title: '出现次数',
      dataIndex: 'count',
      key: 'count',
      width: 120,
      render: (count) => <Badge count={count} showZero color="#f5222d" />
    },
    {
      title: '首次发生',
      dataIndex: 'firstOccurrence',
      key: 'firstOccurrence',
      width: 180
    },
    {
      title: '最近发生',
      dataIndex: 'lastOccurrence',
      key: 'lastOccurrence',
      width: 180
    }
  ]

  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: 16 }}>日志检索</h2>

      {/* 高级筛选区 */}
      <Card style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="app_id" label="应用">
                <Select
                  placeholder="请选择应用"
                  allowClear
                  showSearch
                  optionFilterProp="children"
                >
                  {apps.map(app => (
                    <Option key={app.id} value={app.id}>
                      {app.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="timeRange" label="时间范围">
                <RangePicker
                  showTime
                  style={{ width: '100%' }}
                  placeholder={['开始时间', '结束时间']}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="level" label="日志级别">
                <Select
                  placeholder="请选择级别"
                  allowClear
                  mode="multiple"
                >
                  <Option value="debug">DEBUG</Option>
                  <Option value="info">INFO</Option>
                  <Option value="warn">WARN</Option>
                  <Option value="error">ERROR</Option>
                  <Option value="fatal">FATAL</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="source" label="来源">
                <Select
                  placeholder="请选择来源"
                  allowClear
                  mode="multiple"
                >
                  <Option value="api">API</Option>
                  <Option value="cron">定时任务</Option>
                  <Option value="mq">消息队列</Option>
                  <Option value="database">数据库</Option>
                  <Option value="cache">缓存</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={18}>
              <Form.Item name="keyword" label="关键词">
                <Input
                  placeholder="请输入搜索关键词，支持模糊匹配"
                  prefix={<SearchOutlined />}
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={6} style={{ display: 'flex', alignItems: 'flex-end' }}>
              <Form.Item style={{ width: '100%', marginBottom: 24 }}>
                <Space>
                  <Button
                    type="primary"
                    icon={<SearchOutlined />}
                    onClick={handleSearch}
                  >
                    搜索
                  </Button>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={handleReset}
                  >
                    重置
                  </Button>
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={handleExport}
                  >
                    导出
                  </Button>
                </Space>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      {/* Tab 切换 */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'list',
              label: (
                <span>
                  <FilterOutlined />
                  日志列表
                </span>
              ),
              children: (
                <Table
                  columns={columns}
                  dataSource={logs}
                  rowKey="id"
                  loading={loading}
                  scroll={{ x: 1400 }}
                  locale={{
                    emptyText: <Empty description="暂无日志数据" />
                  }}
                  pagination={{
                    ...pagination,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total) => `共 ${total} 条记录`
                  }}
                  onChange={handleTableChange}
                />
              )
            },
            {
              key: 'exceptions',
              label: (
                <span>
                  <CodeOutlined />
                  异常聚合
                </span>
              ),
              children: (
                <div>
                  <Table
                    columns={exceptionColumns}
                    dataSource={exceptionGroups}
                    rowKey="exception_hash"
                    loading={loading}
                    locale={{
                      emptyText: <Empty description="暂无异常数据" />
                    }}
                    expandable={{
                      expandedRowRender: (record) => (
                        <Collapse>
                          {record.samples && record.samples.length > 0 ? (
                            record.samples.map((sample, index) => (
                              <Panel
                                header={`样例 ${index + 1}: ${sample.timestamp}`}
                                key={index}
                              >
                                <p>{sample.message}</p>
                              </Panel>
                            ))
                          ) : (
                            <Empty description="暂无样例数据" />
                          )}
                        </Collapse>
                      ),
                      rowExpandable: (record) => record.samples && record.samples.length > 0
                    }}
                    pagination={{
                      ...exceptionPagination,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total) => `共 ${total} 条记录`
                    }}
                    onChange={handleExceptionTableChange}
                  />
                </div>
              )
            }
          ]}
        />
      </Card>

      {/* 日志详情抽屉 */}
      <Drawer
        title="日志详情"
        width={720}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        extra={
          <Space>
            <Button onClick={() => setDrawerVisible(false)}>关闭</Button>
          </Space>
        }
      >
        <Spin spinning={detailLoading} tip="加载中...">
          {currentLog && (
            <div>
              <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
                <Descriptions.Item label="时间" span={2}>
                  {currentLog.timestamp}
                </Descriptions.Item>
                <Descriptions.Item label="级别">
                  <Tag color={getLevelColor(currentLog.level)}>
                    {currentLog.level && currentLog.level.toUpperCase()}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="应用">{currentLog.appName}</Descriptions.Item>
                <Descriptions.Item label="来源">{currentLog.source}</Descriptions.Item>
                {currentLog.exceptionType && (
                  <Descriptions.Item label="异常类型" span={2}>
                    <span style={{ fontFamily: 'monospace', color: '#f5222d' }}>
                      {currentLog.exceptionType}
                    </span>
                  </Descriptions.Item>
                )}
                {currentLog.exceptionHash && (
                  <Descriptions.Item label="异常哈希" span={2}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                      {currentLog.exceptionHash}
                    </span>
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="消息" span={2}>
                  {currentLog.message}
                </Descriptions.Item>
              </Descriptions>

              {currentLog.stackTrace && (
                <div style={{ marginBottom: 16 }}>
                  <h4 style={{ marginTop: 0, marginBottom: 8 }}>堆栈信息</h4>
                  <pre
                    style={{
                      background: '#f5f5f5',
                      padding: 16,
                      borderRadius: 4,
                      overflow: 'auto',
                      maxHeight: 300,
                      fontSize: 12,
                      color: '#f5222d'
                    }}
                  >
                    {currentLog.stackTrace}
                  </pre>
                </div>
              )}

              {currentLog.extra && (
                <div>
                  <h4 style={{ marginTop: 0, marginBottom: 8 }}>扩展信息</h4>
                  <pre
                    style={{
                      background: '#f5f5f5',
                      padding: 16,
                      borderRadius: 4,
                      overflow: 'auto',
                      fontSize: 12
                    }}
                  >
                    {typeof currentLog.extra === 'string' 
                      ? currentLog.extra 
                      : JSON.stringify(currentLog.extra, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </Spin>
      </Drawer>
    </div>
  )
}

export default LogSearch
