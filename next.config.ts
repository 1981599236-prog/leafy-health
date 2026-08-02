import type { NextConfig } from "next";

// 生成纯静态文件，方便部署到腾讯云 CloudBase 的静态网站托管。
// 本应用目前所有数据均由浏览器直接安全地请求 CloudBase，因此不需要 Next.js 服务器。
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
};

export default nextConfig;
