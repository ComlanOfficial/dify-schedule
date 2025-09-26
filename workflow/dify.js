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
      
      // --- 修改部分开始 ---
      // 跳过获取工作流信息，直接执行
      console.log(`Dify工作流开始执行... (v2 - 已跳过获取信息步骤)`);
      const response =  await workflow.getWorkflowResult(inputs, user, true);
      this.result = response.text || '';
      // --- 修改部分结束 ---
    }

    toString() {
        return this.result
    }
}

async function run(args) {
    // 检查 DIFY_TOKENS 是否已定义
    if (!env.DIFY_TOKENS) {
      console.error("错误：环境变量 DIFY_TOKENS 未设置。");
      Notify.pushMessage({
        title: "Dify工作流定时助手 - 错误",
        content: "环境变量 DIFY_TOKENS 未设置，请检查您的配置。",
        msgtype: "text"
      });
      return;
    }

    const tokens = env.DIFY_TOKENS.split(';');
    let messageList = [];
    for (let token of tokens) {
      // 过滤掉可能的空 token
      if (!token) continue;
      
      const workflow = new WorkflowTask({token});

      await workflow.run(); // 执行

      const content = workflow.toString();

      console.log('--- 工作流执行结果 ---');
      console.log(content); // 打印结果
      console.log('--- 执行结束 ---');

      messageList.push(content);
    }

    const message = messageList.join(`\n${"-".repeat(15)}\n`);
    Notify.pushMessage({
      title: "Dify工作流定时助手",
      content: message,
      msgtype: "text"
    });
  }

  run(process.argv.splice(2)).catch(error => {
    console.error("脚本执行失败:", error);
    Notify.pushMessage({
      title: "Dify工作流定时助手 - 失败",
      content: `错误: ${error.message}`,
      msgtype: "text"
    });

    // 在 GitHub Actions 中，非零退出码表示失败
    process.exit(1);
  });
