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
  CodeOutlined,
  BugOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getLogs,
  getLogDetail,
  getExceptionAggregation,
  exportLogs,
  getExceptionSamples,
  exportExceptions
} from '../services/logService.js'
import { getApps } from '../services/appService.js'
import TroubleshootingDrawer from '../components/TroubleshootingDrawer.jsx'

const { RangePicker } = DatePicker
const { Option } = Select

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
  const [exporting, setExporting] = useState(false)
  const [exceptionTypes, setExceptionTypes] = useState([])
  const [expandedRowKeys, setExpandedRowKeys] = useState([])
  const [exceptionSamples, setExceptionSamples] = useState({})
  const [samplesLoading, setSamplesLoading] = useState({})
  const [troubleshootingDrawerVisible, setTroubleshootingDrawerVisible] = useState(false)
  const [troubleshootingContext, setTroubleshootingContext] = useState(null)

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
    const metadata = log.metadata || {}
    const traceId = typeof metadata === 'string' 
      ? (() => {
          try {
            return JSON.parse(metadata).traceId
          } catch {
            return null
          }
        })()
      : metadata.traceId
    return {
      ...log,
      appName: app ? app.name : log.app_id,
      stackTrace: log.stack_trace,
      exceptionType: log.exception_type,
      exceptionHash: log.exception_hash,
      extra: log.metadata,
      level: (log.level || '').toLowerCase(),
      traceId
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
      samples: exception.sample_logs || []
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
    if (values.exception_type) params.exception_type = values.exception_type
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
        ...getSearchParams(values),
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
        
        // 提取所有异常类型去重
        const types = [...new Set(mappedList.map(item => item.exception_type).filter(Boolean))]
        setExceptionTypes(types)
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

  // 加载异常样例日志
  const loadExceptionSamples = async (exceptionHash) => {
    if (exceptionSamples[exceptionHash]) {
      return
    }
    
    setSamplesLoading(prev => ({ ...prev, [exceptionHash]: true }))
    try {
      const response = await getExceptionSamples(exceptionHash, 3)
      if (response && response.success) {
        const samples = (response.data || []).map(mapLogFields)
        setExceptionSamples(prev => ({ ...prev, [exceptionHash]: samples }))
      }
    } catch (error) {
      console.error('加载异常样例失败:', error)
    } finally {
      setSamplesLoading(prev => ({ ...prev, [exceptionHash]: false }))
    }
  }

  // 处理展开行
  const handleExpand = async (expanded, record) => {
    if (expanded) {
      setExpandedRowKeys([record.exception_hash])
      await loadExceptionSamples(record.exception_hash)
    } else {
      setExpandedRowKeys([])
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

  // 打开排障工作台
  const handleOpenTroubleshooting = (log) => {
    setTroubleshootingContext({
      logId: log.id,
      exceptionHash: log.exceptionHash,
      traceId: log.traceId,
      appId: log.app_id,
      appName: log.appName,
      logMessage: log.message
    })
    setTroubleshootingDrawerVisible(true)
  }

  // 从异常聚合打开排障工作台
  const handleOpenTroubleshootingFromException = (exception) => {
    setTroubleshootingContext({
      logId: null,
      exceptionHash: exception.exception_hash,
      traceId: null,
      appId: exception.app_id,
      appName: exception.appName,
      logMessage: exception.exception_type
    })
    setTroubleshootingDrawerVisible(true)
  }

  // 导出日志
  const handleExport = async () => {
    setExporting(true)
    const hideLoading = message.loading('正在导出日志，请稍候...', 0)
    try {
      const values = form.getFieldsValue()
      const params = getSearchParams(values)
      
      const blob = await exportLogs(params)
      
      if (blob) {
        const url = window.URL.createObjectURL(new Blob([blob]))
        const link = document.createElement('a')
        link.href = url
        const timestamp = dayjs().format('YYYYMMDD_HHmmss')
        link.setAttribute('download', `logs_export_${timestamp}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        
        const size = blob.size || 0
        const estimatedCount = Math.floor(size / 500)
        message.success(`导出成功，共 ${estimatedCount} 条记录`)
      }
    } catch (error) {
      console.error('导出日志失败:', error)
      message.error('导出日志失败')
    } finally {
      hideLoading()
      setExporting(false)
    }
  }

  // 导出异常聚合数据
  const handleExportExceptions = async () => {
    setExporting(true)
    const hideLoading = message.loading('正在导出异常数据，请稍候...', 0)
    try {
      const values = form.getFieldsValue()
      const params = getSearchParams(values)
      
      const blob = await exportExceptions(params)
      
      if (blob) {
        const url = window.URL.createObjectURL(new Blob([blob]))
        const link = document.createElement('a')
        link.href = url
        const timestamp = dayjs().format('YYYYMMDD_HHmmss')
        link.setAttribute('download', `exceptions_export_${timestamp}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        
        const size = blob.size || 0
        const estimatedCount = Math.floor(size / 300)
        message.success(`导出成功，共 ${estimatedCount} 条记录`)
      }
    } catch (error) {
      console.error('导出异常数据失败:', error)
      message.error('导出异常数据失败')
    } finally {
      hideLoading()
      setExporting(false)
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
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
            size="small"
          >
            详情
          </Button>
          <Button
            type="link"
            icon={<BugOutlined />}
            onClick={() => handleOpenTroubleshooting(record)}
            size="small"
            danger
          >
            排障
          </Button>
        </Space>
      )
    }
  ]

  // 渲染异常聚合展开内容
  const renderExpandedRow = (record) => {
    const samples = exceptionSamples[record.exception_hash] || record.samples || []
    const isLoading = samplesLoading[record.exception_hash]
    
    return (
      <div style={{ padding: '0 24px' }}>
        <Spin spinning={isLoading} tip="加载样例日志中...">
          <Descriptions 
            bordered 
            column={2} 
            size="small" 
            style={{ marginBottom: 16 }}
            title="基本信息"
          >
            <Descriptions.Item label="异常哈希" span={2}>
              <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                {record.exception_hash}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="异常类型">
              <span style={{ fontFamily: 'monospace', color: '#f5222d' }}>
                {record.exception_type}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="所属应用">
              {record.appName}
            </Descriptions.Item>
            <Descriptions.Item label="首次出现">
              {record.first_seen}
            </Descriptions.Item>
            <Descriptions.Item label="最后出现">
              {record.last_seen}
            </Descriptions.Item>
            <Descriptions.Item label="出现次数">
              <Badge count={record.count} showZero color="#f5222d" />
            </Descriptions.Item>
            <Descriptions.Item label="来源列表" span={2}>
              {record.sources && record.sources.length > 0 ? (
                <Space wrap>
                  {record.sources.map((source, idx) => (
                    <Tag key={idx}>{source}</Tag>
                  ))}
                </Space>
              ) : (
                <span style={{ color: '#999' }}>无</span>
              )}
            </Descriptions.Item>
          </Descriptions>

          <h4 style={{ marginTop: 0, marginBottom: 12 }}>最近 3 条样例日志</h4>
          {samples.length > 0 ? (
            samples.map((sample, index) => (
              <Card 
                key={index} 
                size="small" 
                style={{ marginBottom: 12, background: '#fafafa' }}
                title={`样例 ${index + 1}`}
              >
                <Descriptions bordered column={2} size="small">
                  <Descriptions.Item label="时间">
                    {sample.timestamp}
                  </Descriptions.Item>
                  <Descriptions.Item label="级别">
                    <Tag color={getLevelColor(sample.level)}>
                      {sample.level && sample.level.toUpperCase()}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="消息" span={2}>
                    {sample.message}
                  </Descriptions.Item>
                  {sample.stackTrace && (
                    <Descriptions.Item label="堆栈跟踪" span={2}>
                      <pre
                        style={{
                          background: '#fff2f0',
                          padding: 12,
                          borderRadius: 4,
                          overflow: 'auto',
                          maxHeight: 200,
                          fontSize: 12,
                          color: '#f5222d',
                          margin: 0,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all'
                        }}
                      >
                        {sample.stackTrace}
                      </pre>
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Card>
            ))
          ) : (
            <Empty description="暂无样例日志" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Spin>
      </div>
    )
  }

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
      title: '所属应用',
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
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Button
          type="link"
          icon={<BugOutlined />}
          onClick={() => handleOpenTroubleshootingFromException(record)}
          size="small"
          danger
        >
          排障
        </Button>
      )
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
            {activeTab === 'exceptions' && (
              <Col xs={24} sm={12} md={6}>
                <Form.Item name="exception_type" label="异常类型">
                  <Select
                    placeholder="请选择异常类型"
                    allowClear
                    showSearch
                    optionFilterProp="children"
                  >
                    {exceptionTypes.map(type => (
                      <Option key={type} value={type}>
                        {type}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            )}
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
                    loading={exporting}
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
                      expandedRowRender: renderExpandedRow,
                      onExpand: handleExpand,
                      expandedRowKeys: expandedRowKeys,
                      rowExpandable: () => true
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
                {currentLog.traceId && (
                  <Descriptions.Item label="Trace ID" span={2}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#1890ff' }}>
                      {currentLog.traceId}
                    </span>
                  </Descriptions.Item>
                )}
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
                  <h4 style={{ marginTop: 0, marginBottom: 8 }}>堆栈跟踪</h4>
                  <pre
                    style={{
                      background: '#fff2f0',
                      padding: 16,
                      borderRadius: 4,
                      overflow: 'auto',
                      maxHeight: 300,
                      fontSize: 12,
                      color: '#f5222d',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all'
                    }}
                  >
                    {currentLog.stackTrace}
                  </pre>
                </div>
              )}

              {currentLog.extra && (
                <div>
                  <h4 style={{ marginTop: 0, marginBottom: 8 }}>Metadata</h4>
                  <pre
                    style={{
                      background: '#f5f5f5',
                      padding: 16,
                      borderRadius: 4,
                      overflow: 'auto',
                      fontSize: 12,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all'
                    }}
                  >
                    {(() => {
                      try {
                        const metadata = typeof currentLog.extra === 'string' 
                          ? JSON.parse(currentLog.extra) 
                          : currentLog.extra
                        return JSON.stringify(metadata, null, 2)
                      } catch {
                        return typeof currentLog.extra === 'string' 
                          ? currentLog.extra 
                          : JSON.stringify(currentLog.extra, null, 2)
                      }
                    })()}
                  </pre>
                </div>
              )}
            </div>
          )}
        </Spin>
      </Drawer>

      {/* 排障工作台抽屉 */}
      <TroubleshootingDrawer
        open={troubleshootingDrawerVisible}
        onClose={() => setTroubleshootingDrawerVisible(false)}
        context={troubleshootingContext}
      />
    </div>
  )
}

export default LogSearch
