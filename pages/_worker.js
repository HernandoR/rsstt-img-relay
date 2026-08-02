/*
 * https://github.com/netnr/workers
 *
 * 2019-2022
 * netnr
 *
 * https://github.com/Rongronggg9/rsstt-img-relay
 *
 * 2021-2024
 * Rongronggg9
 */

/**
 * Configurations
 */
const config = {
    selfURL: "", // to be filled later
    // 从 https://sematext.com/ 申请并修改令牌
    sematextToken: "00000000-0000-0000-0000-000000000000",
    // 是否丢弃请求中的 Referer，在目标网站应用防盗链时有用
    dropReferer: true,
    // weibo workarounds
    weiboCDN: [".weibocdn.com", ".sinaimg.cn"],
    weiboReferer: "https://weibo.com/",
    // sspai workarounds
    sspaiCDN: [".sspai.com"],
    sspaiReferer: "https://sspai.com/",
    // douban workarounds
    doubanCDN: [".doubanio.com"],
    doubanReferer: "https://movie.douban.com/",
    // 黑名单，URL 中含有任何一个关键字都会被阻断
    // blockList: [".m3u8", ".ts", ".acc", ".m4s", "photocall.tv", "googlevideo.com", "liveradio.ie"],
    blockList: [],
    typeList: ["image", "video", "audio", "application", "font", "model"],
    // werss: 微信公众号订阅全文 (/werss?url={RSS_FEED_URL})
    // 为 Wechat-Scholar 等微信公众号 RSS 源抓取文章全文并输出带全文的 RSS 2.0
    werssMaxItems: 20, // 最多为多少个条目抓取全文，硬上限 50
    werssConcurrency: 5, // 抓取全文的并发数
    werssCache: 900, // 生成的全文 feed 的缓存秒数
    werssUserAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

/**
 * Set config from environmental variables
 * @param {object} env
 */
function setConfig(env) {
    Object.keys(config).forEach((k) => {
        if (env[k])
            config[k] = typeof config[k] === 'string' ? env[k] : JSON.parse(env[k]);
    });
}

/**
 * Event handler for fetchEvent
 * @param {Request} request
 * @param {object} env
 * @param {object} ctx
 */
async function fetchHandler(request, env, ctx) {
    ctx.passThroughOnException();
    setConfig(env);

    //请求头部、返回对象
    let reqHeaders = new Headers(request.headers),
        outBody, outStatus = 200, outStatusText = 'OK', outCt = null, outHeaders = new Headers({
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": reqHeaders.get('Access-Control-Allow-Headers') || "Accept, Authorization, Cache-Control, Content-Type, DNT, If-Modified-Since, Keep-Alive, Origin, User-Agent, X-Requested-With, Token, x-access-token"
        });

    try {
        const selfUrl = new URL(request.url);
        config.selfURL = selfUrl.origin;
        let url = selfUrl.searchParams.get('url') || '';

        // werss path: 微信公众号订阅全文
        if (selfUrl.pathname.startsWith('/werss')) {
            return werssHandler(request, url);
        }

        //需要忽略的代理
        if (request.method == "OPTIONS" || url.length < 3 || url.indexOf('.') == -1 || url == "favicon.ico" || url == "robots.txt") {
            //输出提示
            const invalid = !(request.method == "OPTIONS" || url.length === 0)
            outBody = JSON.stringify({
                code: invalid ? 400 : 0,
                usage: 'Host/?url={URL}',
                source: 'https://github.com/Rongronggg9/rsstt-img-relay'
            });
            outCt = "application/json";
            outStatus = invalid ? 400 : 200;
        }
        //阻断
        else if (blockUrl(url)) {
            outBody = JSON.stringify({
                code: 403,
                msg: 'The keyword: ' + config.blockList.join(' , ') + ' was block-listed by the operator of this proxy.'
            });
            outCt = "application/json";
            outStatus = 403;
        }
        else {
            url = fixUrl(url);

            //构建 fetch 参数
            let fp = {
                method: request.method,
                headers: {}
            }

            //保留头部其它信息
            const dropHeaders = ['content-length', 'content-type', 'host'];
            if (config.dropReferer) dropHeaders.push('referer');
            let he = reqHeaders.entries();
            for (let h of he) {
                const key = h[0], value = h[1];
                if (!dropHeaders.includes(key)) {
                    fp.headers[key] = value;
                }
            }
            if (config.dropReferer) {
                const urlObj = new URL(url);
                if (config.weiboCDN.some(x => urlObj.host.endsWith(x))) {
                    // apply weibo workarounds
                    fp.headers['referer'] = config.weiboReferer;
                } else if (config.sspaiCDN.some(x => urlObj.host.endsWith(x))) {
                    // apply sspai workarounds
                    fp.headers['referer'] = config.sspaiReferer;
                } else if (config.doubanCDN.some(x => urlObj.host.endsWith(x))) {
                    // apply douban workarounds
                    fp.headers['referer'] = config.doubanReferer;
                }
            }

            // 是否带 body
            if (["POST", "PUT", "PATCH", "DELETE"].indexOf(request.method) >= 0) {
                const ct = (reqHeaders.get('content-type') || "").toLowerCase();
                if (ct.includes('application/json')) {
                    fp.body = JSON.stringify(await request.json());
                } else if (ct.includes('application/text') || ct.includes('text/html')) {
                    fp.body = await request.text();
                } else if (ct.includes('form')) {
                    fp.body = await request.formData();
                } else {
                    fp.body = await request.blob();
                }
            }

            // 发起 fetch
            let fr = (await fetch(url, fp));
            outCt = fr.headers.get('content-type');
            // 阻断
            if (blockType(outCt)) {
                outBody = JSON.stringify({
                    code: 415,
                    msg: 'The keyword "' + config.typeList.join(' , ') + '" was whitelisted by the operator of this proxy, but got "' + outCt + '".'
                });
                outCt = "application/json";
                outStatus = 415;
            }
            else {
                outStatus = fr.status;
                outStatusText = fr.statusText;
                outBody = fr.body;
                const overrideHeaders = new Set(outHeaders.keys())
                for (let h of fr.headers.entries()) {
                    if (!overrideHeaders.has(h[0]))
                        outHeaders.set(h[0], h[1]);
                }
            }
        }
    } catch (err) {
        outCt = "application/json";
        outBody = JSON.stringify({
            code: -1,
            msg: JSON.stringify(err.stack) || err
        });
        outStatus = 500;
    }

    //设置类型
    if (outCt && outCt != "") {
        outHeaders.set("content-type", outCt);
    }

    if (outStatus < 400)
        outHeaders.set("cache-control", "public, max-age=604800");

    let response = new Response(outBody, {
        status: outStatus,
        statusText: outStatusText,
        headers: outHeaders
    })

    //日志接口
    if (config.sematextToken != "00000000-0000-0000-0000-000000000000") {
        sematext.add(ctx, request, response);
    }

    return response;

    // return new Response('OK', { status: 200 })
}

/**
 * werss: 微信公众号订阅全文
 *
 * 用法: Host/werss?url={URL}
 * - 传入微信公众号 RSS 源（如 Wechat-Scholar 的 channels/*.xml），
 *   返回带文章全文（content:encoded）的 RSS 2.0 订阅源
 * - 传入单篇微信公众号文章链接（mp.weixin.qq.com），返回正文 HTML
 *
 * 可调配置: WERSS_MAX_ITEMS / WERSS_CONCURRENCY / WERSS_CACHE / WERSS_USER_AGENT
 */
async function werssHandler(request, url) {
    const outHeaders = new Headers({
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": request.headers.get('Access-Control-Allow-Headers') || "Accept, Authorization, Cache-Control, Content-Type, DNT, If-Modified-Since, Keep-Alive, Origin, User-Agent, X-Requested-With, Token, x-access-token"
    });

    if (request.method == "OPTIONS") {
        return new Response(null, { status: 204, headers: outHeaders });
    }

    if (request.method != "GET" || url.length < 3 || url.indexOf('.') == -1) {
        outHeaders.set("content-type", "application/json; charset=utf-8");
        return new Response(JSON.stringify({
            code: 400,
            usage: 'Host/werss?url={RSS_FEED_URL}',
            source: 'https://github.com/Rongronggg9/rsstt-img-relay'
        }), { status: 400, headers: outHeaders });
    }

    if (blockUrl(url)) {
        outHeaders.set("content-type", "application/json; charset=utf-8");
        return new Response(JSON.stringify({
            code: 403,
            msg: 'The keyword: ' + config.blockList.join(' , ') + ' was block-listed by the operator of this proxy.'
        }), { status: 403, headers: outHeaders });
    }

    try {
        url = fixUrl(url);

        // 抓取订阅源 / 文章页
        const fr = await fetch(url, {
            headers: {
                'User-Agent': config.werssUserAgent,
                'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8'
            },
            redirect: 'follow'
        });
        if (!fr.ok) throw new Error('upstream status: ' + fr.status + ' ' + fr.statusText);
        const text = await fr.text();

        const format = detectFeedFormat(text);
        if (format == 'rss' || format == 'atom') {
            // 订阅源 -> 带全文的 RSS 2.0
            const feed = await buildFullTextFeed(text, format, url);
            outHeaders.set('content-type', 'application/rss+xml; charset=utf-8');
            outHeaders.set('cache-control', 'public, max-age=' + config.werssCache);
            return new Response(feed, { status: 200, headers: outHeaders });
        }
        if (format == 'html') {
            // 单篇文章 -> 正文 HTML
            const article = extractWechatContent(text);
            if (article && article.content) {
                const title = article.title || url;
                const html = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>' + esc(title) + '</title>\n</head>\n<body>\n<article>\n<h1>' + esc(title) + '</h1>\n' + article.content + '\n</article>\n</body>\n</html>\n';
                outHeaders.set('content-type', 'text/html; charset=utf-8');
                outHeaders.set('cache-control', 'public, max-age=' + config.werssCache);
                return new Response(html, { status: 200, headers: outHeaders });
            }
            throw new Error('no WeChat article content found');
        }
        throw new Error('unsupported content: ' + (format || 'unknown'));
    } catch (err) {
        outHeaders.set("content-type", "application/json; charset=utf-8");
        return new Response(JSON.stringify({
            code: -1,
            msg: 'werss: ' + (err && err.message ? err.message : String(err))
        }), { status: 502, headers: outHeaders });
    }
}

/**
 * 抓取订阅源里每个条目的微信文章全文，生成带 content:encoded 的 RSS 2.0
 */
async function buildFullTextFeed(xml, format, feedUrl) {
    const parsed = format == 'atom' ? parseAtom(xml) : parseRss(xml);
    const max = Math.min(50, Math.max(0, parseInt(config.werssMaxItems, 10) || 0)); // 硬上限 50
    const items = parsed.items.slice(0, max);

    const enriched = await mapWithConcurrency(items, config.werssConcurrency, async (item) => {
        const link = item.link;
        if (!link || link.indexOf('mp.weixin.qq.com') == -1) {
            return Object.assign({}, item, { fullText: null });
        }
        const article = await fetchWechatFullText(link);
        return Object.assign({}, item, { fullText: article });
    });

    const c = parsed.channel;
    let out = '<?xml version="1.0" encoding="UTF-8"?>\n';
    out += '<rss xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom" version="2.0">\n';
    out += '<channel>\n';
    out += '<title>' + esc(c.title || feedUrl) + '</title>\n';
    out += '<link>' + esc(c.link || feedUrl) + '</link>\n';
    out += '<description>' + esc(c.description || '') + '</description>\n';
    out += '<language>' + esc(c.language || 'zh-cn') + '</language>\n';
    out += '<lastBuildDate>' + new Date().toUTCString() + '</lastBuildDate>\n';
    out += '<atom:link href="' + esc(feedUrl) + '" rel="self" type="application/rss+xml"/>\n';
    if (c.imageUrl) {
        out += '<image>\n';
        out += '<url>' + esc(c.imageUrl) + '</url>\n';
        out += '<title>' + esc(c.title || '') + '</title>\n';
        out += '<link>' + esc(c.link || feedUrl) + '</link>\n';
        out += '</image>\n';
    }
    enriched.forEach((it) => {
        const body = (it.fullText && it.fullText.content) || it.content || it.description || '';
        out += '<item>\n';
        if (it.title) out += '<title>' + cdata(it.title) + '</title>\n';
        if (it.link) out += '<link>' + esc(it.link) + '</link>\n';
        if (it.guid) out += '<guid isPermaLink="false">' + esc(it.guid) + '</guid>\n';
        if (it.pubDate) out += '<pubDate>' + esc(it.pubDate) + '</pubDate>\n';
        if (it.author) out += '<author>' + esc(it.author) + '</author>\n';
        out += '<description>' + cdata(body) + '</description>\n';
        if (body) out += '<content:encoded>' + cdata(body) + '</content:encoded>\n';
        out += '</item>\n';
    });
    out += '</channel>\n</rss>\n';
    return out;
}

/**
 * 抓取单篇微信公众号文章并提取正文
 */
async function fetchWechatFullText(link) {
    const u = new URL(fixUrl(link));
    if (u.protocol == 'http:') u.protocol = 'https:';
    const fr = await fetch(u.toString(), {
        headers: {
            'User-Agent': config.werssUserAgent,
            'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
            'Referer': 'https://mp.weixin.qq.com/'
        },
        redirect: 'follow'
    });
    if (!fr.ok) return null;
    const ct = (fr.headers.get('content-type') || '').toLowerCase();
    if (ct.indexOf('text/html') == -1) return null;
    return extractWechatContent(await fr.text());
}

/**
 * 从微信公众号文章 HTML 中提取标题与 #js_content 正文
 */
function extractWechatContent(html) {
    let title = '';
    const og = html.match(/property="og:title"\s+content="([^"]*)"/i);
    if (og) title = decodeEntities(og[1]);
    if (!title) {
        const h1 = html.match(/<h1[^>]*id="activity-name"[^>]*>([\s\S]*?)<\/h1>/i);
        if (h1) title = decodeEntities(stripTags(h1[1])).trim();
    }

    // 定位 #js_content 并做标签配对，提取正文
    const open = html.indexOf('id="js_content"');
    if (open == -1) return null;
    const tagStart = html.lastIndexOf('<div', open);
    if (tagStart == -1) return null;
    const gt = html.indexOf('>', open);
    if (gt == -1) return null;
    const pos = gt + 1;
    let depth = 1, j = pos;
    while (j < html.length) {
        if (html.startsWith('<div', j)) { depth++; j += 4; }
        else if (html.startsWith('</div', j)) { depth--; j += 5; if (depth == 0) break; }
        else j++;
    }
    if (depth != 0) return null;

    const content = cleanupWechatContent(html.slice(pos, j));
    if (!content) return null;
    return { title: title.trim(), content: content };
}

