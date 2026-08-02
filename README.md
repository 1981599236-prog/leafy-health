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
# 一叶健康记录

这是一个给个人使用的移动端健康记录 Web App，记录血压、饮食与运动，并保存到腾讯云 CloudBase。

## 本地启动

1. 在项目根目录创建 `.env.local`：

   ```env
   NEXT_PUBLIC_CLOUDBASE_ENV_ID=leafy-health-d6g6dzt250e0fc4d5
   ```

2. 安装依赖并启动：

   ```bash
   npm install
   npm run dev
   ```

浏览器打开 `http://localhost:3000`。

## 部署到腾讯云 CloudBase

应用已配置为静态导出：执行 `npm run build` 后会生成 `out` 文件夹。CloudBase 的静态网站托管可以直接部署这个文件夹，不需要自己购买服务器。

在 CloudBase 控制台打开 **静态网站托管**，选择 Git 仓库部署，填写：

- 仓库：`1981599236-prog/leafy-health`
- 分支：`main`
- 安装命令：`npm install`
- 构建命令：`npm run build`
- 发布目录：`out`

部署成功后，请使用 CloudBase 给出的 `tcloudbaseapp.com` 网站地址访问。这样网站与登录、数据服务都在同一个腾讯云环境中，避免 Vercel 与 CloudBase 之间的跨域访问问题。

## 数据库集合

CloudBase 文档型数据库使用以下集合：

- `health_profiles`
- `health_blood`
- `health_food`
- `health_exercise`

每个集合应采用“读取和修改本人数据”权限规则，使每位用户只能访问自己的记录。
