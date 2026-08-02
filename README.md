English | [简体中文](README_zh-CN.md)

> ## Note: Block a large number of requests, please deploy yourself

---

## 🧡 cors (Cloudflare Workers)
Support cross-domain request  
Convert HTTP to HTTPS

### Usage
`https://example.com/?url={URL}`
- `https://example.com/?url=https://api.github.com`
- `https://example.com/?url=http://nginx.org/download/nginx-1.20.2.tar.gz`

```js
// Copy to the console and run
var $url = "http://wthrcdn.etouch.cn/weather_mini?citykey=101040100";
fetch("https://example.com/?url=" + encodeURIComponent($url)).then(x => x.text()).then(console.log)
```

### werss (WeChat full-text RSS)

Turn a WeChat Official Account RSS feed (e.g. the channels in [osnsyc/Wechat-Scholar](https://github.com/osnsyc/Wechat-Scholar)) into a full-text RSS feed. The relay fetches every linked `mp.weixin.qq.com` article and injects the full article HTML as `content:encoded`.

- Feed mode: `https://example.com/werss?url={RSS_FEED_URL}` returns an RSS 2.0 feed with full text
  - e.g. `https://example.com/werss?url=https://raw.githubusercontent.com/osnsyc/Wechat-Scholar/main/channels/gh_ec27b24114a0.xml`
- Article mode: `https://example.com/werss?url={mp.weixin.qq.com article URL}` returns the article body as HTML

Configurable via environment variables: `WERSS_MAX_ITEMS` (default `20`, max `50`), `WERSS_CONCURRENCY` (default `5`), `WERSS_CACHE` (default `900` seconds), `WERSS_USER_AGENT`.

### Deploy

> The mechanism of both methods is the same

#### wrangler
- Clone the project and enter the cors directory
- Edit `index.js` and `wrangler.toml` (configuration keys) if necessary
- Install Wrangler as a dev dependency (requires Node.js 22+):
  ```
  npm install --save-dev wrangler
  ```
- Log in to your Cloudflare account (opens your browser):
  ```
  npx wrangler login
  ```
- Run the Worker locally:
  ```
  npx wrangler dev
  ```
- Build and deploy to Cloudflare's global network:
  ```
  npx wrangler deploy
  ```
- Detailed documentation: <https://developers.cloudflare.com/workers/wrangler/commands/>

> Note: `wrangler config` was removed (use `wrangler login` instead), and `wrangler build` + `wrangler publish` are replaced by a single `wrangler deploy`.

#### Cloudflare Dashboard
- Turn to [Cloudflare Dashboard](https://dash.cloudflare.com), then switch to the `Workers` tab
- `Create a service`
- `Quick edit`
- Clear the editor
- Copy the code from [`cors/index.js`](cors/index.js) to the editor (if you don't care about logging, [`pages/_worker.js`](pages/_worker.js) is another choice)
- Edit the configurations if necessary
- `Save and Deploy`

### Price
  CPU  | Daily request | Burst rate | Script size
  ---- | ---- | ---- | ----
  10ms | 100,000 | 1000 requests in 10 minutes | 1M after compression

Details: <https://developers.cloudflare.com/workers/about/limits/>

The amount can't hold up, please use your account to build the service if you use a lot, thank you! ! !  
![overflow](https://s1.netnr.eu.org/2019/11/03/0752457693.png)

---

## 🧡 pages (Cloudflare Pages Functions)

### Usage
`https://example.com/?url={URL}`
- `https://example.com/?url=https://api.github.com`
- `https://example.com/?url=http://nginx.org/download/nginx-1.20.2.tar.gz`

### Deploy

> The mechanism of both methods is the same

#### wrangler
Requires Node.js 22+.
```
npm install --save-dev wrangler # install
npx wrangler pages dev ./ # run the Pages application locally (run inside the pages directory)
npx wrangler pages deploy ./ --project-name=<PROJECT_NAME> # deploy the pages directory directly
```
Details: <https://developers.cloudflare.com/pages/functions/local-development/>

#### Cloudflare Dashboard
- Fork this repository
- Edit the configurations in [`pages/_worker.js`](pages/_worker.js) if necessary
- Turn to [Cloudflare Dashboard](https://dash.cloudflare.com), then switch to the `Pages` tab
- `Create a project ▼` -> `Connect to Git`
- Connect to your GitHub account, then select the fork created just now
- `Begin setup`
- Fill in `Build settings`: `Framework preset` - <ins>`None`</ins>; `Build command` - <ins>leave it blank</ins>; `Build output directory` - <ins>`pages`</ins>
- `Save and Deploy`

### Limit
The total number of invocation requests per day is capped at 100,000. If the daily limit is reached, Pages will stop executing the function and fall back to providing only static resources.

---

## Source
- <https://github.com/Rongronggg9/rsstt-img-relay>
- <https://github.com/netnr/workers> (upstream)
