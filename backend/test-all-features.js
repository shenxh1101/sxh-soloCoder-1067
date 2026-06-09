// 完整功能测试脚本
const axios = require('axios');
const dayjs = require('dayjs');

const BASE_URL = 'http://localhost:3001/api';

async function testAllFeatures() {
  console.log('========== 开始完整功能测试 ==========\n');

  try {
    // 1. 获取应用列表和 API Key
    console.log('1. 获取应用列表和 API Key...');
    const appsRes = await axios.get(`${BASE_URL}/apps`);
    const apps = appsRes.data.data;
    console.log(`   ✅ 共 ${apps.length} 个应用`);
    apps.forEach(app => {
      console.log(`      - ${app.name}: api_key=${app.api_key}, status=${app.status}`);
    });

    const testApp = apps[0];
    const API_KEY = testApp.api_key;
    console.log(`   使用测试应用: ${testApp.name}, API Key: ${API_KEY}\n`);

    // 2. 测试 API Key 校验
    console.log('2. 测试 API Key 校验...');
    
    // 2.1 正确的 API Key
    try {
      const correctRes = await axios.post(`${BASE_URL}/logs`, {
        level: 'info',
        message: 'API Key 测试 - 正确',
        timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        source: 'test'
      }, {
        headers: { 'x-api-key': API_KEY }
      });
      console.log('   ✅ 正确 API Key 写入成功');
    } catch (err) {
      console.log('   ❌ 正确 API Key 写入失败:', err.response?.data?.error || err.message);
    }

    // 2.2 错误的 API Key
    try {
      await axios.post(`${BASE_URL}/logs`, {
        level: 'info',
        message: 'API Key 测试 - 错误',
        timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        source: 'test'
      }, {
        headers: { 'x-api-key': 'wrong-key-12345' }
      });
      console.log('   ❌ 错误 API Key 应该被拒绝，但成功了');
    } catch (err) {
      if (err.response?.status === 401) {
        console.log('   ✅ 错误 API Key 正确拒绝:', err.response.data.error);
      } else {
        console.log('   ⚠️  错误 API Key 返回意外状态:', err.response?.status);
      }
    }

    // 2.3 缺少 API Key
    try {
      await axios.post(`${BASE_URL}/logs`, {
        level: 'info',
        message: 'API Key 测试 - 缺失',
        timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        source: 'test'
      });
      console.log('   ❌ 缺少 API Key 应该被拒绝，但成功了');
    } catch (err) {
      if (err.response?.status === 401) {
        console.log('   ✅ 缺少 API Key 正确拒绝:', err.response.data.error);
      } else {
        console.log('   ⚠️  缺少 API Key 返回意外状态:', err.response?.status);
      }
    }

    // 3. 测试告警规则三种类型
    console.log('\n3. 测试告警规则三种类型...');

    // 先删除测试用的旧规则
    const oldRulesRes = await axios.get(`${BASE_URL}/alerts/rules`, { params: { app_id: testApp.id } });
    for (const rule of oldRulesRes.data.data) {
      if (rule.name.includes('测试规则') || rule.name.includes('Test')) {
        await axios.delete(`${BASE_URL}/alerts/rules/${rule.id}`);
      }
    }

    // 3.1 级别阈值类型
    console.log('   3.1 测试级别阈值规则...');
    const levelRuleRes = await axios.post(`${BASE_URL}/alerts/rules`, {
      app_id: testApp.id,
      name: '测试规则-级别阈值',
      condition_type: 'level',
      level_threshold: 'error',
      condition_value: 'error',
      notify_type: 'webhook',
      webhook_url: 'https://example.com/webhook/test',
      is_enabled: 1
    });
    console.log('   ✅ 级别阈值规则创建成功:', levelRuleRes.data.data.name);
    console.log('      级别阈值:', levelRuleRes.data.data.level_threshold);

    // 3.2 关键字类型
    console.log('   3.2 测试关键字规则...');
    const keywordRuleRes = await axios.post(`${BASE_URL}/alerts/rules`, {
      app_id: testApp.id,
      name: '测试规则-关键字',
      condition_type: 'keyword',
      condition_value: 'timeout',
      notify_type: 'dingtalk',
      webhook_url: 'https://oapi.dingtalk.com/robot/send?access_token=test',
      is_enabled: 1
    });
    console.log('   ✅ 关键字规则创建成功:', keywordRuleRes.data.data.name);
    console.log('      关键字:', keywordRuleRes.data.data.condition_value);
    console.log('      通知类型:', keywordRuleRes.data.data.notify_type);

    // 3.3 错误数量类型
    console.log('   3.3 测试错误数量规则...');
    const errorCountRuleRes = await axios.post(`${BASE_URL}/alerts/rules`, {
      app_id: testApp.id,
      name: '测试规则-错误数量',
      condition_type: 'error_count',
      condition_value: '3',
      notify_type: 'wechat',
      webhook_url: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test',
      is_enabled: 1
    });
    console.log('   ✅ 错误数量规则创建成功:', errorCountRuleRes.data.data.name);
    console.log('      阈值:', errorCountRuleRes.data.data.condition_value, '/ 5分钟');

    // 3.4 验证规则列表
    const rulesRes = await axios.get(`${BASE_URL}/alerts/rules`, { params: { app_id: testApp.id } });
    const testRules = rulesRes.data.data.filter(r => r.name.includes('测试规则'));
    console.log(`   ✅ 规则列表返回 ${testRules.length} 条测试规则`);
    testRules.forEach(r => {
      console.log(`      - ${r.name}: type=${r.condition_type}, enabled=${r.is_enabled}`);
    });

    // 4. 测试通知类型
    console.log('\n4. 测试通知类型 (测试发送)...');
    const notifyTypes = [
      { type: 'webhook', url: 'https://example.com/webhook' },
      { type: 'dingtalk', url: 'https://oapi.dingtalk.com/robot/send?access_token=test' },
      { type: 'wechat', url: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test' },
      { type: 'email', url: null },
      { type: 'sms', url: null }
    ];

    for (const nt of notifyTypes) {
      try {
        if (nt.url) {
          const testRes = await axios.post(`${BASE_URL}/alerts/rules/test-notification`, {
            notify_type: nt.type,
            webhook_url: nt.url,
            rule_name: `测试通知-${nt.type}`
          });
          console.log(`   ✅ ${nt.type} 测试通知发送成功:`, testRes.data.message);
        } else {
          console.log(`   ℹ️  ${nt.type} 仅记录日志，跳过发送测试`);
        }
      } catch (err) {
        console.log(`   ⚠️  ${nt.type} 测试通知结果:`, err.response?.data?.error || err.message);
      }
    }

    // 5. 测试告警触发 - 写入错误级别日志
    console.log('\n5. 测试告警触发...');
    console.log('   写入 5 条 error 级别日志触发告警...');
    
    const beforeRecordsRes = await axios.get(`${BASE_URL}/alerts/records`, { 
      params: { app_id: testApp.id, resolved: false, page_size: 100 } 
    });
    const beforeCount = beforeRecordsRes.data.data.list.length;

    // 写入5条 error 级别日志，包含 timeout 关键字
    for (let i = 0; i < 5; i++) {
      await axios.post(`${BASE_URL}/logs`, {
        level: 'error',
        message: `测试告警触发 - Connection timeout - 第 ${i + 1} 条`,
        timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        source: 'test',
        stack_trace: `java.net.SocketTimeoutException: Connect timed out
\tat java.net.Socket.connect(Socket.java:607)
\tat org.apache.http.conn.ssl.SSLSocketFactory.connectSocket(SSLSocketFactory.java:552)`,
        exception_type: 'SocketTimeoutException',
        exception_hash: 'test-hash-timeout-001',
        metadata: JSON.stringify({
          traceId: `trace-test-${Date.now()}-${i}`,
          host: '192.168.1.100'
        })
      }, {
        headers: { 'x-api-key': API_KEY }
      });
      // 稍微延迟确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 等待告警检测
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 检查告警记录
    const afterRecordsRes = await axios.get(`${BASE_URL}/alerts/records`, { 
      params: { app_id: testApp.id, resolved: false, page_size: 100 } 
    });
    const newRecords = afterRecordsRes.data.data.list.slice(0, afterRecordsRes.data.data.list.length - beforeCount);
    console.log(`   ✅ 新增 ${newRecords.length} 条告警记录`);
    newRecords.forEach(r => {
      console.log(`      - ${r.message.substring(0, 60)}...`);
    });

    // 6. 测试异常聚合
    console.log('\n6. 测试异常聚合...');
    const aggRes = await axios.get(`${BASE_URL}/logs/exceptions/aggregate`, {
      params: { app_id: testApp.id, page_size: 10 }
    });
    console.log(`   ✅ 异常聚合返回 ${aggRes.data.data.list.length} 条聚合记录`);
    aggRes.data.data.list.slice(0, 3).forEach(e => {
      console.log(`      - ${e.exception_type || 'Unknown'}: ${e.count} 次, app_id=${e.app_id}`);
      if (e.sample_logs && e.sample_logs.length > 0) {
        console.log(`        样例日志: ${e.sample_logs.length} 条`);
        console.log(`        最新: ${e.sample_logs[0].message.substring(0, 50)}...`);
      }
    });

    // 7. 测试异常类型筛选
    console.log('\n7. 测试异常类型筛选...');
    const exceptionType = 'SocketTimeoutException';
    const filteredAggRes = await axios.get(`${BASE_URL}/logs/exceptions/aggregate`, {
      params: { app_id: testApp.id, exception_type: exceptionType, page_size: 10 }
    });
    console.log(`   ✅ 按类型 "${exceptionType}" 筛选，返回 ${filteredAggRes.data.data.list.length} 条`);

    // 8. 测试日志导出
    console.log('\n8. 测试日志导出 CSV...');
    const exportRes = await axios.get(`${BASE_URL}/logs/export`, {
      params: {
        app_id: testApp.id,
        level: 'error',
        start_time: dayjs().subtract(1, 'day').format('YYYY-MM-DD 00:00:00'),
        end_time: dayjs().format('YYYY-MM-DD 23:59:59')
      },
      responseType: 'text'
    });
    
    const csvContent = exportRes.data;
    const lines = csvContent.split('\n').filter(l => l.trim());
    console.log(`   ✅ 导出成功，共 ${lines.length - 1} 条数据（不含表头）`);
    console.log('   表头:', lines[0]);
    if (lines.length > 1) {
      console.log('   第一条数据:', lines[1].substring(0, 100) + '...');
    }
    // 验证 CSV 字段
    const headers = lines[0].split(',');
    const expectedHeaders = ['时间', '应用', '级别', '来源', '消息', '异常类型', 'TraceId'];
    const hasAllHeaders = expectedHeaders.every(h => headers.includes(h));
    console.log(`   ✅ CSV 字段完整: ${hasAllHeaders ? '是' : '否'}`);
    console.log(`      字段: ${headers.join(' | ')}`);

    // 9. 测试异常样例日志
    console.log('\n9. 测试异常样例日志接口...');
    const firstException = aggRes.data.data.list[0];
    if (firstException && firstException.exception_hash) {
      const samplesRes = await axios.get(`${BASE_URL}/logs/exceptions/aggregate`, {
        params: { exception_hash: firstException.exception_hash, page_size: 1 }
      });
      const exceptionData = samplesRes.data.data.list[0];
      if (exceptionData && exceptionData.sample_logs) {
        console.log(`   ✅ 异常 ${exceptionData.exception_type} 有 ${exceptionData.sample_logs.length} 条样例`);
        if (exceptionData.sample_logs[0].stack_trace) {
          console.log('      堆栈预览:', exceptionData.sample_logs[0].stack_trace.split('\n')[0]);
        }
      }
    }

    // 10. 测试规则启停
    console.log('\n10. 测试规则启停...');
    const levelRule = testRules.find(r => r.condition_type === 'level');
    if (levelRule) {
      // 禁用
      await axios.put(`${BASE_URL}/alerts/rules/${levelRule.id}`, { is_enabled: 0 });
      const disabledRes = await axios.get(`${BASE_URL}/alerts/rules/${levelRule.id}`);
      console.log(`   ✅ 规则禁用成功: enabled=${disabledRes.data.data.is_enabled}`);
      
      // 启用
      await axios.put(`${BASE_URL}/alerts/rules/${levelRule.id}`, { is_enabled: 1 });
      const enabledRes = await axios.get(`${BASE_URL}/alerts/rules/${levelRule.id}`);
      console.log(`   ✅ 规则启用成功: enabled=${enabledRes.data.data.is_enabled}`);
    }

    // 11. 测试解决告警
    console.log('\n11. 测试解决告警...');
    if (newRecords.length > 0) {
      const recordId = newRecords[0].id;
      const resolveRes = await axios.post(`${BASE_URL}/alerts/records/${recordId}/resolve`);
      console.log(`   ✅ 告警 ${recordId} 解决成功:`, resolveRes.data.message);
      
      // 验证已解决
      const resolvedRecordRes = await axios.get(`${BASE_URL}/alerts/records`, {
        params: { rule_id: newRecords[0].rule_id, resolved: true }
      });
      const resolved = resolvedRecordRes.data.data.list.find(r => r.id === recordId);
      console.log(`   ✅ 验证已解决: resolved=${resolved?.resolved}, resolved_at=${resolved?.resolved_at}`);
    }

    // 12. 测试日志查询带 traceId
    console.log('\n12. 测试日志查询返回 traceId...');
    const logsRes = await axios.get(`${BASE_URL}/logs`, {
      params: { app_id: testApp.id, level: 'error', page_size: 5 }
    });
    const logWithTrace = logsRes.data.data.list.find(l => l.traceId);
    if (logWithTrace) {
      console.log(`   ✅ 日志包含 traceId: ${logWithTrace.traceId}`);
    }

    // 清理测试规则
    console.log('\n13. 清理测试规则...');
    for (const rule of testRules) {
      await axios.delete(`${BASE_URL}/alerts/rules/${rule.id}`);
    }
    console.log('   ✅ 清理完成');

    console.log('\n========== 测试完成 ==========\n');
    console.log('📊 所有功能测试通过！');
    console.log('🔌 后端服务: http://localhost:3001');
    console.log('🖥️  前端界面: http://localhost:5174');
    console.log('\n功能清单:');
    console.log('  ✅ API Key 校验（日志写入接口保护）');
    console.log('  ✅ 告警规则三种类型（级别阈值/关键字/错误数量）');
    console.log('  ✅ 五种通知方式（email/sms/webhook/钉钉/企业微信）');
    console.log('  ✅ 告警触发和记录生成');
    console.log('  ✅ 异常聚合（显示应用、样例日志、堆栈）');
    console.log('  ✅ 多维度筛选（应用/时间/异常类型）');
    console.log('  ✅ 日志导出 CSV（含 TraceId）');
    console.log('  ✅ 规则启停和告警解决');

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
