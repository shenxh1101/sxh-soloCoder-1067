import React, { useState, useEffect } from 'react'
import {
  Drawer,
  Tabs,
  Table,
  Timeline,
  Form,
  Input,
  Button,
  Space,
  Tag,
  Card,
  Descriptions,
  Spin,
  Empty,
  message,
  Modal,
  Select,
  Collapse,
  Row,
  Col,
  Statistic
} from 'antd'
import {
  BugOutlined,
  LineChartOutlined,
  BellOutlined,
  FileTextOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  SaveOutlined,
  CloseOutlined
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'
import {
  getTroubleshootingContext,
  getTraceLogs,
  getAppErrorTrend,
  getRelatedAlerts,
  getTroubleshootingNotes,
  createTroubleshootingNote,
  updateTroubleshootingNote,
  deleteTroubleshootingNote
} from '../services/troubleshootingService.js'
import { resolveAlert } from '../services/alertService.js'

const { TextArea } = Input
const { Option } = Select
const { Panel } = Collapse

// 排障工作台抽屉组件
function TroubleshootingDrawer({ open, onClose, context }) {
  const [loading, setLoading] = useState(false)
  const [traceLoading, setTraceLoading] = useState(false)
  const [trendLoading, setTrendLoading] = useState(false)
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [notesLoading, setNotesLoading] = useState(false)
  const [noteModalVisible, setNoteModalVisible] = useState(false)
  const [editingNote, setEditingNote] = useState(null)

  const [traceLogs, setTraceLogs] = useState([])
  const [errorTrend, setErrorTrend] = useState([])
  const [relatedAlerts, setRelatedAlerts] = useState([])
  const [notes, setNotes] = useState([])
  const [expandedLogKeys, setExpandedLogKeys] = useState([])
  const [noteForm] = Form.useForm()

  // 日志级别颜色映射
  const getLevelColor = (level) => {
    const colorMap = {
      debug: '#1890ff',
      info: '#52c41a',
      warn: '#faad14',
      error: '#ff4d4f',
      fatal: '#cf1322'
    }
    return colorMap[level] || '#8c8c8c'
  }

  // 加载排障上下文数据
  const loadContextData = async () => {
    if (!context || !context.appId) return

    setLoading(true)
    try {
      const params = {
        app_id: context.appId,
        log_id: context.logId,
        exception_hash: context.exceptionHash,
        trace_id: context.traceId
      }

      const response = await getTroubleshootingContext(params)
      if (response && response.success) {
        const data = response.data || {}
        setTraceLogs(data.trace_logs || [])
        setErrorTrend(data.error_trend || [])
        setRelatedAlerts(data.related_alerts || [])
      }
    } catch (error) {
      console.error('加载排障上下文失败:', error)
      message.error('加载排障上下文失败')
    } finally {
      setLoading(false)
    }
  }

  // 加载Trace日志
  const loadTraceLogs = async () => {
    if (!context?.traceId) {
      setTraceLogs([])
      return
    }

    setTraceLoading(true)
    try {
      const response = await getTraceLogs(context.traceId, context.appId)
      if (response && response.success) {
        setTraceLogs(response.data || [])
      }
    } catch (error) {
      console.error('加载Trace日志失败:', error)
      message.error('加载Trace日志失败')
    } finally {
      setTraceLoading(false)
    }
  }

  // 加载错误趋势
  const loadErrorTrend = async () => {
    if (!context?.appId) {
      setErrorTrend([])
      return
    }

    setTrendLoading(true)
    try {
      const response = await getAppErrorTrend(context.appId, 24)
      if (response && response.success) {
        setErrorTrend(response.data || [])
      }
    } catch (error) {
      console.error('加载错误趋势失败:', error)
      message.error('加载错误趋势失败')
    } finally {
      setTrendLoading(false)
    }
  }

  // 加载相关告警
  const loadRelatedAlerts = async () => {
    if (!context?.appId) {
      setRelatedAlerts([])
      return
    }

    setAlertsLoading(true)
    try {
      const params = {
        app_id: context.appId,
        log_id: context.logId,
        exception_hash: context.exceptionHash,
        trace_id: context.traceId,
        limit: 20
      }
      const response = await getRelatedAlerts(params)
      if (response && response.success) {
        setRelatedAlerts(response.data || [])
      }
    } catch (error) {
      console.error('加载相关告警失败:', error)
      message.error('加载相关告警失败')
    } finally {
      setAlertsLoading(false)
    }
  }

  // 加载排障备注
  const loadNotes = async () => {
    if (!context?.appId) {
      setNotes([])
      return
    }

    setNotesLoading(true)
    try {
      const params = {
        app_id: context.appId,
        log_id: context.logId,
        exception_hash: context.exceptionHash,
        trace_id: context.traceId,
        page_size: 100
      }
      const response = await getTroubleshootingNotes(params)
      if (response && response.success) {
        const data = response.data || {}
        setNotes(data.list || [])
      }
    } catch (error) {
      console.error('加载排障备注失败:', error)
      message.error('加载排障备注失败')
    } finally {
      setNotesLoading(false)
    }
  }

  // 抽屉打开时加载数据
  useEffect(() => {
    if (open && context) {
      loadContextData()
      loadNotes()
    }
  }, [open, context])

  // 处理新增备注
  const handleAddNote = () => {
    setEditingNote(null)
    noteForm.resetFields()
    noteForm.setFieldsValue({
      status: 'pending'
    })
    setNoteModalVisible(true)
  }

  // 处理编辑备注
  const handleEditNote = (note) => {
    setEditingNote(note)
    noteForm.setFieldsValue({
      title: note.title,
      content: note.content,
      assignee: note.assignee,
      status: note.status
    })
    setNoteModalVisible(true)
  }

  // 处理删除备注
  const handleDeleteNote = async (id) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条排障备注吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteTroubleshootingNote(id)
          message.success('删除成功')
          loadNotes()
        } catch (error) {
          console.error('删除备注失败:', error)
          message.error('删除失败')
        }
      }
    })
  }

  // 处理保存备注
  const handleSaveNote = async () => {
    try {
      const values = await noteForm.validateFields()

      // 构建metadata，包含上下文快照
      const metadata = {
        context_snapshot: {
          log_id: context.logId,
          exception_hash: context.exceptionHash,
          trace_id: context.traceId,
          app_id: context.appId,
          app_name: context.appName,
          log_message: context.logMessage,
          trace_logs_count: traceLogs.length,
          related_alerts_count: relatedAlerts.length,
          error_trend_summary: errorTrend.reduce((acc, item) => ({
            total_errors: acc.total_errors + (item.error_count || 0),
            total_fatal: acc.total_fatal + (item.fatal_count || 0)
          }), { total_errors: 0, total_fatal: 0 })
        }
      }

      const noteData = {
        ...values,
        app_id: context.appId,
        log_id: context.logId,
        exception_hash: context.exceptionHash,
        trace_id: context.traceId,
        metadata
      }

      if (editingNote) {
        await updateTroubleshootingNote(editingNote.id, noteData)
        message.success('更新成功')
      } else {
        await createTroubleshootingNote(noteData)
        message.success('创建成功')
      }

      setNoteModalVisible(false)
      loadNotes()
    } catch (error) {
      console.error('保存备注失败:', error)
      if (error.errorFields) {
        return
      }
      message.error('保存失败')
    }
  }

  // 处理告警解决
  const handleResolveAlert = async (id) => {
    Modal.confirm({
      title: '确认解决',
      content: '确定要将此告警标记为已解决吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await resolveAlert(id)
          message.success('告警已标记为已解决')
          loadRelatedAlerts()
        } catch (error) {
          console.error('解决告警失败:', error)
          message.error('操作失败')
        }
      }
    })
  }

  // 处理日志展开/收起
  const handleLogExpand = (logId) => {
    setExpandedLogKeys(prev => {
      if (prev.includes(logId)) {
        return prev.filter(key => key !== logId)
      } else {
        return [...prev, logId]
      }
    })
  }

  // 获取错误趋势图表配置
  const getTrendChartOption = () => {
    const times = errorTrend.map(item => item.time || item.hour || '')
    const errorCounts = errorTrend.map(item => item.error_count || 0)
    const fatalCounts = errorTrend.map(item => item.fatal_count || 0)

    return {
      tooltip: {
        trigger: 'axis'
      },
      legend: {
        data: ['错误数', '致命错误数']
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: times
      },
      yAxis: {
        type: 'value',
        minInterval: 1
      },
      series: [
        {
          name: '错误数',
          type: 'line',
          smooth: true,
          data: errorCounts,
          itemStyle: {
            color: '#faad14'
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(250, 173, 20, 0.3)' },
                { offset: 1, color: 'rgba(250, 173, 20, 0.05)' }
              ]
            }
          }
        },
        {
          name: '致命错误数',
          type: 'bar',
          data: fatalCounts,
          itemStyle: {
            color: '#ff4d4f'
          },
          barWidth: 20
        }
      ]
    }
  }

  // 告警状态颜色映射
  const getAlertStatusColor = (status) => {
    const colorMap = {
      pending: 'red',
      processing: 'orange',
      resolved: 'green',
      ignored: 'default'
    }
    return colorMap[status] || 'default'
  }

  // 告警状态文本映射
  const getAlertStatusText = (status) => {
    const textMap = {
      pending: '待处理',
      processing: '处理中',
      resolved: '已解决',
      ignored: '已忽略'
    }
    return textMap[status] || status
  }

  // 备注状态颜色映射
  const getNoteStatusColor = (status) => {
    const colorMap = {
      pending: 'red',
      processing: 'orange',
      resolved: 'green'
    }
    return colorMap[status] || 'default'
  }

  // 备注状态文本映射
  const getNoteStatusText = (status) => {
    const textMap = {
      pending: '待处理',
      processing: '处理中',
      resolved: '已解决'
    }
    return textMap[status] || status
  }

  // 调用链日志列配置
  const traceColumns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180
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
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 120
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true
    }
  ]

  // 相关告警列配置
  const alertColumns = [
    {
      title: '触发时间',
      dataIndex: 'trigger_time',
      key: 'trigger_time',
      width: 180
    },
    {
      title: '规则名称',
      dataIndex: 'rule_name',
      key: 'rule_name',
      width: 200
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={getAlertStatusColor(status)}>
          {getAlertStatusText(status)}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          {record.status !== 'resolved' && (
            <Button
              type="link"
              size="small"
              onClick={() => handleResolveAlert(record.id)}
            >
              标记解决
            </Button>
          )}
        </Space>
      )
    }
  ]

  // 渲染时间轴样式的调用链日志
  const renderTraceTimeline = () => {
    if (traceLogs.length === 0) {
      return <Empty description="暂无Trace日志数据" />
    }

    const sortedLogs = [...traceLogs].sort((a, b) => {
      return new Date(a.timestamp) - new Date(b.timestamp)
    })

    return (
      <Timeline
        mode="left"
        items={sortedLogs.map((log, index) => ({
          color: getLevelColor(log.level),
          label: (
            <div style={{ minWidth: 180 }}>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                {log.timestamp}
              </div>
              <Tag
                color={getLevelColor(log.level)}
                style={{ marginTop: 4 }}
              >
                {log.level && log.level.toUpperCase()}
              </Tag>
            </div>
          ),
          children: (
            <Card
              size="small"
              style={{ marginBottom: 8 }}
              onClick={() => handleLogExpand(log.id || index)}
              hoverable
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start' 
              }}>
                <div style={{ flex: 1, marginRight: 16 }}>
                  <div style={{ fontWeight: 500, marginBottom: 4 }}>
                    [{log.source || 'unknown'}] {log.message}
                  </div>
                  {log.exception_type && (
                    <div style={{ 
                      color: '#ff4d4f', 
                      fontFamily: 'monospace', 
                      fontSize: 12 
                    }}>
                      {log.exception_type}
                    </div>
                  )}
                </div>
              </div>

              {expandedLogKeys.includes(log.id || index) && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                  <Descriptions bordered column={1} size="small">
                    {log.trace_id && (
                      <Descriptions.Item label="Trace ID">
                        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                          {log.trace_id}
                        </span>
                      </Descriptions.Item>
                    )}
                    {log.span_id && (
                      <Descriptions.Item label="Span ID">
                        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                          {log.span_id}
                        </span>
                      </Descriptions.Item>
                    )}
                    {log.stack_trace && (
                      <Descriptions.Item label="堆栈跟踪">
                        <pre
                          style={{
                            background: '#fff2f0',
                            padding: 12,
                            borderRadius: 4,
                            overflow: 'auto',
                            maxHeight: 200,
                            fontSize: 12,
                            color: '#ff4d4f',
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all'
                          }}
                        >
                          {log.stack_trace}
                        </pre>
                      </Descriptions.Item>
                    )}
                    {log.metadata && (
                      <Descriptions.Item label="Metadata">
                        <pre
                          style={{
                            background: '#f5f5f5',
                            padding: 12,
                            borderRadius: 4,
                            overflow: 'auto',
                            maxHeight: 200,
                            fontSize: 12,
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all'
                          }}
                        >
                          {typeof log.metadata === 'string' 
                            ? log.metadata 
                            : JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </div>
              )}
            </Card>
          )
        }))}
      />
    )
  }

  // 渲染排障备注列表
  const renderNotesList = () => {
    if (notes.length === 0) {
      return (
        <Empty 
          description="暂无排障备注" 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddNote}>
            新增备注
          </Button>
        </Empty>
      )
    }

    return (
      <div>
        <div style={{ marginBottom: 16, textAlign: 'right' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddNote}>
            新增备注
          </Button>
        </div>
        <Collapse defaultActiveKey={notes.map(n => n.id)}>
          {notes.map(note => (
            <Panel
              key={note.id}
              header={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space>
                    <span style={{ fontWeight: 500 }}>{note.title}</span>
                    <Tag color={getNoteStatusColor(note.status)}>
                      {getNoteStatusText(note.status)}
                    </Tag>
                    {note.assignee && (
                      <Tag color="blue">处理人: {note.assignee}</Tag>
                    )}
                  </Space>
                  <span style={{ color: '#8c8c8c', fontSize: 12 }}>
                    {dayjs(note.created_at).format('YYYY-MM-DD HH:mm:ss')}
                  </span>
                </div>
              }
              extra={
                <Space onClick={(e) => e.stopPropagation()}>
                  <Button
                    type="link"
                    icon={<EditOutlined />}
                    size="small"
                    onClick={() => handleEditNote(note)}
                  >
                    编辑
                  </Button>
                  <Button
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                    size="small"
                    onClick={() => handleDeleteNote(note.id)}
                  >
                    删除
                  </Button>
                </Space>
              }
            >
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="标题" span={2}>
                  {note.title}
                </Descriptions.Item>
                <Descriptions.Item label="内容" span={2}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{note.content}</div>
                </Descriptions.Item>
                <Descriptions.Item label="处理人">
                  {note.assignee || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={getNoteStatusColor(note.status)}>
                    {getNoteStatusText(note.status)}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {dayjs(note.created_at).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
                <Descriptions.Item label="更新时间">
                  {dayjs(note.updated_at).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
                {note.metadata && note.metadata.context_snapshot && (
                  <Descriptions.Item label="上下文快照" span={2}>
                    <pre
                      style={{
                        background: '#f5f5f5',
                        padding: 12,
                        borderRadius: 4,
                        overflow: 'auto',
                        maxHeight: 150,
                        fontSize: 12,
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all'
                      }}
                    >
                      {JSON.stringify(note.metadata.context_snapshot, null, 2)}
                    </pre>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Panel>
          ))}
        </Collapse>
      </div>
    )
  }

  // Tab配置
  const tabItems = [
    {
      key: 'trace',
      label: (
        <span>
          <BugOutlined />
          调用链日志
        </span>
      ),
      children: (
        <Spin spinning={traceLoading} tip="加载中...">
          {context?.traceId ? (
            renderTraceTimeline()
          ) : (
            <Empty description="当前日志无Trace ID" />
          )}
        </Spin>
      )
    },
    {
      key: 'trend',
      label: (
        <span>
          <LineChartOutlined />
          错误趋势
        </span>
      ),
      children: (
        <Spin spinning={trendLoading} tip="加载中...">
          {errorTrend.length > 0 ? (
            <div>
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={12}>
                  <Card size="small">
                    <Statistic
                      title="24小时错误总数"
                      value={errorTrend.reduce((sum, item) => sum + (item.error_count || 0), 0)}
                      valueStyle={{ color: '#faad14' }}
                    />
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small">
                    <Statistic
                      title="24小时致命错误数"
                      value={errorTrend.reduce((sum, item) => sum + (item.fatal_count || 0), 0)}
                      valueStyle={{ color: '#ff4d4f' }}
                    />
                  </Card>
                </Col>
              </Row>
              <Card size="small" title="最近24小时错误趋势">
                <ReactECharts
                  option={getTrendChartOption()}
                  style={{ height: 300 }}
                  notMerge={true}
                  lazyUpdate={true}
                />
              </Card>
            </div>
          ) : (
            <Empty description="暂无错误趋势数据" />
          )}
        </Spin>
      )
    },
    {
      key: 'alerts',
      label: (
        <span>
          <BellOutlined />
          相关告警
        </span>
      ),
      children: (
        <Spin spinning={alertsLoading} tip="加载中...">
          {relatedAlerts.length > 0 ? (
            <Table
              columns={alertColumns}
              dataSource={relatedAlerts}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条记录`
              }}
              locale={{
                emptyText: <Empty description="暂无相关告警" />
              }}
            />
          ) : (
            <Empty description="暂无相关告警" />
          )}
        </Spin>
      )
    },
    {
      key: 'notes',
      label: (
        <span>
          <FileTextOutlined />
          排障备注
        </span>
      ),
      children: (
        <Spin spinning={notesLoading} tip="加载中...">
          {renderNotesList()}
        </Spin>
      )
    }
  ]

  return (
    <>
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <BugOutlined style={{ marginRight: 8, color: '#ff4d4f' }} />
            排障工作台
          </div>
        }
        width={900}
        open={open}
        onClose={onClose}
        extra={
          <Space>
            <Button onClick={onClose}>关闭</Button>
          </Space>
        }
      >
        <Spin spinning={loading} tip="加载排障上下文...">
          {/* 基本信息区 */}
          {context && (
            <Card size="small" style={{ marginBottom: 16 }} title="当前上下文">
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="应用">
                  {context.appName || context.appId}
                </Descriptions.Item>
                <Descriptions.Item label="日志ID">
                  <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {context.logId}
                  </span>
                </Descriptions.Item>
                {context.traceId && (
                  <Descriptions.Item label="Trace ID" span={2}>
                    <span 
                      style={{ 
                        fontFamily: 'monospace', 
                        fontSize: 12, 
                        color: '#1890ff' 
                      }}
                    >
                      {context.traceId}
                    </span>
                  </Descriptions.Item>
                )}
                {context.exceptionHash && (
                  <Descriptions.Item label="异常哈希" span={2}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                      {context.exceptionHash}
                    </span>
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="日志消息" span={2}>
                  {context.logMessage}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}

          {/* Tab内容区 */}
          <Card size="small">
            <Tabs
              defaultActiveKey="trace"
              items={tabItems}
              onChange={(key) => {
                if (key === 'trace') loadTraceLogs()
                if (key === 'trend') loadErrorTrend()
                if (key === 'alerts') loadRelatedAlerts()
                if (key === 'notes') loadNotes()
              }}
            />
          </Card>
        </Spin>
      </Drawer>

      {/* 新增/编辑备注弹窗 */}
      <Modal
        title={editingNote ? '编辑排障备注' : '新增排障备注'}
        open={noteModalVisible}
        onCancel={() => setNoteModalVisible(false)}
        footer={
          <Space>
            <Button onClick={() => setNoteModalVisible(false)}>
              取消
            </Button>
            <Button 
              type="primary" 
              icon={<SaveOutlined />} 
              onClick={handleSaveNote}
            >
              保存
            </Button>
          </Space>
        }
        width={600}
        destroyOnClose
      >
        <Form form={noteForm} layout="vertical">
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="请输入备注标题" />
          </Form.Item>
          <Form.Item
            name="content"
            label="内容"
            rules={[{ required: true, message: '请输入内容' }]}
          >
            <TextArea
              rows={6}
              placeholder="请输入排障过程、分析结论、解决方案等内容"
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="assignee"
                label="处理人"
              >
                <Input placeholder="请输入处理人姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="status"
                label="状态"
                rules={[{ required: true, message: '请选择状态' }]}
              >
                <Select placeholder="请选择状态">
                  <Option value="pending">待处理</Option>
                  <Option value="processing">处理中</Option>
                  <Option value="resolved">已解决</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  )
}

export default TroubleshootingDrawer
