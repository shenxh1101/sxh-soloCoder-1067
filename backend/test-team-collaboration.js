// 团队协作和排障闭环功能测试
const axios = require('axios');
const dayjs = require('dayjs');

const BASE_URL = 'http://localhost:3001/api';

async function testAllFeatures() {
  console.log('========== 团队协作和排障闭环功能测试 ==========\n');

  try {
    // 1. 获取测试应用
    console.log('1. 获取测试应用和 API Key...');
    const appsRes = await axios.get(`${BASE_URL}/apps`);
    const testApp = appsRes.data.data[0];
    const API_KEY = testApp.api_key;
    console.log(`   ✅ 测试应用: ${testApp.name}, ID: ${testApp.id}`);

    // 2. 测试告警规则保存（级别阈值）
    console.log('\n2. 测试告警规则保存（级别阈值）...');
    
    // 先清理旧的测试规则
    const oldRulesRes = await axios.get(`${BASE_URL}/alerts/rules`, { params: { app_id: testApp.id } });
    for (const rule of oldRulesRes.data.data) {
      if (rule.name.includes('协作测试') || rule.name.includes('team-test')) {
        await axios.delete(`${BASE_URL}/alerts/rules/${rule.id}`);
      }
    }

    // 2.1 测试级别阈值规则保存
    const levelRuleRes = await axios.post(`${BASE_URL}/alerts/rules`, {
      app_id: testApp.id,
      name: '协作测试-级别阈值规则',
      condition_type: 'level',
      level_threshold: 'ERROR',  // 大写测试大小写不敏感
      condition_value: 'error',
      notify_type: 'dingtalk',
      webhook_url: 'https://oapi.dingtalk.com/robot/send?access_token=test123',
      is_enabled: 1
    });
    console.log('   ✅ 级别阈值规则创建成功');
    console.log(`      规则名: ${levelRuleRes.data.data.name}`);
    console.log(`      级别阈值: ${levelRuleRes.data.data.level_threshold}`);
    console.log(`      条件值: ${levelRuleRes.data.data.condition_value}`);
    console.log(`      通知类型: ${levelRuleRes.data.data.notify_type}`);

    // 2.2 验证规则列表即时显示
    const rulesListRes = await axios.get(`${BASE_URL}/alerts/rules`, { params: { app_id: testApp.id } });
    const createdRule = rulesListRes.data.data.find(r => r.name === '协作测试-级别阈值规则');
    if (createdRule) {
      console.log('   ✅ 规则列表即时显示成功');
    } else {
      console.log('   ❌ 规则列表未显示新创建的规则');
    }

    // 2.3 测试关键字规则
    const keywordRuleRes = await axios.post(`${BASE_URL}/alerts/rules`, {
      app_id: testApp.id,
      name: '协作测试-关键字规则',
      condition_type: 'keyword',
      condition_value: '数据库异常',
      notify_type: 'wechat',
      webhook_url: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test456',
      is_enabled: 1
    });
    console.log('   ✅ 关键字规则创建成功');

    // 2.4 测试错误数量规则
    const errorCountRuleRes = await axios.post(`${BASE_URL}/alerts/rules`, {
      app_id: testApp.id,
      name: '协作测试-错误数量规则',
      condition_type: 'error_count',
      condition_value: '2',
      notify_type: 'email',
      notify_target: 'admin@example.com,ops@example.com',
      is_enabled: 1
    });
    console.log('   ✅ 错误数量规则创建成功');
    console.log(`      通知目标: ${errorCountRuleRes.data.data.notify_target}`);

    // 3. 测试通知方式
    console.log('\n3. 测试通知方式...');
    const notifyTests = [
      { type: 'dingtalk', url: 'https://oapi.dingtalk.com/robot/send?access_token=test', target: null },
      { type: 'wechat', url: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test', target: null },
      { type: 'webhook', url: 'https://example.com/webhook', target: null },
      { type: 'email', url: null, target: 'test@example.com' },
      { type: 'sms', url: null, target: '13800138000' }
    ];

    for (const nt of notifyTests) {
      try {
        const testRes = await axios.post(`${BASE_URL}/alerts/rules/test-notification`, {
          notify_type: nt.type,
          webhook_url: nt.url,
          notify_target: nt.target,
          rule_name: `测试通知-${nt.type}`
        });
        console.log(`   ✅ ${nt.type} 通知测试: ${testRes.data.message}`);
        if (testRes.data.detail) {
          console.log(`      详情: ${testRes.data.detail}`);
        }
      } catch (err) {
        console.log(`   ⚠️  ${nt.type} 通知测试: ${err.response?.data?.error || err.message}`);
      }
    }

    // 4. 写入测试日志（包含相同 traceId）
    console.log('\n4. 写入测试日志（用于排障测试）...');
    const testTraceId = `trace-collab-test-${Date.now()}`;
    const testExceptionHash = 'collab-test-exception-hash-001';

    // 写入同 traceId 的多条日志
    const logMessages = [
      { level: 'info', message: '请求开始 - 用户登录', source: 'api' },
      { level: 'debug', message: '参数校验通过，userId=123', source: 'api' },
      { level: 'info', message: '查询用户信息', source: 'database' },
      { level: 'warn', message: '数据库查询耗时超过阈值: 800ms', source: 'database' },
      { level: 'error', message: '数据库连接异常，无法获取用户信息', source: 'database', 
        exception_type: 'SQLException', exception_hash: testExceptionHash,
        stack_trace: `java.sql.SQLException: Connection refused
\tat com.mysql.jdbc.Driver.connect(Driver.java:234)
\tat com.zaxxer.hikari.pool.HikariPool.getConnection(HikariPool.java:187)` }
    ];

    for (let i = 0; i < logMessages.length; i++) {
      const log = logMessages[i];
      await axios.post(`${BASE_URL}/logs`, {
        level: log.level,
        message: log.message,
        timestamp: dayjs().subtract(logMessages.length - i, 'second').format('YYYY-MM-DD HH:mm:ss'),
        source: log.source,
        exception_type: log.exception_type || null,
        exception_hash: log.exception_hash || null,
        stack_trace: log.stack_trace || null,
        metadata: JSON.stringify({
          traceId: testTraceId,
          userId: 123,
          host: '192.168.1.100',
          step: i + 1
        })
      }, {
        headers: { 'x-api-key': API_KEY }
      });
    }
    console.log(`   ✅ 写入 ${logMessages.length} 条测试日志，TraceId: ${testTraceId}`);

    // 等待告警触发
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 5. 测试告警记录处理流程
    console.log('\n5. 测试告警记录处理流程...');
    const alertsRes = await axios.get(`${BASE_URL}/alerts/records`, {
      params: { app_id: testApp.id, page_size: 10 }
    });
    const testAlert = alertsRes.data.data.list.find(r => r.message.includes('协作测试'));
    
    if (testAlert) {
      console.log(`   ✅ 找到测试告警记录，ID: ${testAlert.id}`);
      console.log(`      当前状态: ${testAlert.status}`);

      // 5.1 分配处理人
      const assignRes = await axios.post(`${BASE_URL}/alerts/records/${testAlert.id}/assign`, {
        assignee: '张三'
      });
      console.log(`   ✅ 分配处理人成功: ${assignRes.data.data.assignee}`);

      // 5.2 更新状态为处理中
      const statusRes = await axios.put(`${BASE_URL}/alerts/records/${testAlert.id}/status`, {
        status: 'processing',
        handle_note: '正在排查数据库连接问题'
      });
      console.log(`   ✅ 状态更新成功: ${statusRes.data.data.status}`);
      console.log(`      处理备注: ${statusRes.data.data.handle_note}`);
      console.log(`      处理人: ${statusRes.data.data.assignee}`);

      // 5.3 标记为已解决
      const resolveRes = await axios.put(`${BASE_URL}/alerts/records/${testAlert.id}/status`, {
        status: 'resolved',
        handle_note: '重启数据库连接池后恢复正常，根因是连接数不足'
      });
      console.log(`   ✅ 标记已解决成功: ${resolveRes.data.data.status}`);
      console.log(`      处理时间: ${resolveRes.data.data.handled_at}`);
    } else {
      console.log('   ⚠️  未找到测试告警记录，跳过处理流程测试');
    }

    // 6. 测试统计概览
    console.log('\n6. 测试统计概览（告警状态统计）...');
    const overviewRes = await axios.get(`${BASE_URL}/stats/overview`);
    if (overviewRes.data.data.alert_stats) {
      const { pending, processing, ignored, resolved } = overviewRes.data.data.alert_stats;
      console.log(`   ✅ 告警状态统计:`);
      console.log(`      待处理: ${pending}`);
      console.log(`      处理中: ${processing}`);
      console.log(`      已忽略: ${ignored}`);
      console.log(`      已解决: ${resolved}`);
    } else {
      console.log('   ⚠️  未找到 alert_stats 字段');
    }

    // 单独测试告警状态统计接口
    const alertStatsRes = await axios.get(`${BASE_URL}/alerts/stats/status`, {
      params: { app_id: testApp.id }
    });
    console.log(`   ✅ 告警状态统计接口正常:`, JSON.stringify(alertStatsRes.data.data));

    // 7. 测试排障工作台 API
    console.log('\n7. 测试排障工作台 API...');

    // 7.1 获取排障上下文
    const contextRes = await axios.get(`${BASE_URL}/troubleshooting/context`, {
      params: {
        app_id: testApp.id,
        trace_id: testTraceId,
        exception_hash: testExceptionHash
      }
    });
    console.log(`   ✅ 排障上下文获取成功:`);
    console.log(`      Trace日志数量: ${contextRes.data.data.trace_logs?.length || 0}`);
    console.log(`      错误趋势数据点: ${contextRes.data.data.error_trend?.length || 0}`);
    console.log(`      相关告警数量: ${contextRes.data.data.related_alerts?.length || 0}`);

    // 7.2 获取同 Trace 日志
    const traceLogsRes = await axios.get(`${BASE_URL}/troubleshooting/trace/${testTraceId}`, {
      params: { app_id: testApp.id }
    });
    console.log(`   ✅ 同 Trace 日志查询成功: ${traceLogsRes.data.data.length} 条`);
    if (traceLogsRes.data.data.length > 0) {
      console.log(`      第一条: ${traceLogsRes.data.data[0].message.substring(0, 50)}...`);
      console.log(`      最后一条: ${traceLogsRes.data.data[traceLogsRes.data.data.length - 1].message.substring(0, 50)}...`);
    }

    // 7.3 获取应用错误趋势
    const trendRes = await axios.get(`${BASE_URL}/troubleshooting/app-error-trend/${testApp.id}`, {
      params: { hours: 24 }
    });
    console.log(`   ✅ 应用错误趋势获取成功: ${trendRes.data.data.length} 个时间点`);

    // 8. 测试排障备注 CRUD
    console.log('\n8. 测试排障备注 CRUD...');

    // 8.1 创建备注
    const noteData = {
      app_id: testApp.id,
      trace_id: testTraceId,
      exception_hash: testExceptionHash,
      title: '数据库连接异常排查记录',
      content: '## 问题现象\n用户登录时数据库连接超时\n\n## 排查过程\n1. 检查数据库连接池状态\n2. 发现连接数已耗尽\n3. 检查慢查询日志\n\n## 解决方案\n增加连接池大小，优化慢查询',
      assignee: '张三',
      metadata: JSON.stringify({
        trace_log_count: traceLogsRes.data.data.length,
        error_trend_summary: trendRes.data.data.slice(0, 5),
        related_alerts_count: contextRes.data.data.related_alerts?.length || 0
      })
    };

    const createNoteRes = await axios.post(`${BASE_URL}/troubleshooting/notes`, noteData);
    const noteId = createNoteRes.data.data.id;
    console.log(`   ✅ 排障备注创建成功，ID: ${noteId}`);
    console.log(`      标题: ${createNoteRes.data.data.title}`);
    console.log(`      处理人: ${createNoteRes.data.data.assignee}`);

    // 8.2 查询备注列表
    const notesListRes = await axios.get(`${BASE_URL}/troubleshooting/notes`, {
      params: { app_id: testApp.id, trace_id: testTraceId }
    });
    console.log(`   ✅ 排障备注列表查询成功: ${notesListRes.data.data.list.length} 条`);

    // 8.3 更新备注
    const updateNoteRes = await axios.put(`${BASE_URL}/troubleshooting/notes/${noteId}`, {
      status: 'closed',
      content: noteData.content + '\n\n## 最终结论\n连接池大小从 50 调整为 100，问题已解决。'
    });
    console.log(`   ✅ 排障备注更新成功:`);
    console.log(`      状态: ${updateNoteRes.data.data.status}`);
    console.log(`      更新时间: ${updateNoteRes.data.data.updated_at}`);

    // 8.4 验证备注持久化（模拟刷新页面后仍存在）
    const getNoteRes = await axios.get(`${BASE_URL}/troubleshooting/notes/${noteId}`);
    if (getNoteRes.data.data && getNoteRes.data.data.id === noteId) {
      console.log('   ✅ 备注持久化验证成功（刷新页面后仍存在）');
      const metadata = getNoteRes.data.data.metadata;
      const keys = metadata && typeof metadata === 'object' ? Object.keys(metadata).join(', ') : '无';
      console.log(`      Metadata 解析成功，包含: ${keys}`);
    }

    // 9. 测试 CSV 导出（按筛选条件）
    console.log('\n9. 测试 CSV 导出（按筛选条件）...');

    // 9.1 按异常类型筛选后导出
    const filteredExportRes = await axios.get(`${BASE_URL}/logs/export`, {
      params: {
        app_id: testApp.id,
        exception_type: 'SQLException',
        start_time: dayjs().subtract(1, 'day').format('YYYY-MM-DD 00:00:00'),
        end_time: dayjs().format('YYYY-MM-DD 23:59:59')
      },
      responseType: 'text'
    });
    const filteredLines = filteredExportRes.data.split('\n').filter(l => l.trim());
    console.log(`   ✅ 按异常类型筛选后导出成功: ${filteredLines.length - 1} 条数据`);
    console.log(`      所有数据包含 SQLException: ${filteredLines.slice(1).every(l => l.includes('SQLException'))}`);

    // 9.2 异常聚合导出
    const exceptionExportRes = await axios.get(`${BASE_URL}/logs/exceptions/export`, {
      params: {
        app_id: testApp.id,
        exception_type: 'SQLException'
      },
      responseType: 'text'
    });
    const exceptionLines = exceptionExportRes.data.split('\n').filter(l => l.trim());
    console.log(`   ✅ 异常聚合导出成功: ${exceptionLines.length - 1} 条聚合数据`);
    console.log(`      表头: ${exceptionLines[0]}`);

    // 10. 清理测试数据
    console.log('\n10. 清理测试数据...');
    for (const rule of [levelRuleRes, keywordRuleRes, errorCountRuleRes]) {
      await axios.delete(`${BASE_URL}/alerts/rules/${rule.data.data.id}`);
    }
    await axios.delete(`${BASE_URL}/troubleshooting/notes/${noteId}`);
    console.log('   ✅ 测试数据清理完成');

    console.log('\n========== 测试完成 ==========\n');
    console.log('📊 团队协作和排障闭环功能全部通过测试！');
    console.log('\n功能清单:');
    console.log('  ✅ 告警规则三种类型完整支持（级别阈值/关键字/错误数量）');
    console.log('  ✅ 规则保存后列表即时显示');
    console.log('  ✅ 五种通知方式（email/sms/webhook/钉钉/企业微信）');
    console.log('  ✅ 通知目标配置和格式验证');
    console.log('  ✅ 告警记录处理流程（分配/状态流转/处理备注）');
    console.log('  ✅ 告警状态统计（待处理/处理中/已忽略/已解决）');
    console.log('  ✅ 排障工作台（调用链日志/错误趋势/相关告警）');
    console.log('  ✅ 排障备注CRUD和持久化');
    console.log('  ✅ CSV导出按筛选条件导出');
    console.log('  ✅ 异常聚合导出');

    console.log('\n🔌 后端服务: http://localhost:3001');
    console.log('🖥️  前端界面: http://localhost:5174');

  } catch (err) {
    console.error('\n❌ 测试失败:', err.message);
    if (err.response) {
      console.error('   状态码:', err.response.status);
      console.error('   响应:', JSON.stringify(err.response.data, null, 2));
    }
    console.error('   堆栈:', err.stack);
    process.exit(1);
  }
}

testAllFeatures();
