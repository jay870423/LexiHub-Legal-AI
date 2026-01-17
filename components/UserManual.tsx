
import React from 'react';
import { Language } from '../types';
import { BookOpen, UserCheck, Telescope, FolderKanban, MessageSquareText, Settings } from 'lucide-react';

interface UserManualProps {
  lang: Language;
}

const UserManual: React.FC<UserManualProps> = ({ lang }) => {
  
  const content = {
    en: [
      {
        title: "1. Overview",
        icon: <BookOpen className="text-blue-600" />,
        text: "LexiHub is a vertical AI agent for the legal industry. It integrates data collection, structured analysis, and RAG-based legal assistance. This manual will help you understand the core features."
      },
      {
        title: "2. Account & Login",
        icon: <UserCheck className="text-green-600" />,
        text: "LexiHub supports Guest Mode and User Mode.",
        bullets: [
          "Guest Mode: Data is stored in your browser's local storage. Data will be lost if you clear browser cache.",
          "User Mode: Click 'Login' in the sidebar to sign in via Google or GitHub. Your data (Workspace Documents & Stats) will be synced to the Cloud (Supabase), allowing you to access it from any device."
        ]
      },
      {
        title: "3. Lead Discovery",
        icon: <Telescope className="text-purple-600" />,
        text: "An autonomous agent workflow to find legal service providers.",
        bullets: [
          "Input: Enter a natural language query like 'Find a divorce lawyer in Shanghai'.",
          "Process: The agent analyzes your intent -> Searches the live web using Gemini Grounding -> Uses an LLM to structure unstructured HTML data.",
          "Output: A clean table with Contact Name, Phone, and Address. Click 'Export CSV' to save results.",
          "Note: This feature requires a Gemini API Key with Search Tool access."
        ]
      },
      {
        title: "4. Personal Workspace",
        icon: <FolderKanban className="text-orange-600" />,
        text: "Your private knowledge base for RAG (Retrieval Augmented Generation).",
        bullets: [
          "Import: Click 'Import' to upload PDF, Word, Excel, or Text files. They are parsed locally in your browser.",
          "Edit: You can edit the content manually.",
          "AI Analysis: Select a document and click 'Deep Analysis'. The AI will generate a Risk Score, Executive Summary, and Actionable Insights.",
          "Cloud Sync: If logged in, documents are encrypted and stored in the database."
        ]
      },
      {
        title: "5. AI Assistant (Chat)",
        icon: <MessageSquareText className="text-indigo-600" />,
        text: "A Chatbot that knows your data.",
        bullets: [
          "Source Switching: Toggle between 'Public Data' (General Laws) and 'My Workspace' (Your uploaded files) at the top of the chat.",
          "RAG: When you ask a question in 'My Workspace' mode, the AI retrieves relevant chunks from your documents to answer accurately.",
          "References: The AI cites sources. Click a citation to preview the original document."
        ]
      },
      {
        title: "6. Settings & Providers",
        icon: <Settings className="text-slate-600" />,
        text: "Configure the AI engine driving LexiHub.",
        bullets: [
          "Gemini (Default): Fast and free-tier friendly. Required for Search Grounding.",
          "DeepSeek: Supports DeepSeek-V3. You must provide your own API Key.",
          "API Keys: Keys are stored securely in your browser's Local Storage.",
          "Proxy: Enable 'Use Vercel Proxy' if you have CORS issues connecting to DeepSeek."
        ]
      }
    ],
    zh: [
      {
        title: "1. 系统概览",
        icon: <BookOpen className="text-blue-600" />,
        text: "LexiHub 是一个面向法律行业的垂直 AI 智能体。它集成了数据采集、结构化分析和基于 RAG 的法律援助功能。本手册将帮助您快速上手。"
      },
      {
        title: "2. 账户与登录",
        icon: <UserCheck className="text-green-600" />,
        text: "LexiHub 支持访客模式和用户模式。",
        bullets: [
          "访客模式：数据存储在浏览器的本地缓存中。清除浏览器缓存会导致数据丢失。",
          "用户模式：点击侧边栏的“登录”按钮（支持 Google/GitHub）。登录后，您的数据（工作台文档和统计信息）将同步至云端数据库 (Supabase)，实现多端访问。"
        ]
      },
      {
        title: "3. 智能线索挖掘",
        icon: <Telescope className="text-purple-600" />,
        text: "全自动的法律服务供应商搜索工作流。",
        bullets: [
          "输入：输入自然语言指令，例如“帮我找几位上海擅长处理离婚案件的律师”。",
          "流程：Agent 自动识别意图 -> 调用 Gemini 联网搜索实时数据 -> 使用大模型将网页非结构化数据清洗为表格。",
          "输出：包含联系人、电话（支持点击拨打）、地址的清晰表格。支持一键导出 CSV。",
          "注意：此功能强依赖于 Gemini API 的搜索工具权限。"
        ]
      },
      {
        title: "4. 个人工作台",
        icon: <FolderKanban className="text-orange-600" />,
        text: "您的私有知识库，用于 RAG（检索增强生成）分析。",
        bullets: [
          "导入：点击“导入”上传 PDF, Word, Excel 或 TXT 文件。文件解析在浏览器本地完成，保护隐私。",
          "编辑：您可以手动修正或补充文档内容。",
          "AI 深度分析：选中一份文档，点击“深度分析”。AI 将自动生成风险评分、执行摘要和建议行动清单。",
          "云同步：登录状态下，文档将安全存储于云端数据库。"
        ]
      },
      {
        title: "5. AI 知识助手 (对话)",
        icon: <MessageSquareText className="text-indigo-600" />,
        text: "懂您数据的智能对话助手。",
        bullets: [
          "知识源切换：在聊天顶部切换“公共知识库”（通用法律法规）或“我的工作台”（您上传的文件）。",
          "RAG 技术：在“我的工作台”模式下提问，AI 会检索您文档中的相关片段进行回答，拒绝幻觉。",
          "引用溯源：AI 的回答会标注来源。点击引用标签即可预览原始文档内容。"
        ]
      },
      {
        title: "6. 设置与模型",
        icon: <Settings className="text-slate-600" />,
        text: "配置驱动 LexiHub 的 AI 引擎。",
        bullets: [
          "Gemini (默认)：速度快，支持 Google 联网搜索增强。",
          "DeepSeek：支持 DeepSeek-V3 模型。您需要填入自己的 API Key。",
          "API 密钥：密钥仅加密存储于您浏览器的本地缓存中 (Local Storage)。",
          "代理：如果连接 DeepSeek 遇到跨域 (CORS) 问题，请开启“使用 Vercel 代理”选项。"
        ]
      }
    ]
  };

  const sections = lang === 'zh' ? content.zh : content.en;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-[calc(100dvh-140px)] md:h-[calc(100dvh-10rem)] flex flex-col">
      <div className="p-6 border-b border-gray-100 bg-gray-50">
         <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="text-blue-600" />
            {lang === 'zh' ? 'LexiHub 用户操作手册' : 'LexiHub User Operation Manual'}
         </h2>
         <p className="text-sm text-slate-500 mt-1">
            {lang === 'zh' ? 'v1.0.0 - 最后更新: 2025年' : 'v1.0.0 - Last Updated: 2025'}
         </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-10 scroll-smooth">
         <div className="max-w-4xl mx-auto space-y-10 pb-10">
            {sections.map((section, idx) => (
               <div key={idx} className="animate-in slide-in-from-bottom-2 fade-in duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                  <div className="flex items-start gap-4">
                     <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 shrink-0 mt-1">
                        {section.icon}
                     </div>
                     <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-900 mb-2">{section.title}</h3>
                        <p className="text-slate-600 leading-relaxed mb-3">{section.text}</p>
                        {section.bullets && (
                           <ul className="space-y-2">
                              {section.bullets.map((bullet, bIdx) => (
                                 <li key={bIdx} className="flex items-start gap-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100/50">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0"></span>
                                    <span className="leading-relaxed">{bullet}</span>
                                 </li>
                              ))}
                           </ul>
                        )}
                     </div>
                  </div>
                  {idx !== sections.length - 1 && <div className="h-px bg-gray-100 mt-8 ml-16"></div>}
               </div>
            ))}
         </div>
      </div>
    </div>
  );
};

export default UserManual;
