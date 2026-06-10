import React, { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Table, Tag, Spin, Empty } from 'antd'
import {
  FileTextOutlined,
  CalendarOutlined,
  BugOutlined,
  AppstoreOutlined,
  BellOutlined,
  WarningOutlined,
  CheckCircleOutlined
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'
import {
  getOverviewStats,
  getLogTrend,
  getLogLevelDistribution,
  getRecentAlerts,
  getTopExceptions
} from '../services/statsService.js'
import { getApps } from '../services/appService.js'
import { getAlertStatsByStatus } from '../services/alertService.js'

// 统计概览页面
function Dashboard() {
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({
    total_logs: 0,
    today_logs: 0,
    error_logs: 0,
    active_apps: 0,
    unresolved_alerts: 0
  })
  const [trendData, setTrendData] = useState([])
  const [levelData, setLevelData] = useState([])
  const [recentAlerts, setRecentAlerts] = useState([])
  const [topExceptions, setTopExceptions] = useState([])
  const [appMap, setAppMap] = useState({})
  const [alertStats, setAlertStats] = useState({
    pending: 0,
    processing: 0,
    ignored: 0,
    resolved: 0
  })

  // 获取应用名称映射
  const loadAppMap = async () => {
    try {
      const res = await getApps()
      if (res.success && res.data) {
        const map = {}
        res.data.forEach(app => {
          map[app.id] = app.name
        })
        setAppMap(map)
      }
    } catch (error) {
      console.error('加载应用列表失败:', error)
    }
  }

  // 加载统计数据
  const loadData = async () => {
    setLoading(true)
    try {
      // 并行加载所有数据
      const [overviewRes, trendRes, levelRes, alertsRes, exceptionsRes, alertStatsRes] = await Promise.all([
        getOverviewStats(),
        getLogTrend({ days: 7 }),
        getLogLevelDistribution({ days: 7 }),
        getRecentAlerts(),
        getTopExceptions(),
        getAlertStatsByStatus()
      ])

      // 概览统计
      if (overviewRes.success && overviewRes.data) {
        setStats(overviewRes.data)
        // 如果 overviewRes 包含 alert_stats，优先使用
        if (overviewRes.data.alert_stats) {
          setAlertStats(overviewRes.data.alert_stats)
        }
      }

      // 告警状态统计
      if (alertStatsRes.success && alertStatsRes.data) {
        setAlertStats(alertStatsRes.data)
      }

      // 趋势数据
      if (trendRes.success && trendRes.data && trendRes.data.data) {
        setTrendData(trendRes.data.data)
      }

      // 级别分布
      if (levelRes.success && levelRes.data && levelRes.data.data) {
        setLevelData(levelRes.data.data.map(item => ({
          name: item.level.toUpperCase(),
          value: item.count,
          percentage: item.percentage
        })))
      }

      // 最近告警
      if (alertsRes.success && alertsRes.data && alertsRes.data.list) {
        setRecentAlerts(alertsRes.data.list.map(alert => ({
          ...alert,
          appName: appMap[alert.app_id] || `应用${alert.app_id}`,
          time: alert.triggered_at,
          level: alert.log_count > 10 ? 'ERROR' : 'WARN'
        })))
      }

      // 异常 TOP 5
      if (exceptionsRes.success && exceptionsRes.data && exceptionsRes.data.list) {
        setTopExceptions(exceptionsRes.data.list.map((item, index) => ({
          id: index + 1,
          type: item.exception_type || 'Unknown',
          exception_hash: item.exception_hash,
          appName: appMap[item.app_id] || `应用${item.app_id}`,
          count: item.count,
          first_seen: item.first_seen,
          last_seen: item.last_seen
        })))
      }
    } catch (error) {
      console.error('加载统计数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAppMap().then(loadData)
    // 每30秒刷新一次
    const timer = setInterval(loadData, 30000)
    return () => clearInterval(timer)
  }, [])

  // 日志趋势图配置
  const trendOption = {
    title: { text: '日志趋势（近7天）', left: 'center', textStyle: { fontSize: 16 } },
    tooltip: { trigger: 'axis' },
    legend: { data: ['全部', 'INFO', 'WARN', 'ERROR'], top: 30 },
    xAxis: {
      type: 'category',
      data: trendData.map(d => dayjs(d.date).format('MM-DD')),
      boundaryGap: false
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '全部',
        type: 'line',
        smooth: true,
        areaStyle: {},
        data: trendData.map(d => d.total),
        lineStyle: { color: '#1890ff' },
        itemStyle: { color: '#1890ff' }
      },
      {
        name: 'INFO',
        type: 'line',
        smooth: true,
        data: trendData.map(d => d.info),
        lineStyle: { color: '#52c41a' },
        itemStyle: { color: '#52c41a' }
      },
      {
        name: 'WARN',
        type: 'line',
        smooth: true,
        data: trendData.map(d => d.warn),
        lineStyle: { color: '#faad14' },
        itemStyle: { color: '#faad14' }
      },
      {
        name: 'ERROR',
        type: 'line',
        smooth: true,
        data: trendData.map(d => d.error + d.fatal),
        lineStyle: { color: '#f5222d' },
        itemStyle: { color: '#f5222d' }
      }
    ],
    grid: { left: '3%', right: '4%', bottom: '3%', top: 80, containLabel: true }
  }

  // 日志级别分布图配置
  const levelOption = {
    title: { text: '日志级别分布', left: 'center', textStyle: { fontSize: 16 } },
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical', left: 'left', top: 'middle' },
    color: ['#52c41a', '#faad14', '#f5222d', '#1890ff', '#722ed1'],
    series: [{
      name: '日志级别',
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
      label: { show: false, position: 'center' },
      emphasis: {
        label: { show: true, fontSize: 20, fontWeight: 'bold' }
      },
      labelLine: { show: false },
      data: levelData
    }]
  }

  // 级别颜色映射
  const getLevelColor = (level) => {
    const colorMap = {
      INFO: 'green',
      WARN: 'orange',
      ERROR: 'red',
      DEBUG: 'red'
    }
    return colorMap[level] || 'default'
  }

  // 告警状态统计柱状图配置
  const alertStatusOption = {
    title: { text: '告警状态分布', left: 'center', textStyle: { fontSize: 16 } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['数量'], top: 30 },
    xAxis: {
      type: 'category',
      data: ['待处理', '处理中', '已忽略', '已解决'],
      axisLabel: {
        color: ['#f5222d', '#1890ff', '#faad14', '#52c41a']
      }
    },
    yAxis: { type: 'value' },
    series: [{
      name: '数量',
      type: 'bar',
      barWidth: '50%',
      data: [
        { value: alertStats.pending, itemStyle: { color: '#f5222d' } },
        { value: alertStats.processing, itemStyle: { color: '#1890ff' } },
        { value: alertStats.ignored, itemStyle: { color: '#faad14' } },
        { value: alertStats.resolved, itemStyle: { color: '#52c41a' } }
      ],
      label: {
        show: true,
        position: 'top'
      }
    }],
    grid: { left: '3%', right: '4%', bottom: '3%', top: 80, containLabel: true }
  }

  // 告警列表列配置
  const alertColumns = [
    {
      title: '应用',
      dataIndex: 'appName',
      key: 'appName',
      width: 120
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (level) => <Tag color={getLevelColor(level)}>{level}</Tag>
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true
    },
    {
      title: '时间',
      dataIndex: 'time',
      key: 'time',
      width: 180,
      render: (time) => time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-'
    }
  ]

  // 异常 TOP 5 列配置
  const exceptionColumns = [
    {
      title: '排名',
      dataIndex: 'id',
      key: 'id',
      width: 60,
      render: (id) => <Tag color={id <= 3 ? 'red' : 'orange'}>{id}</Tag>
    },
    {
      title: '异常类型',
      dataIndex: 'type',
      key: 'type',
      ellipsis: true
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
      width: 100,
      render: (count) => <strong style={{ color: '#f5222d' }}>{count}</strong>
    }
  ]

  return (
    <Spin spinning={loading}>
      <div>
        <h2 style={{ marginTop: 0, marginBottom: 24 }}>统计概览</h2>

        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={8} lg={4} xl={4}>
            <Card>
              <Statistic
                title="总日志数"
                value={stats.total_logs}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4} xl={4}>
            <Card>
              <Statistic
                title="今日日志"
                value={stats.today_logs}
                prefix={<CalendarOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4} xl={4}>
            <Card>
              <Statistic
                title="错误数"
                value={stats.error_logs}
                prefix={<BugOutlined />}
                valueStyle={{ color: '#f5222d' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4} xl={4}>
            <Card>
              <Statistic
                title="活跃应用数"
                value={stats.active_apps}
                prefix={<AppstoreOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4} xl={4}>
            <Card>
              <Statistic
                title="未解决告警"
                value={stats.unresolved_alerts}
                prefix={<BellOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 告警状态统计卡片 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={12} md={6} lg={6} xl={6}>
            <Card>
              <Statistic
                title="待处理告警"
                value={alertStats.pending}
                prefix={<WarningOutlined />}
                valueStyle={{ color: '#f5222d' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6} lg={6} xl={6}>
            <Card>
              <Statistic
                title="处理中告警"
                value={alertStats.processing}
                prefix={<BellOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6} lg={6} xl={6}>
            <Card>
              <Statistic
                title="已忽略告警"
                value={alertStats.ignored}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6} lg={6} xl={6}>
            <Card>
              <Statistic
                title="已解决告警"
                value={alertStats.resolved}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={14}>
            <Card>
              {trendData.length > 0 ? (
                <ReactECharts option={trendOption} style={{ height: 350 }} />
              ) : (
                <Empty description="暂无数据" style={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card>
              {levelData.length > 0 ? (
                <ReactECharts option={levelOption} style={{ height: 350 }} />
              ) : (
                <Empty description="暂无数据" style={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
              )}
            </Card>
          </Col>
        </Row>

        {/* 告警状态分布图表 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24}>
            <Card>
              <ReactECharts option={alertStatusOption} style={{ height: 350 }} />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Card title={<span><WarningOutlined /> 最近告警</span>}>
              <Table
                columns={alertColumns}
                dataSource={recentAlerts}
                rowKey="id"
                pagination={false}
                size="small"
                locale={{ emptyText: '暂无告警' }}
              />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title={<span><BugOutlined /> 异常 TOP 5</span>}>
              <Table
                columns={exceptionColumns}
                dataSource={topExceptions}
                rowKey="exception_hash"
                pagination={false}
                size="small"
                locale={{ emptyText: '暂无异常' }}
              />
            </Card>
          </Col>
        </Row>
      </div>
    </Spin>
  )
}

export default Dashboard
