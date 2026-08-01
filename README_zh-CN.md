[English](README.md) | 简体中文

> ## 注意：阻断大量请求，请自己部署

---

## 🧡 cors (Cloudflare Workers)
支持跨域请求（转换不支持跨域请求的接口），可直接发起 ajax、fetch  
支持HTTPS（解决远程数据接口不支持HTTPS）

### 使用
`https://example.com/?url={URL}`
- `https://example.com/?url=https://api.github.com`
- `https://example.com/?url=http://nginx.org/download/nginx-1.20.2.tar.gz`

```js
// 拷贝到控制台运行
var $url = "http://wthrcdn.etouch.cn/weather_mini?citykey=101040100";
fetch("https://example.com/?url=" + encodeURIComponent($url)).then(x => x.text()).then(console.log)
```

### 部署

> 两种方法的工作原理一致

#### wrangler
- clone 项目，进入 cors 目录
- 如有需要，编辑 `index.js` 和 `wrangler.toml`（配置密钥）
- 安装 Wrangler 为开发依赖（需要 Node.js 22+）：
  ```
  npm install --save-dev wrangler
  ```
- 登录 Cloudflare 账号（会打开浏览器）：
  ```
  npx wrangler login
  ```
- 本地运行 Worker：
  ```
  npx wrangler dev
  ```
- 构建并部署到 Cloudflare 全球网络：
  ```
  npx wrangler deploy
  ```
- 详细文档：<https://developers.cloudflare.com/workers/wrangler/commands/>

> 注意：`wrangler config` 已被移除（改用 `wrangler login`），`wrangler build` + `wrangler publish` 已合并为一条 `wrangler deploy`。

#### Cloudflare 仪表板
- 转到 [Cloudflare 仪表板](https://dash.cloudflare.com)，然后切换到 `Workers` 标签
- `创建服务`
- `快速编缉`
- 清空编辑器
- 复制 [`cors/index.js`](cors/index.js) 中的代码到编辑器 (如果不需要日志，也可以使用 [`pages/_worker.js`](pages/_worker.js))
- 如有需要，编缉配置
- `保存并部署`

### 套餐
 CPU | 日请求 | 突发速率 | 脚本大小 
 ---- | ---- | ---- | ---- 
 10ms | 100,000 | 10分钟1000个请求 | 压缩后1M

详情：https://developers.cloudflare.com/workers/about/limits/

额度顶不住了，使用量大请用自己的账号搭建服务吧，谢谢！！！  
![溢出](https://s1.netnr.eu.org/2019/11/03/0752457693.png)

---

## 🧡 pages (Cloudflare Pages Functions)
### 使用
`https://example.com/?url={URL}`
- `https://example.com/?url=https://api.github.com`
- `https://example.com/?url=http://nginx.org/download/nginx-1.20.2.tar.gz`

### 部署

> 两种方法的工作原理一致

#### wrangler
需要 Node.js 22+。
```
npm install --save-dev wrangler # 安装
npx wrangler pages dev ./ # 本地运行 Pages 应用（在 pages 目录内运行）
npx wrangler pages deploy ./ --project-name=<PROJECT_NAME> # 直接部署 pages 目录
```
详细文档：<https://developers.cloudflare.com/pages/functions/local-development/>

#### Cloudflare 仪表板
- Fork 这个项目
- 如有需要，编缉 [`pages/_worker.js`](pages/_worker.js) 中的配置
- 转到 [Cloudflare 仪表板](https://dash.cloudflare.com)，然后切换到 `Pages` 标签
- `创建项目 ▼` -> `连接到 Git`
- 连接你的 GitHub 账户，选择刚刚创建的 fork
- `开始设置`
- 填写 `构建设置`: `框架预设` - <ins>`None`</ins>; `构建命令` - <ins>留空</ins>; `构建输出目录` - <ins>`pages`</ins>
- `保存并部署`

### 套餐
每天的调用请求总数上限为 100,000。如果达到每日限制，Pages 将停止执行函数并回退到仅提供静态资源。

---

## Source
- <https://github.com/Rongronggg9/rsstt-img-relay>
- <https://github.com/netnr/workers> (上游)
