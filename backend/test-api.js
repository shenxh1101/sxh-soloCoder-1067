// 测试脚本：创建测试数据并验证API
const axios = require('axios');
const dayjs = require('dayjs');

const BASE_URL = 'http://localhost:3001/api';

async function testAPI() {
  console.log('========== 开始测试 API ==========\n');

  try {
    // 1. 健康检查
    console.log('1. 健康检查...');
    const healthRes = await axios.get(`${BASE_URL}/health`);
    console.log('   ✅ 健康检查通过:', healthRes.data.status);

    // 2. 创建测试应用
    console.log('\n2. 创建测试应用...');
    const apps = [
      { name: '用户服务', description: '用户管理相关服务' },
      { name: '订单服务', description: '订单管理相关服务' },
      { name: '支付服务', description: '支付处理相关服务' }
    ];

    const createdApps = [];
    for (const app of apps) {
      try {
        const res = await axios.post(`${BASE_URL}/apps`, app);
        createdApps.push(res.data.data);
        console.log(`   ✅ 创建应用: ${res.data.data.name}, API Key: ${res.data.data.api_key}`);
      } catch (err) {
        if (err.response?.data?.error?.includes('UNIQUE')) {
          // 应用已存在，获取列表
          const listRes = await axios.get(`${BASE_URL}/apps`);
          createdApps.push(...listRes.data.data);
          console.log(`   ℹ️  应用已存在，使用已有数据`);
          break;
        }
        throw err;
      }
    }

    // 如果是获取的已存在应用，确保有3个
    if (createdApps.length < 3) {
      const listRes = await axios.get(`${BASE_URL}/apps`);
      const existingApps = listRes.data.data;
      for (const app of apps) {
        if (!existingApps.find(a => a.name === app.name)) {
          const res = await axios.post(`${BASE_URL}/apps`, app);
          existingApps.push(res.data.data);
        }
      }
      createdApps.length = 0;
      createdApps.push(...existingApps);
    }

    console.log(`   共 ${createdApps.length} 个应用`);

    // 3. 生成测试日志
    console.log('\n3. 生成测试日志...');
    const levels = ['debug', 'info', 'warn', 'error', 'fatal'];
    const sources = ['api', 'cron', 'mq', 'database', 'cache'];
    const messages = {
      info: ['用户登录成功', '订单创建成功', '支付回调处理完成', '数据同步完成', '缓存预热完成'],
      warn: ['接口响应时间超过阈值', '数据库连接池使用率80%', '消息队列堆积', '内存使用率偏高', '磁盘空间不足80%'],
      error: ['数据库连接超时', '空指针异常', '参数校验不通过', '第三方接口调用失败', 'SQL语法错误'],
      debug: ['进入方法 getUserById', '参数: userId=123', '查询SQL: SELECT * FROM users', '缓存命中', '方法返回'],
      fatal: ['服务启动失败', '数据库连接不可用', '内存溢出', '磁盘损坏', '网络分区']
    };

    const exceptionTypes = ['NullPointerException', 'SQLException', 'TimeoutException', 'IllegalArgumentException', 'OutOfMemoryError'];
    const stackTraces = {
      NullPointerException: `java.lang.NullPointerException: Cannot invoke method on null object
\tat com.example.service.impl.UserServiceImpl.getUserById(UserServiceImpl.java:123)
\tat com.example.controller.UserController.getUser(UserController.java:45)
\tat org.springframework.web.servlet.FrameworkServlet.service(FrameworkServlet.java:897)`,
      SQLException: `java.sql.SQLException: Connection timed out
\tat com.mysql.cj.jdbc.exceptions.SQLError.createSQLException(SQLError.java:129)
\tat com.mysql.cj.jdbc.ConnectionImpl.createNewIO(ConnectionImpl.java:828)
\tat com.zaxxer.hikari.pool.HikariPool.getConnection(HikariPool.java:187)`,
      TimeoutException: `java.util.concurrent.TimeoutException: Request timed out after 30000ms
\tat org.apache.http.nio.protocol.HttpAsyncRequestExecutor.timeout(HttpAsyncRequestExecutor.java:387)
\tat org.apache.http.impl.nio.client.InternalIODispatch.onTimeout(InternalIODispatch.java:92)`
    };

    let totalLogs = 0;
    const batchSize = 50;
    const days = 7;

    for (let day = days - 1; day >= 0; day--) {
      const logsPerDay = Math.floor(Math.random() * 200) + 100;
      
      for (let i = 0; i < logsPerDay; i += batchSize) {
        const batch = [];
        const count = Math.min(batchSize, logsPerDay - i);
        
        for (let j = 0; j < count; j++) {
          const app = createdApps[Math.floor(Math.random() * createdApps.length)];
          const level = levels[Math.floor(Math.random() * levels.length)];
          const levelMessages = messages[level];
          const message = levelMessages[Math.floor(Math.random() * levelMessages.length)];
          const source = sources[Math.floor(Math.random() * sources.length)];
          const timestamp = dayjs()
            .subtract(day, 'day')
            .subtract(Math.floor(Math.random() * 24), 'hour')
            .subtract(Math.floor(Math.random() * 60), 'minute')
            .format('YYYY-MM-DD HH:mm:ss');

          const isException = (level === 'error' || level === 'fatal') && Math.random() > 0.5;
          const exceptionType = isException ? exceptionTypes[Math.floor(Math.random() * exceptionTypes.length)] : null;
          const stackTrace = isException && stackTraces[exceptionType] ? stackTraces[exceptionType] : null;

          let exceptionHash = null;
          if (exceptionType && stackTrace) {
            const crypto = require('crypto');
            exceptionHash = crypto.createHash('md5').update(exceptionType + stackTrace.split('\n')[0]).digest('hex');
          }

          const log = {
            app_id: app.id,
            level,
            message,
            timestamp,
            source,
            stack_trace: stackTrace,
            metadata: JSON.stringify({
              host: `192.168.1.${Math.floor(Math.random() * 255)}`,
              pid: Math.floor(Math.random() * 10000),
              traceId: 'trace-' + Math.random().toString(36).substring(2, 15)
            }),
            exception_type: exceptionType,
            exception_hash: exceptionHash
          };

          batch.push(log);
        }

        await axios.post(`${BASE_URL}/logs/batch`, batch);
        totalLogs += count;
      }
    }

    console.log(`   ✅ 共生成 ${totalLogs} 条日志`);

    // 4. 创建告警规则
    console.log('\n4. 创建告警规则...');
    const rules = [
      {
        app_id: createdApps[0].id,
        name: '用户服务错误率过高',
        condition_type: 'error_count',
        condition_value: '10',
        level_threshold: 'error',
        notify_type: 'webhook',
        webhook_url: 'https://example.com/webhook',
        is_enabled: 1
      },
      {
        app_id: createdApps[1].id,
        name: '订单超时关键字',
        condition_type: 'keyword',
        condition_value: 'timeout',
        notify_type: 'email',
        is_enabled: 1
      },
      {
        app_id: createdApps[2].id,
        name: '支付致命错误告警',
        condition_type: 'level',
        level_threshold: 'fatal',
        condition_value: 'fatal',
        notify_type: 'sms',
        is_enabled: 1
      }
    ];

    for (const rule of rules) {
      try {
        await axios.post(`${BASE_URL}/alerts/rules`, rule);
        console.log(`   ✅ 创建告警规则: ${rule.name}`);
      } catch (err) {
        console.log(`   ℹ️  规则可能已存在: ${rule.name}`);
      }
    }

    // 5. 创建清理策略
    console.log('\n5. 创建清理策略...');
    for (const app of createdApps) {
      try {
        await axios.post(`${BASE_URL}/cleanup/policies`, {
          app_id: app.id,
          retention_days: 30,
          max_logs: 100000,
          is_enabled: 1
        });
        console.log(`   ✅ 为 ${app.name} 创建清理策略`);
      } catch (err) {
        console.log(`   ℹ️  策略可能已存在: ${app.name}`);
      }
    }

    // 6. 测试查询API
    console.log('\n6. 测试查询API...');
    
    // 日志查询
    const logsRes = await axios.get(`${BASE_URL}/logs`, {
      params: { page: 1, page_size: 10 }
    });
    console.log(`   ✅ 日志查询: 返回 ${logsRes.data.data.list.length} 条，共 ${logsRes.data.data.total} 条`);

    // 按级别过滤
    const errorLogsRes = await axios.get(`${BASE_URL}/logs`, {
      params: { level: 'error', page: 1, page_size: 5 }
    });
    console.log(`   ✅ 错误日志查询: 返回 ${errorLogsRes.data.data.list.length} 条`);

    // 异常聚合
    const exceptionRes = await axios.get(`${BASE_URL}/logs/exceptions/aggregate`, {
      params: { page: 1, page_size: 10 }
    });
    console.log(`   ✅ 异常聚合: ${exceptionRes.data.data.list.length} 个异常类型`);

    // 统计概览
    const statsRes = await axios.get(`${BASE_URL}/stats/overview`);
    console.log(`   ✅ 统计概览:`, JSON.stringify(statsRes.data.data, null, 2).replace(/\n/g, '\n      '));

    // 日志趋势
    const trendRes = await axios.get(`${BASE_URL}/stats/trend`, { params: { days: 7 } });
    console.log(`   ✅ 日志趋势: ${trendRes.data.data.data.length} 天数据`);

    console.log('\n========== 测试完成 ==========\n');
    console.log('📊 前端地址: http://localhost:5173');
    console.log('🔌 后端API: http://localhost:3001/api');
    console.log('💡 请启动前端服务: cd frontend && npm run dev');

  } catch (err) {
    console.error('\n❌ 测试失败:', err.message);
    if (err.response) {
      console.error('   状态码:', err.response.status);
      console.error('   响应:', err.response.data);
    }
    process.exit(1);
  }
}

// 检查是否安装了 axios
try {
  require.resolve('axios');
  testAPI();
} catch (e) {
  console.log('正在安装 axios...');
  const { execSync } = require('child_process');
  execSync('npm install axios --no-save', { stdio: 'inherit' });
  testAPI();
}
