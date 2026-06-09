import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  InputNumber,
  Popconfirm,
  message,
  Tabs,
  Badge,
  Descriptions
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BellOutlined,
  HistoryOutlined,
  CheckCircleOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  toggleAlertRule,
  getAlertRecords,
  resolveAlert
} from '../services/alertService.js'
import { getApps } from '../services/appService.js'

const { Option } = Select
const { TextArea } = Input
const { TabPane } = Tabs

function AlertRules() {
  const [loading, setLoading] = useState(false)
  const [rules, setRules] = useState([])
  const [records, setRecords] = useState([])
  const [recordsTotal, setRecordsTotal] = useState(0)
  const [apps, setApps] = useState([])
  const [modalVisible, setModalVisible] = useState(false)
  const [editingRule, setEditingRule] = useState(null)
  const [activeTab, setActiveTab] = useState('rules')
  const [form] = Form.useForm()
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10
  })
  const [submitting, setSubmitting] = useState(false)

  const conditionTypes = [
    { value: 'error_count', label: '错误数量' },
    { value: 'keyword', label: '关键字' },
    { value: 'level', label: '级别阈值' }
  ]

  const notifyTypes = [
    { value: 'email', label: '邮件' },
    { value: 'sms', label: '短信' },
    { value: 'webhook', label: 'Webhook' },
    { value: 'dingtalk', label: '钉钉' },
    { value: 'wechat', label: '企业微信' }
  ]

  const levelThresholds = [
    { value: 'DEBUG', label: 'DEBUG' },
    { value: 'INFO', label: 'INFO' },
    { value: 'WARN', label: 'WARN' },
    { value: 'ERROR', label: 'ERROR' },
    { value: 'FATAL', label: 'FATAL' }
  ]

  const getConditionTypeLabel = (type) => {
    return conditionTypes.find(t => t.value === type)?.label || type
  }

  const getNotifyTypeLabel = (type) => {
    return notifyTypes.find(t => t.value === type)?.label || type
  }

  const getAppName = (appId) => {
    const app = apps.find(a => a.id === appId)
    return app ? app.name : appId
  }

  const getRuleName = (ruleId) => {
    const rule = rules.find(r => r.id === ruleId)
    return rule ? rule.name : ruleId
  }

  const loadRules = async () => {
    setLoading(true)
    try {
      const res = await getAlertRules()
      if (res.success) {
        setRules(res.data || [])
      } else {
        message.error(res.message || '加载告警规则失败')
      }
    } catch (error) {
      console.error('加载告警规则失败:', error)
      message.error('加载告警规则失败')
    } finally {
      setLoading(false)
    }
  }

  const loadRecords = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const res = await getAlertRecords({
        page,
        page_size: pageSize
      })
      if (res.success) {
        setRecords(res.data?.list || [])
        setRecordsTotal(res.data?.total || 0)
        setPagination({
          current: page,
          pageSize
        })
      } else {
        message.error(res.message || '加载告警记录失败')
      }
    } catch (error) {
      console.error('加载告警记录失败:', error)
      message.error('加载告警记录失败')
    } finally {
      setLoading(false)
    }
  }

  const loadApps = async () => {
    try {
      const res = await getApps()
      if (res.success) {
        setApps(res.data || [])
      }
    } catch (error) {
      console.error('加载应用列表失败:', error)
    }
  }

  useEffect(() => {
    loadApps()
  }, [])

  useEffect(() => {
    if (activeTab === 'rules') {
      loadRules()
    } else if (activeTab === 'records') {
      loadRecords(pagination.current, pagination.pageSize)
    }
  }, [activeTab])

  const showModal = (rule = null) => {
    setEditingRule(rule)
    if (rule) {
      form.setFieldsValue({
        ...rule,
        is_enabled: rule.is_enabled === 1 || rule.is_enabled === true
      })
    } else {
      form.resetFields()
      form.setFieldsValue({
        is_enabled: true,
        condition_type: 'error_count',
        notify_type: 'email'
      })
    }
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      const data = {
        ...values,
        is_enabled: values.is_enabled ? 1 : 0
      }

      if (editingRule) {
        const res = await updateAlertRule(editingRule.id, data)
        if (res.success) {
          message.success('规则更新成功')
          setModalVisible(false)
          loadRules()
        } else {
          message.error(res.message || '更新失败')
        }
      } else {
        const res = await createAlertRule(data)
        if (res.success) {
          message.success('规则创建成功')
          setModalVisible(false)
          loadRules()
        } else {
          message.error(res.message || '创建失败')
        }
      }
    } catch (error) {
      console.error('提交失败:', error)
      if (error.message) {
        message.error(error.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      setLoading(true)
      const res = await deleteAlertRule(id)
      if (res.success) {
        message.success('删除成功')
        loadRules()
      } else {
        message.error(res.message || '删除失败')
      }
    } catch (error) {
      console.error('删除失败:', error)
      message.error('删除失败')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (id, enabled) => {
    try {
      const res = await toggleAlertRule(id, enabled)
      if (res.success) {
        message.success(enabled ? '规则已启用' : '规则已禁用')
        loadRules()
      } else {
        message.error(res.message || '操作失败')
        loadRules()
      }
    } catch (error) {
      console.error('切换状态失败:', error)
      message.error('操作失败')
      loadRules()
    }
  }

  const handleResolve = async (id) => {
    try {
      const res = await resolveAlert(id)
      if (res.success) {
        message.success('告警已标记为已解决')
        loadRecords(pagination.current, pagination.pageSize)
      } else {
        message.error(res.message || '操作失败')
      }
    } catch (error) {
      console.error('解决告警失败:', error)
      message.error('操作失败')
    }
  }

  const handlePageChange = (page, pageSize) => {
    loadRecords(page, pageSize)
  }

  const ruleColumns = [
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text) => <strong>{text}</strong>
    },
    {
      title: '应用',
      dataIndex: 'app_id',
      key: 'app_id',
      width: 120,
      render: (appId) => getAppName(appId)
    },
    {
      title: '条件类型',
      dataIndex: 'condition_type',
      key: 'condition_type',
      width: 120,
      render: (type) => getConditionTypeLabel(type)
    },
    {
      title: '阈值',
      key: 'threshold',
      width: 150,
      render: (_, record) => {
        if (record.condition_type === 'keyword') {
          return record.condition_value || '-'
        } else if (record.condition_type === 'level') {
          return record.level_threshold || '-'
        } else {
          return record.condition_value || '-'
        }
      }
    },
    {
      title: '通知方式',
      dataIndex: 'notify_type',
      key: 'notify_type',
      width: 120,
      render: (type) => {
        const label = getNotifyTypeLabel(type)
        return <Tag>{label}</Tag>
      }
    },
    {
      title: '状态',
      dataIndex: 'is_enabled',
      key: 'is_enabled',
      width: 100,
      render: (enabled, record) => (
        <Switch
          checked={enabled === 1 || enabled === true}
          onChange={(checked) => handleToggle(record.id, checked)}
        />
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (time) => time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => showModal(record)}
            size="small"
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个规则吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />} size="small">
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  const recordColumns = [
    {
      title: '状态',
      dataIndex: 'resolved',
      key: 'resolved',
      width: 100,
      render: (resolved) => (
        <Badge
          status={resolved ? 'default' : 'processing'}
          text={resolved ? '已解决' : '未解决'}
        />
      )
    },
    {
      title: '规则名称',
      dataIndex: 'rule_id',
      key: 'rule_id',
      width: 200,
      render: (ruleId) => getRuleName(ruleId)
    },
    {
      title: '应用',
      dataIndex: 'app_id',
      key: 'app_id',
      width: 120,
      render: (appId) => getAppName(appId)
    },
    {
      title: '触发时间',
      dataIndex: 'triggered_at',
      key: 'triggered_at',
      width: 180,
      render: (time) => time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-'
    },
    {
      title: '日志数量',
      dataIndex: 'log_count',
      key: 'log_count',
      width: 100
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
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        !record.resolved && (
          <Button
            type="link"
            icon={<CheckCircleOutlined />}
            onClick={() => handleResolve(record.id)}
            size="small"
          >
            标记已解决
          </Button>
        )
      )
    }
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, marginBottom: 0 }}>告警规则</h2>
        {activeTab === 'rules' && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => showModal()}
          >
            新增规则
          </Button>
        )}
      </div>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'rules',
              label: (
                <span>
                  <BellOutlined />
                  告警规则
                </span>
              ),
              children: (
                <Table
                  columns={ruleColumns}
                  dataSource={rules}
                  rowKey="id"
                  loading={loading}
                  scroll={{ x: 1300 }}
                  pagination={{
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total) => `共 ${total} 条记录`
                  }}
                />
              )
            },
            {
              key: 'records',
              label: (
                <span>
                  <HistoryOutlined />
                  告警记录
                </span>
              ),
              children: (
                <Table
                  columns={recordColumns}
                  dataSource={records}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    current: pagination.current,
                    pageSize: pagination.pageSize,
                    total: recordsTotal,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total) => `共 ${total} 条记录`,
                    onChange: handlePageChange
                  }}
                  expandable={{
                    expandedRowRender: (record) => (
                      <Descriptions bordered size="small" column={1}>
                        <Descriptions.Item label="告警消息">
                          {record.message}
                        </Descriptions.Item>
                        <Descriptions.Item label="触发时间">
                          {record.triggered_at ? dayjs(record.triggered_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="日志数量">
                          {record.log_count || 0}
                        </Descriptions.Item>
                        <Descriptions.Item label="状态">
                          <Badge
                            status={record.resolved ? 'default' : 'processing'}
                            text={record.resolved ? '已解决' : '未解决'}
                          />
                        </Descriptions.Item>
                        {record.resolved && record.resolved_at && (
                          <Descriptions.Item label="解决时间">
                            {dayjs(record.resolved_at).format('YYYY-MM-DD HH:mm:ss')}
                          </Descriptions.Item>
                        )}
                      </Descriptions>
                    )
                  }}
                />
              )
            }
          ]}
        />
      </Card>

      <Modal
        title={editingRule ? '编辑告警规则' : '新增告警规则'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="确定"
        cancelText="取消"
        width={600}
        destroyOnClose
        confirmLoading={submitting}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="规则名称"
            rules={[{ required: true, message: '请输入规则名称' }]}
          >
            <Input placeholder="请输入规则名称" />
          </Form.Item>

          <Form.Item
            name="app_id"
            label="应用"
            rules={[{ required: true, message: '请选择应用' }]}
          >
            <Select placeholder="请选择应用">
              {apps.map(app => (
                <Option key={app.id} value={app.id}>
                  {app.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="condition_type"
            label="条件类型"
            rules={[{ required: true, message: '请选择条件类型' }]}
          >
            <Select placeholder="请选择条件类型">
              {conditionTypes.map(type => (
                <Option key={type.value} value={type.value}>
                  {type.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.condition_type !== currentValues.condition_type}
          >
            {({ getFieldValue }) => {
              const conditionType = getFieldValue('condition_type')
              if (conditionType === 'keyword') {
                return (
                  <Form.Item
                    name="condition_value"
                    label="关键字"
                    rules={[{ required: true, message: '请输入关键字' }]}
                  >
                    <Input placeholder="请输入关键字" />
                  </Form.Item>
                )
              } else if (conditionType === 'level') {
                return (
                  <Form.Item
                    name="level_threshold"
                    label="级别阈值"
                    rules={[{ required: true, message: '请选择级别阈值' }]}
                  >
                    <Select placeholder="请选择级别阈值">
                      {levelThresholds.map(level => (
                        <Option key={level.value} value={level.value}>
                          {level.label}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                )
              } else {
                return (
                  <Form.Item
                    name="condition_value"
                    label="阈值（数量）"
                    rules={[{ required: true, message: '请输入阈值' }]}
                  >
                    <InputNumber
                      min={1}
                      style={{ width: '100%' }}
                      placeholder="请输入阈值"
                    />
                  </Form.Item>
                )
              }
            }}
          </Form.Item>

          <Form.Item
            name="notify_type"
            label="通知方式"
            rules={[{ required: true, message: '请选择通知方式' }]}
          >
            <Select placeholder="请选择通知方式">
              {notifyTypes.map(type => (
                <Option key={type.value} value={type.value}>
                  {type.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.notify_type !== currentValues.notify_type}
          >
            {({ getFieldValue }) => {
              const notifyType = getFieldValue('notify_type')
              if (notifyType === 'webhook') {
                return (
                  <Form.Item
                    name="webhook_url"
                    label="Webhook 地址"
                    rules={[
                      { required: true, message: '请输入 Webhook 地址' },
                      {
                        validator: (_, value) => {
                          if (value && !/^https?:\/\//.test(value)) {
                            return Promise.reject('请输入有效的 URL')
                          }
                          return Promise.resolve()
                        }
                      }
                    ]}
                  >
                    <Input placeholder="请输入 Webhook 地址" />
                  </Form.Item>
                )
              }
              return null
            }}
          </Form.Item>

          <Form.Item
            name="is_enabled"
            label="是否启用"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AlertRules
