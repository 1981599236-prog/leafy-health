# 一叶健康记录

移动端优先的个人健康记录 App。记录数据保存在 Supabase 中。

## 本地启动

```bash
npm install
npm run dev
```

在 `.env.local` 中配置：

```env
NEXT_PUBLIC_SUPABASE_URL=https://你的项目.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_你的密钥
```

## Supabase 初始化

在 Supabase Dashboard 的 **SQL Editor** 中运行 `supabase/migrations/20260731_initial_health_schema.sql`。它会创建档案、血压、饮食、运动记录表，并启用只允许本人访问的 RLS 规则。

## 当前功能

- 邮箱魔法链接登录
- 身体档案与日常消耗估算
- 自动保存血压、确认保存饮食、一键保存运动
- 今日热量汇总与真实打卡日历
- AI 模型选择界面；图片识别暂为模拟结果

## 后续

部署到 Vercel 后，将同样的 Supabase 环境变量填入 Vercel 的 Environment Variables。再将 Vercel HTTPS 地址加入 Supabase Authentication 的 Redirect URLs，即可在手机任意网络下使用。