/**
 * 清洗微信正文: 去脚本/样式、修复懒加载图片、去除隐藏样式
 */
function cleanupWechatContent(content) {
    content = content.replace(/<script[\s\S]*?<\/script>/gi, '');
    content = content.replace(/<style[\s\S]*?<\/style>/gi, '');
    // 微信图片懒加载: data-src -> src (仅在尚无 src 时)
    content = content.replace(/<img\b([^>]*?)\bdata-src=/gi, (m, attrs) =>
        /\bsrc=/i.test(attrs) ? m : '<img' + attrs + ' src='
    );
    content = content.replace(/<img\b([^>]*?)\bdata-srcset=/gi, (m, attrs) =>
        /\bsrcset=/i.test(attrs) ? m : '<img' + attrs + ' srcset='
    );
    // 去除正文隐藏样式
    content = content.replace(/visibility:\s*hidden;\s*opacity:\s*0;\s*/gi, '');
    // 去除 onerror 事件
    content = content.replace(/\sonerror\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '');
    // 协议相对地址补全
    content = content.replace(/(src|href|poster)="\/\//gi, '$1="https://');
    return content.trim();
}

/**
 * 判断内容是 RSS / Atom / 微信文章 HTML
 */
function detectFeedFormat(text) {
    const head = text.slice(0, 2000);
    if (/<rss[\s>]/i.test(head)) return 'rss';
    if (/<feed[\s>]/i.test(head)) return 'atom';
    if (/<channel[\s>]/i.test(head)) return 'rss';
    if (/<html[\s>]/i.test(head) || /<!doctype\s+html/i.test(head)) return 'html';
    return '';
}

/**
 * 解析 RSS 2.0
 */
function parseRss(xml) {
    const channelRaw = matchBlock(xml, 'channel') || xml;
    const noImage = channelRaw.replace(/<image[\s\S]*?<\/image>/gi, '');
    const imageBlock = matchBlock(channelRaw, 'image');
    const channel = {
        title: field(noImage, 'title'),
        link: field(noImage, 'link'),
        description: field(noImage, 'description'),
        language: field(noImage, 'language'),
        imageUrl: field(imageBlock, 'url')
    };
    const items = [];
    const re = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;
    let m;
    while ((m = re.exec(xml)) !== null) {
        const b = m[1];
        items.push({
            title: field(b, 'title'),
            link: field(b, 'link'),
            guid: field(b, 'guid') || field(b, 'link'),
            description: field(b, 'description'),
            content: field(b, 'content:encoded') || field(b, 'encoded'),
            pubDate: field(b, 'pubDate'),
            author: field(b, 'author') || field(b, 'dc:creator')
        });
    }
    return { channel: channel, items: items };
}

/**
 * 解析 Atom（基础支持）
 */
function parseAtom(xml) {
    const feedBlock = matchBlock(xml, 'feed') || xml;
    const channel = {
        title: field(feedBlock, 'title'),
        link: attr(feedBlock, 'link', 'href') || field(feedBlock, 'id'),
        description: field(feedBlock, 'subtitle') || field(feedBlock, 'summary'),
        language: '',
        imageUrl: ''
    };
    const items = [];
    const re = /<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi;
    let m;
    while ((m = re.exec(xml)) !== null) {
        const b = m[1];
        items.push({
            title: field(b, 'title'),
            link: attr(b, 'link', 'href') || '',
            guid: field(b, 'id'),
            description: field(b, 'summary'),
            content: field(b, 'content') || field(b, 'summary'),
            pubDate: field(b, 'updated') || field(b, 'published'),
            author: field(b, 'name')
        });
    }
    return { channel: channel, items: items };
}

/**
 * 取标签内容，支持 CDATA 与实体解码
 */
function field(xml) {
    const tags = Array.prototype.slice.call(arguments, 1);
    for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        const m = xml.match(new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>'));
        if (!m) continue;
        let v = m[1].trim();
        const cd = v.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
        if (cd) {
            v = cd[1];
        } else {
            v = v.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
        }
        return decodeEntities(v);
    }
    return '';
}

/**
 * 取标签属性值
 */
function attr(xml, tag, name) {
    const m = xml.match(new RegExp("<" + tag + "\\b[^>]*?\\b" + name + "\\s*=\\s*([\"\'])([^\"\']*?)\\1", "i"));
    return m ? decodeEntities(m[2]) : '';
}

/**
 * 取外层标签块内容
 */
function matchBlock(xml, tag) {
    const m = xml.match(new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>', 'i'));
    return m ? m[1] : '';
}

/**
 * 带并发上限的 map
 */
async function mapWithConcurrency(arr, limit, fn) {
    const results = new Array(arr.length);
    let i = 0;
    const n = Math.max(1, Math.min(parseInt(limit, 10) || 1, arr.length));
    const workers = [];
    for (let w = 0; w < n; w++) {
        workers.push((async () => {
            while (i < arr.length) {
                const idx = i++;
                try {
                    results[idx] = await fn(arr[idx], idx);
                } catch (e) {
                    results[idx] = null;
                }
            }
        })());
    }
    await Promise.all(workers);
    return results;
}

// 补齐 url
function fixUrl(url) {
    if (url.includes("://")) {
        return url;
    } else if (url.includes(':/')) {
        return url.replace(':/', '://');
    } else {
        return "http://" + url;
    }
}

// 阻断 url
function blockUrl(url) {
    url = url.toLowerCase();
    let len = config.blockList.filter(x => url.includes(x)).length;
    return len != 0;
}
// 阻断 type
function blockType(type) {
    if (!type || typeof type !== 'string') {
        return false;
    }
    type = type.toLowerCase();
    let len = config.typeList.filter(x => type.includes(x)).length;
    return len == 0;
}

// XML 转义
function esc(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// CDATA 包装（安全处理 ]]>）
function cdata(s) {
    return '<![CDATA[' + String(s).replace(/\]\]>/g, ']]]]><![CDATA[>') + ']]>';
}

// HTML/XML 实体解码
function decodeEntities(s) {
    return String(s)
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');
}

// 去标签
function stripTags(s) {
    return String(s).replace(/<[^>]*>/g, '');
}

/**
 * 日志
 */
const sematext = {

    /**
     * 构建发送主体
     * @param {any} request
     * @param {any} response
     */
    buildBody: (request, response) => {
        const hua = request.headers.get("user-agent")
        const hip = request.headers.get("cf-connecting-ip")
        const hrf = request.headers.get("referer")
        const url = new URL(request.url)

        const body = {
            method: request.method,
            statusCode: response.status,
            clientIp: hip,
            referer: hrf,
            userAgent: hua,
            host: url.host,
            path: url.pathname,
            proxyHost: null,
        }

        const targetUrl = url.searchParams.get('url') || '';
        if (targetUrl.includes(".") && !targetUrl.includes("favicon.ico")) {
            try {
                let purl = fixUrl(targetUrl);

                body.path = purl;
                body.proxyHost = new URL(purl).host;
            } catch { }
        }

        return {
            method: "POST",
            body: JSON.stringify(body)
        }
    },

    /**
     * 添加
     * @param {any} event
     * @param {any} request
     * @param {any} response
     */
    add: (event, request, response) => {
        let url = `https://logsene-receiver.sematext.com/${config.sematextToken}/example/`;
        const body = sematext.buildBody(request, response);

        event.waitUntil(fetch(url, body))
    }
};

export default {
    fetch: fetchHandler
};
