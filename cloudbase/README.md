# CloudBase 接入说明

当前健康 App 使用腾讯云 CloudBase 环境：`leafy-health-d6g6dzt250e0fc4d5`（上海）。

## 第一次配置

在 CloudBase 控制台的「文档型数据库」中分别创建以下 4 个集合：

- `health_profiles`
- `health_blood`
- `health_food`
- `health_exercise`

每一个集合的基础权限均选择「读取和修改本人数据」。这会让 CloudBase 依据系统写入的 `_openid` 字段隔离每个账号的数据。不要选择「读取全部数据」。

## Web 安全来源

在 CloudBase 控制台的「环境管理」或「安全来源」中，添加应用的网页来源：

- 本地调试：`http://localhost:3000`
- 上线地址：部署完成后填写 CloudBase 分配的 HTTPS 域名

如果暂时还用 Vercel 测试，可额外添加 `https://leafy-health-omega.vercel.app`。

## 数据结构

集合中的文档由前端自动创建：

- `health_profiles`：显示文字、性别、年龄、身高、体重、活动量、目标
- `health_blood`：收缩压、舒张压、记录时间
- `health_food`：识别菜品、热量、三大营养素、记录时间
- `health_exercise`：运动类型、时长、消耗、记录时间

所有记录均通过 CloudBase 的账号登录后读写；用户名密码由 CloudBase 身份认证管理，应用不会保存明文密码。
