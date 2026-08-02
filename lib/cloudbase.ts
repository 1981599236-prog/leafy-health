'use client';

import cloudbase from '@cloudbase/js-sdk';

// 环境 ID 不是密钥，网页端需要它来连接对应的 CloudBase 环境。
// 线上部署时仍可用 NEXT_PUBLIC_CLOUDBASE_ENV_ID 覆盖，方便后续换环境。
const env = process.env.NEXT_PUBLIC_CLOUDBASE_ENV_ID || 'leafy-health-d6g6dzt250e0fc4d5';

export const cloudApp = cloudbase.init({
  env,
  region: 'ap-shanghai',
  timeout: 10_000,
});

// CloudBase 的类型会随 SDK 小版本变化；此处保持边界为 any，避免影响页面的业务类型。
export const cloudAuth: any = cloudApp.auth({ persistence: 'local' });
export const cloudDb: any = cloudApp.database();
