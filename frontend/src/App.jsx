import React, { useState } from 'react'
import { Layout, Menu, theme } from 'antd'
import {
  DashboardOutlined,
  AppstoreOutlined,
  SearchOutlined,
  BellOutlined,
  UserOutlined
} from '@ant-design/icons'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import AppManage from './pages/AppManage.jsx'
import LogSearch from './pages/LogSearch.jsx'
import AlertRules from './pages/AlertRules.jsx'

const { Header, Sider, Content } = Layout

// 主布局组件 - 包含侧边栏导航和头部
function App() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const {
    token: { colorBgContainer, borderRadiusLG }
  } = theme.useToken()

  // 菜单项配置
  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '统计概览'
    },
    {
      key: '/apps',
      icon: <AppstoreOutlined />,
      label: '应用管理'
    },
    {
      key: '/logs',
      icon: <SearchOutlined />,
      label: '日志检索'
    },
    {
      key: '/alerts',
      icon: <BellOutlined />,
      label: '告警规则'
    }
  ]

  // 菜单点击事件
  const handleMenuClick = ({ key }) => {
    navigate(key)
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        theme="dark"
      >
        <div
          style={{
            height: 64,
            margin: 16,
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: collapsed ? 14 : 18,
            fontWeight: 'bold'
          }}
        >
          {collapsed ? 'LOG' : '日志管理系统'}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[location.pathname]}
          mode="inline"
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            boxShadow: '0 1px 4px rgba(0,21,41,.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <BellOutlined style={{ fontSize: 20, cursor: 'pointer' }} />
            <UserOutlined style={{ fontSize: 20, cursor: 'pointer' }} />
            <span>管理员</span>
          </div>
        </Header>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG
          }}
        >
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/apps" element={<AppManage />} />
            <Route path="/logs" element={<LogSearch />} />
            <Route path="/alerts" element={<AlertRules />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

export default App
