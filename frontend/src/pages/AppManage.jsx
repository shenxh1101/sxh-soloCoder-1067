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
  Switch,
  InputNumber,
  Select,
  Popconfirm,
  message,
  Tooltip
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  ReloadOutlined,
  SettingOutlined,
  CopyOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getApps,
  createApp,
  updateApp,
  deleteApp,
  resetApiKey,
  getCleanupPolicies,
  createCleanupPolicy,
  updateCleanupPolicy
} from '../services/appService.js'

const { Option } = Select
const { TextArea } = Input

function AppManage() {
  const [loading, setLoading] = useState(false)
  const [policyLoading, setPolicyLoading] = useState(false)
  const [apps, setApps] = useState([])
  const [cleanupPolicies, setCleanupPolicies] = useState([])
  const [modalVisible, setModalVisible] = useState(false)
  const [policyModalVisible, setPolicyModalVisible] = useState(false)
  const [editingApp, setEditingApp] = useState(null)
  const [currentApp, setCurrentApp] = useState(null)
  const [currentPolicy, setCurrentPolicy] = useState(null)
  const [visibleApiKeys, setVisibleApiKeys] = useState({})
  const [form] = Form.useForm()
  const [policyForm] = Form.useForm()

  const loadData = async () => {
    setLoading(true)
    try {
      const [appsRes, policiesRes] = await Promise.all([
        getApps(),
        getCleanupPolicies()
      ])

      if (appsRes.success) {
        setApps(appsRes.data.map(app => ({
          ...app,
          apiKey: app.api_key,
          createdAt: app.created_at
        })))
      } else {
        message.error('加载应用列表失败')
      }

      if (policiesRes.success) {
        setCleanupPolicies(policiesRes.data)
      } else {
        message.error('加载清理策略失败')
      }
    } catch (error) {
      console.error('加载数据失败:', error)
      message.error('加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const showModal = (app = null) => {
    setEditingApp(app)
    if (app) {
      form.setFieldsValue({
        name: app.name,
        description: app.description,
        status: app.status
      })
    } else {
      form.resetFields()
    }
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)

      if (editingApp) {
        const res = await updateApp(editingApp.id, {
          name: values.name,
          description: values.description,
          status: values.status
        })
        if (res.success) {
          message.success('应用更新成功')
          setModalVisible(false)
          loadData()
        } else {
          message.error('应用更新失败')
        }
      } else {
        const res = await createApp({
          name: values.name,
          description: values.description
        })
        if (res.success) {
          message.success('应用创建成功')
          setModalVisible(false)
          loadData()
        } else {
          message.error('应用创建失败')
        }
      }
    } catch (error) {
      console.error('提交失败:', error)
      message.error('操作失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      setLoading(true)
      const res = await deleteApp(id)
      if (res.success) {
        message.success('删除成功')
        loadData()
      } else {
        message.error('删除失败')
      }
    } catch (error) {
      console.error('删除失败:', error)
      message.error('删除失败')
    } finally {
      setLoading(false)
    }
  }

  const handleResetApiKey = async (id) => {
    try {
      const res = await resetApiKey(id)
      if (res.success) {
        setApps(apps.map(app =>
          app.id === id
            ? { ...app, apiKey: res.data.api_key }
            : app
        ))
        message.success('API Key 重置成功')
      } else {
        message.error('重置失败')
      }
    } catch (error) {
      console.error('重置 API Key 失败:', error)
      message.error('重置失败')
    }
  }

  const toggleApiKeyVisibility = (id) => {
    setVisibleApiKeys(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const copyApiKey = (apiKey) => {
    navigator.clipboard.writeText(apiKey)
    message.success('API Key 已复制到剪贴板')
  }

  const showPolicyModal = async (app) => {
    setCurrentApp(app)
    setPolicyLoading(true)
    try {
      const res = await getCleanupPolicies()
      if (res.success) {
        setCleanupPolicies(res.data)
        const policy = res.data.find(p => p.app_id === app.id)
        setCurrentPolicy(policy || null)

        if (policy) {
          policyForm.setFieldsValue({
            is_enabled: policy.is_enabled,
            retention_days: policy.retention_days,
            max_logs: policy.max_logs
          })
        } else {
          policyForm.resetFields()
        }
      } else {
        message.error('加载清理策略失败')
      }
    } catch (error) {
      console.error('加载清理策略失败:', error)
      message.error('加载清理策略失败')
    } finally {
      setPolicyLoading(false)
    }
    setPolicyModalVisible(true)
  }

  const handlePolicySubmit = async () => {
    try {
      const values = await policyForm.validateFields()
      setPolicyLoading(true)

      if (currentPolicy) {
        const res = await updateCleanupPolicy(currentPolicy.id, {
          retention_days: values.retention_days,
          max_logs: values.max_logs,
          is_enabled: values.is_enabled
        })
        if (res.success) {
          message.success('清理策略保存成功')
          setPolicyModalVisible(false)
          loadData()
        } else {
          message.error('保存失败')
        }
      } else {
        const res = await createCleanupPolicy({
          app_id: currentApp.id,
          retention_days: values.retention_days,
          max_logs: values.max_logs,
          is_enabled: values.is_enabled
        })
        if (res.success) {
          message.success('清理策略保存成功')
          setPolicyModalVisible(false)
          loadData()
        } else {
          message.error('保存失败')
        }
      }
    } catch (error) {
      console.error('保存策略失败:', error)
      message.error('保存失败')
    } finally {
      setPolicyLoading(false)
    }
  }

  const columns = [
    {
      title: '应用名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (text) => <strong>{text}</strong>
    },
    {
      title: 'API Key',
      dataIndex: 'apiKey',
      key: 'apiKey',
      width: 280,
      render: (apiKey, record) => (
        <Space>
          <span style={{ fontFamily: 'monospace' }}>
            {visibleApiKeys[record.id] ? apiKey : '••••••••••••••••'}
          </span>
          <Tooltip title={visibleApiKeys[record.id] ? '隐藏' : '显示'}>
            <Button
              type="text"
              icon={visibleApiKeys[record.id] ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              onClick={() => toggleApiKeyVisibility(record.id)}
              size="small"
            />
          </Tooltip>
          <Tooltip title="复制">
            <Button
              type="text"
              icon={<CopyOutlined />}
              onClick={() => copyApiKey(apiKey)}
              size="small"
            />
          </Tooltip>
          <Tooltip title="重置">
            <Button
              type="text"
              icon={<ReloadOutlined />}
              onClick={() => handleResetApiKey(record.id)}
              size="small"
            />
          </Tooltip>
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? '正常' : '停用'}
        </Tag>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
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
          <Button
            type="link"
            icon={<SettingOutlined />}
            onClick={() => showPolicyModal(record)}
            size="small"
          >
            清理策略
          </Button>
          <Popconfirm
            title="确定要删除这个应用吗？"
            description="删除后数据将无法恢复"
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, marginBottom: 0 }}>应用管理</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => showModal()}
        >
          新增应用
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={apps}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
        />
      </Card>

      <Modal
        title={editingApp ? '编辑应用' : '新增应用'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="确定"
        cancelText="取消"
        confirmLoading={loading}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="应用名称"
            rules={[{ required: true, message: '请输入应用名称' }]}
          >
            <Input placeholder="请输入应用名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="应用描述"
          >
            <TextArea rows={3} placeholder="请输入应用描述" />
          </Form.Item>
          {editingApp && (
            <Form.Item
              name="status"
              label="状态"
              initialValue="active"
            >
              <Select>
                <Option value="active">正常</Option>
                <Option value="inactive">停用</Option>
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title={`清理策略 - ${currentApp?.name || ''}`}
        open={policyModalVisible}
        onOk={handlePolicySubmit}
        onCancel={() => setPolicyModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={500}
        confirmLoading={policyLoading}
        destroyOnClose
      >
        <Form form={policyForm} layout="vertical">
          <Form.Item
            name="is_enabled"
            label="启用自动清理"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name="retention_days"
            label="保留天数"
            rules={[{ required: true, message: '请输入保留天数' }]}
          >
            <InputNumber
              min={1}
              max={365}
              style={{ width: '100%' }}
              placeholder="请输入保留天数"
              addonAfter="天"
            />
          </Form.Item>
          <Form.Item
            name="max_logs"
            label="最大日志数"
            rules={[{ required: true, message: '请输入最大日志数' }]}
          >
            <InputNumber
              min={1000}
              max={10000000}
              step={1000}
              style={{ width: '100%' }}
              placeholder="请输入最大日志数"
              addonAfter="条"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AppManage
