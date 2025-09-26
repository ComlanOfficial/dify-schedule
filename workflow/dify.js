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
        // 关键：直接使用 DIFY_INPUTS 的内容作为 inputs 对象
        inputs = env.DIFY_INPUTS ? JSON.parse(env.DIFY_INPUTS) : {};
      } catch (error) {
        console.error('DIFY_INPUTS 格式错误，请确保是json格式, 可能会影响任务流执行');
      }
      
      const user = 'dify-schedule-direct-api'; // 使用新的 user 标识
      const url = `${env.DIFY_BASE_URL}/workflows/run`; // 拼接正确的请求 URL

      console.log(`Dify工作流开始执行... (API Key: ...${this.dify.token.slice(-4)})`);
      console.log(`请求地址: ${url}`);

      // --- 核心修改：我们不再使用 SDK，而是直接用 axios 发送请求 ---
      const requestBody = {
          inputs: inputs, // 使用从环境变量解析出的 inputs 对象
          response_mode: "blocking", // 明确要求同步阻塞模式
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

      // --- 提取结果的逻辑 ---
      // 根据您 Apifox 成功的返回结果，最终数据在 response.data.data.outputs 中
      if (response.data && response.data.data && response.data.data.outputs) {
        this.result = `执行成功！\n输出内容:\n${JSON.stringify(response.data.data.outputs, null, 2)}`;
      } else if (response.data) {
        this.result = `执行成功！\n但未找到 outputs，原始返回:\n${JSON.stringify(response.data, null, 2)}`;
      } else {
        this.result = "工作流执行完毕，但未返回任何有效内容。";
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
        
        console.log(`--- [任务 ${i + 1}/${tokens.length}] 执行结果 ---`);
        console.log(content);
        
        messageList.push(`[任务 ${i + 1} 成功]\n${content}`);

      } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data, null, 2) : error.message;
        console.error(`--- [任务 ${i + 1}/${tokens.length}] 执行失败 ---`);
        console.error(error);
        messageList.push(`[任务 ${i + 1} 失败]\n错误信息: ${errorMessage}`);
      } finally {
        console.log(`--- [任务 ${i + 1}/${tokens.length}] 结束 ---\n`);
      }
    }

    if (messageList.length > 0) {
      const message = messageList.join(`\n\n${"-".repeat(20)}\n\n`);
      Notify.pushMessage({ title: "Dify工作流定时助手", content: message, msgtype: "text" });
    } else {
       console.log("所有任务执行完毕，但没有生成任何消息。");
    }
}

run(process.argv.splice(2)).catch(error => {
    console.error("脚本发生致命错误:", error);
    const errorMessage = error.response ? JSON.stringify(error.response.data, null, 2) : error.message;
    Notify.pushMessage({ title: "Dify助手脚本崩溃", content: `错误: ${errorMessage}`, msgtype: "text" });
    process.exit(1);
});

