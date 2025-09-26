import axios from 'axios'; // 引入 axios 库，用于直接发送 API 请求
import env from '../utils/env.js';
import Notify from "../utils/notify.js";

class Task {
    constructor(dify) {
      this.dify = dify;
    }
    taskName = "";
    async run() {}
    toString() {
      return `[${this.taskName}]`;
    }
}

class WorkflowTask extends Task {
    taskName = "Dify工作流任务";

    async run() {
      if (!env.DIFY_BASE_URL) {
        throw new Error("没有配置Dify api地址，请检查后执行!");
      }
      let inputs = {};
      try {
        inputs = env.DIFY_INPUTS ? JSON.parse(env.DIFY_INPUTS) : {};
      } catch (error) {
        console.error('DIFY_INPUTS 格式错误，请确保是json格式, 可能会影响任务流执行');
      }
      
      const user = 'dify-schedule-direct-api';
      const url = `${env.DIFY_BASE_URL}/workflows/run`;

      console.log(`Dify工作流开始执行... (API Key: ...${this.dify.token.slice(-4)})`);
      console.log(`请求地址: ${url}`);

      const requestBody = {
          inputs: inputs,
          response_mode: "blocking",
          user: user
      };

      console.log('发送请求体:', JSON.stringify(requestBody, null, 2));

      const response = await axios.post(url, requestBody, {
          headers: {
              'Authorization': `Bearer ${this.dify.token}`,
              'Content-Type': 'application/json'
          }
      });
      
      console.log('工作流原始返回:', JSON.stringify(response.data, null, 2));

      // --- 核心修改：现在代码会优先寻找任何string类型的输出作为邮件内容 ---
      if (response.data && response.data.data && response.data.data.outputs) {
        const outputs = response.data.data.outputs;

        // 查找第一个值为字符串类型的输出变量
        const outputKey = Object.keys(outputs).find(key => typeof outputs[key] === 'string');

        if (outputKey) {
            console.log(`成功找到字符串类型的输出变量 [${outputKey}]，将直接使用其内容。`);
            this.result = outputs[outputKey];
        } else {
            console.log("未找到任何字符串类型的输出变量，将美化显示整个 outputs JSON。");
            // 如果没有任何字符串输出，则美化显示整个 JSON 以便调试
            const formattedJson = JSON.stringify(outputs, null, 2);
            this.result = `<p>执行成功，但未在返回结果中找到任何文本类型的输出。原始输出如下：</p><pre style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; white-space: pre-wrap; word-wrap: break-word;"><code>${formattedJson}</code></pre>`;
        }
      } else {
        this.result = `<p>工作流执行成功，但返回的数据结构不符合预期。</p><pre><code>${JSON.stringify(response.data, null, 2)}</code></pre>`;
      }
    }

    toString() {
        return this.result
    }
}

async function run(args) {
    if (!env.DIFY_TOKENS) {
      const errorMsg = "错误：环境变量 DIFY_TOKENS 未设置。";
      console.error(errorMsg);
      Notify.pushMessage({ title: "Dify助手配置错误", content: errorMsg, msgtype: "text" });
      return;
    }

    const tokens = env.DIFY_TOKENS.split(';').filter(t => t);
    let messageList = [];
    console.log(`检测到 ${tokens.length} 个工作流任务。`);

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const workflow = new WorkflowTask({token});
      
      try {
        console.log(`\n--- [任务 ${i + 1}/${tokens.length}] 开始 ---`);
        await workflow.run();
        const content = workflow.toString();
        
        console.log(`--- [任务 ${i + 1}/${tokens.length}] 执行结果 (HTML) ---`);
        console.log(content); 
        
        messageList.push(`<h4>[任务 ${i + 1}]</h4>${content}`);

      } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data, null, 2) : error.message;
        console.error(`--- [任务 ${i + 1}/${tokens.length}] 执行失败 ---`);
        console.error(error);
        messageList.push(`<h4>[任务 ${i + 1} 失败]</h4><p>错误信息:</p><pre><code>${errorMessage}</code></pre>`);
      } finally {
        console.log(`--- [任务 ${i + 1}/${tokens.length}] 结束 ---\n`);
      }
    }

    if (messageList.length > 0) {
      const message = messageList.join(`<hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">`);
      
      // 确保邮件以 HTML 格式发送
      Notify.pushMessage({ 
          title: "Dify工作流定时助手", 
          content: message, 
          msgtype: "html" 
      });
    } else {
       console.log("所有任务执行完毕，但没有生成任何消息。");
    }
}

run(process.argv.splice(2)).catch(error => {
    console.error("脚本发生致命错误:", error);
    const errorMessage = error.response ? JSON.stringify(error.response.data, null, 2) : error.message;
    Notify.pushMessage({ title: "Dify助手脚本崩溃", content: `<strong>错误:</strong><br><pre><code>${errorMessage}</code></pre>`, msgtype: "html" });
    process.exit(1);
});

