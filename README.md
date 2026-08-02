# 一叶健康记录

移动端优先的个人健康记录 App。当前迁移为使用腾讯云 CloudBase 保存登录状态和健康记录，便于国内手机网络访问。

## 本地启动

```bash
npm install
npm run dev
```

CloudBase 环境 ID 已写入 `lib/cloudbase.ts`（它不是密钥）。如需更换环境，可在 `.env.local` 中覆盖：

```env
NEXT_PUBLIC_CLOUDBASE_ENV_ID=你的完整环境ID
```

## CloudBase 初始化

按 [cloudbase/README.md](cloudbase/README.md) 创建 4 个文档型数据库集合，并对每一个集合选择“读取和修改本人数据”。然后在 CloudBase 的安全来源中添加实际部署地址。

## 当前功能

- 首次邮箱验证码确认，之后使用用户名密码登录
- 身体档案与日常消耗估算
- 自动保存血压、确认保存饮食、一键保存运动
- 今日热量汇总与真实打卡日历
- AI 模型选择界面；图片识别暂为模拟结果

## 后续

本次迁移完成后，先可在现有 Vercel 地址测试 CloudBase 登录和数据保存；正式国内部署时，将改由 CloudBase 静态网站托管或 HTTP 访问服务提供访问地址。不要将 CloudBase 的 API Key、SecretId 或 SecretKey 放进前端环境变量。
