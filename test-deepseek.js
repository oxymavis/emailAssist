/**
 * DeepSeek API 集成测试脚本
 */

const OpenAI = require('openai');

// 配置 DeepSeek API
const deepseek = new OpenAI({
  apiKey: 'sk-c8daac3cc80c45a08e5495abf6baf214',
  baseURL: 'https://api.deepseek.com/v1'
});

async function testDeepSeekAPI() {
  console.log('🚀 开始测试 DeepSeek API 集成...\n');

  try {
    // 测试1: 基础对话
    console.log('📝 测试 1: 基础对话');
    const basicTest = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'user', content: 'Hello! Please respond with "DeepSeek API is working correctly!"' }
      ],
      max_tokens: 50,
      temperature: 0.1
    });

    console.log('✅ 响应:', basicTest.choices[0].message.content);
    console.log('');

    // 测试2: 邮件情感分析
    console.log('📧 测试 2: 邮件情感分析');
    const sentimentTest = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'You are an email sentiment analyzer. Return only one word: positive, neutral, negative, or mixed.' },
        { role: 'user', content: 'Analyze the sentiment of this email: "Thank you so much for your help! This was exactly what I needed."' }
      ],
      max_tokens: 10,
      temperature: 0.3
    });

    console.log('✅ 情感分析结果:', sentimentTest.choices[0].message.content);
    console.log('');

    // 测试3: 邮件分类
    console.log('🗂️ 测试 3: 邮件分类');
    const categoryTest = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'You are an email categorizer. Return only the category name.' },
        { role: 'user', content: 'Categorize this email: Subject: "Urgent: System maintenance scheduled for tonight" From: "IT Department" - Please classify this email.' }
      ],
      max_tokens: 20,
      temperature: 0.3
    });

    console.log('✅ 邮件分类:', categoryTest.choices[0].message.content);
    console.log('');

    // 测试4: 邮件摘要
    console.log('📄 测试 4: 邮件摘要生成');
    const summaryTest = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'You are an email summarizer. Provide concise, informative summaries.' },
        { role: 'user', content: 'Create a summary for this email: "Dear team, we need to schedule a meeting next week to discuss the Q4 project timeline. Please let me know your availability between Monday and Wednesday. The meeting should take about 2 hours and we\'ll cover budget review and resource allocation."' }
      ],
      max_tokens: 100,
      temperature: 0.5
    });

    console.log('✅ 邮件摘要:', summaryTest.choices[0].message.content);
    console.log('');

    console.log('🎉 所有测试通过！DeepSeek API 集成成功！');
    
    return {
      success: true,
      results: {
        basic: basicTest.choices[0].message.content,
        sentiment: sentimentTest.choices[0].message.content,
        category: categoryTest.choices[0].message.content,
        summary: summaryTest.choices[0].message.content
      }
    };

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('API 响应错误:', error.response.data);
    }
    return { success: false, error: error.message };
  }
}

// 运行测试
testDeepSeekAPI()
  .then(result => {
    if (result.success) {
      console.log('\n✅ DeepSeek API 集成验证完成！');
      process.exit(0);
    } else {
      console.log('\n❌ DeepSeek API 集成测试失败！');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ 测试运行错误:', error);
    process.exit(1);
  });