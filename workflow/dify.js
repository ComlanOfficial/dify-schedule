import { WorkflowClient } from '../sdk/dify.js'
import env from '../utils/env.js'
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
      if(!env.DIFY_BASE_URL) {
        throw new Error("没有配置Dify api地址，请检查后执行!");
      }
      let inputs = {}
      try {
        inputs = env.DIFY_INPUTS ? JSON.parse(env.DIFY_INPUTS) : {}
      } catch (error) {
        console.error('DIFY_INPUTS 格式错误，请确保是json格式, 可能会影响任务流执行')
      }
      const user = 'dify-schedule'
      const workflow = new WorkflowClient(this.dify.token, env.DIFY_BASE_URL);
      
      console.log(`Dify工作流开始执行... (API Key: ...${this.dify.token.slice(-4)})`);
      
      // 直接执行工作流
      const response =  await workflow.getWorkflowResult(inputs, user, false); // 改为 false 获取完整对象
      
      // --- 修改部分开始 ---
      // 增加健壮性，确保无论返回什么结构都能提取出有效信息
      console.log('工作流原始返回:', JSON.stringify(response, null, 2));

      if (response && response.data && response.data.outputs) {
        // 如果有 outputs，将其转换为字符串
        this.result = JSON.stringify(response.data.outputs, null, 2);
      } else if (response && response.text) {
        // 兼容旧的 .text 逻辑
        this.result = response.text;
      } else if (response) {
        // 如果上面都没有，就返回整个 response 对象
        this.result = JSON.stringify(response, null, 2);
      } else {
        this.result = "工作流执行完毕，但未返回任何有效内容。";
      }
      // --- 修改部分结束 ---
    }

    toString() {
        return this.result
    }
}

async function run(args) {
    if (!env.DIFY_TOKENS) {
      console.error("错误：环境变量 DIFY_TOKENS 未设置。");
      Notify.pushMessage({
        title: "Dify工作流定时助手 - 配置错误",
        content: "环境变量 DIFY_TOKENS 未设置，请检查您的配置。",
        msgtype: "text"
      });
      return;
    }

    const tokens = env.DIFY_TOKENS.split(';').filter(t => t); // 过滤空 token
    let messageList = [];
    console.log(`检测到 ${tokens.length} 个工作流任务。`);

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const workflow = new WorkflowTask({token});
      
      try {
        console.log(`\n--- [任务 ${i + 1}/${tokens.length}] 开始 ---`);
        await workflow.run(); // 执行
        const content = workflow.toString();
        
        console.log(`--- [任务 ${i + 1}/${tokens.length}] 执行结果 ---`);
        console.log(content);
        
        messageList.push(`[任务 ${i + 1} 成功]\n${content}`);

      } catch (error) {
        console.error(`--- [任务 ${i + 1}/${tokens.length}] 执行失败 ---`);
        console.error(error);
        messageList.push(`[任务 ${i + 1} 失败]\n错误信息: ${error.message}`);
      } finally {
        console.log(`--- [任务 ${i + 1}/${tokens.length}] 结束 ---\n`);
      }
    }

    if (messageList.length > 0) {
      const message = messageList.join(`\n\n${"-".repeat(20)}\n\n`);
      Notify.pushMessage({
        title: "Dify工作流定时助手",
        content: message,
        msgtype: "text"
      });
    } else {
       console.log("所有任务执行完毕，但没有生成任何消息。");
    }
  }

  run(process.argv.splice(2)).catch(error => {
    console.error("脚本发生致命错误:", error);
    Notify.pushMessage({
      title: "Dify工作流定时助手 - 脚本崩溃",
      content: `错误: ${error.message}`,
      msgtype: "text"
    });
    process.exit(1);
  });

