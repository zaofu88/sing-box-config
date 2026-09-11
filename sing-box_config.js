// https://raw.githubusercontent.com/xream/scripts/main/surge/modules/sub-store-scripts/sing-box/template.js#type=组合订阅&name=机场&outbound=香港节点$🏷ℹ️🇭🇰|港|hongkong|hong kong|\bhk\b🕳美国节点$🏷ℹ️🇺🇸|美国|united states|\bus\b🕳德国节点$🏷ℹ️🇩🇪|德国|germany|\bde\b🕳新加坡节点$🏷ℹ️🇸🇬|新加坡|singapore|\bsg\b
// ⚠️ 上面 🕳 后面的容器匹配规则(HongKong$ / Taiwan$ 等)是按"配置文件里的 outbound.tag
// 可能带国旗 emoji + 空格前缀(比如 "🇭🇰 HongKong"),但一定以英文地区名结尾"来写的:
//   只用 $ 锚定结尾、不用 ^ 锚定开头,就能不管前面是纯文字还是"🇭🇰 "这种国旗+空格,
//   只要以 HongKong 结尾就能匹配上,不需要每次改国旗样式都跟着改脚本参数。
//   如果你的 outbound.tag 是纯文字没有国旗前缀(比如就叫 "HongKong"),这条规则依然生效,
//   因为"以 HongKong 结尾"本身就包含"整串就是 HongKong"这种情况。
// 如果同一个配置里出现多个不同地区但结尾词相同的情况(比如同时有 "NewHongKong" 和 "HongKong"
// 两个不同的 outbound),再考虑加回 ^ 精确锚定开头,避免误伤。

// ⚠️ 下面 🏷 后面的节点名匹配规则(^[^A-Za-z]*HK 等)是按"节点名以大写字母前缀标识地区,
// 前面可能夹带国旗 emoji / 空格 / 符号"来写的:
//   ^[^A-Za-z]*HK 表示"字符串开头允许任意非字母字符(国旗 emoji、空格、竖线、方括号等都算),
//   然后紧跟字母 HK"。国旗 emoji(如 🇭🇰)本质是两个区域指示符号字符拼成的,
//   Unicode 码位不在 A-Za-z 范围内,所以会被 [^A-Za-z]* 自动跳过,不需要手动去掉国旗。
//   同时因为要求紧跟字母判断、且锚定开头,也不会误匹配到 "AUS"(澳大利亚)这种
//   同样包含 "US" 但开头是别的字母的名字。
// 如果你的节点命名规则不是"大写字母前缀",请把 HK / US 等换成你自己的实际前缀或关键词。

// 示例说明
// 读取 名称为 "机场" 的 组合订阅 中的节点(单订阅不需要设置 type 参数)
// 把 所有节点插入匹配 /all|all-auto/i 的 outbound 中(跟在 🕳 后面, ℹ️ 表示忽略大小写, 不筛选节点不需要给 🏷 )
// 把匹配 /港|hk|hongkong|kong kong|🇭🇰/i  (跟在 🏷 后面, ℹ️ 表示忽略大小写) 的节点插入匹配 /hk|hk-auto/i 的 outbound 中
// 支持每个 🕳 规则换行书写
// ...
// 可选参数: includeUnsupportedProxy 含不支持的协议 SSR 和 Snell. 用法: `&includeUnsupportedProxy=true`

// 支持传入订阅 URL. 参数为 url. 记得 url 在 URL query 参数中使用需要 encodeURIComponent. 直接使用前端的可视化参数编辑不需要 encodeURIComponent.
// 例如: http://a.com?token=123 应使用 url=http%3A%2F%2Fa.com%3Ftoken%3D123

// ⚠️ 注意: outbound 参数中的 🕳 匹配规则必须能精确匹配配置文件里实际的 outbound.tag,
// 否则该分组不会被插入任何节点。为避免误匹配到其他含有相同子串的 outbound (例如
// "United States" 里包含的 "us" 也会出现在别的 tag 里),建议用带 $ 锚定结尾的写法,
// 而不要直接照抄示例里的简写 (hk / us / jp 等)。

// ⚠️ 如果 outbounds 为空, 自动创建 COMPATIBLE(direct) 并插入 防止报错
// (即使 🕳 匹配规则完全没有命中某个 outbound.tag, 脚本结尾也会做兜底检查,
//  防止 urltest/selector 类型的 outbound 因为 outbounds 为空数组而导致 sing-box 加载失败)

log(`🚀 开始`)

let { type, name, outbound, includeUnsupportedProxy, url } = $arguments

log(`传入参数 type: ${type}, name: ${name}, outbound: ${outbound}`)

type = /^1$|col|组合/i.test(type) ? 'collection' : 'subscription'

const parser = ProxyUtils.JSON5 || JSON
log(`① 使用 ${ProxyUtils.JSON5 ? 'JSON5' : 'JSON'} 解析配置文件`)
let config
try {
  config = parser.parse($content ?? $files[0])
} catch (e) {
  log(`${e.message ?? e}`)
  throw new Error(`配置文件不是合法的 ${ProxyUtils.JSON5 ? 'JSON5' : 'JSON'} 格式`)
}
log(`② 获取订阅`)

let proxies = []
let outbounds = []
let endpoints = []
let data = {}
try {
  if (url) {
    log(`直接从 URL ${url} 读取订阅`)
    data = await produceArtifact({
      name,
      type,
      platform: 'sing-box',
      produceOpts: {
        'include-unsupported-proxy': includeUnsupportedProxy,
      },
      subscription: {
        name,
        url,
        source: 'remote',
      },
    })
  } else {
    log(`将读取名称为 ${name} 的 ${type === 'collection' ? '组合' : ''}订阅`)
    data = await produceArtifact({
      name,
      type,
      platform: 'sing-box',
      produceOpts: {
        'include-unsupported-proxy': includeUnsupportedProxy,
      },
    })
  }
  data = JSON.parse(data)
} catch (e) {
  log(`${e.message ?? e}`)
  throw new Error(`获取或解析订阅失败: ${e.message ?? e}`)
}
log(`获取到的原始数据: ${JSON.stringify(data).slice(0, 500)}...`)

outbounds = data.outbounds ?? []
endpoints = data.endpoints ?? []
proxies = [...outbounds, ...endpoints]
log(`获取到 ${outbounds.length} 个节点, ${endpoints.length} 个端点`)

log(`③ outbound 规则解析`)
const outboundRules = outbound
  .split('🕳')
  .map(i => i.trim())
  .filter(i => i)
  .map(i => {
    let [outboundPattern, tagPattern = '.*'] = i.split('🏷')
    const tagRegex = createTagRegExp(tagPattern)
    log(`匹配 🏷 ${tagRegex} 的节点将插入匹配 🕳 ${createOutboundRegExp(outboundPattern)} 的 outbound 中`)
    return [outboundPattern, tagRegex]
  })

log(`④ outbound 插入节点`)
if (!Array.isArray(config.outbounds)) {
  config.outbounds = []
}
for (const outbound of config.outbounds) {
  for (const [outboundPattern, tagRegex] of outboundRules) {
    const outboundRegex = createOutboundRegExp(outboundPattern)
    if (outboundRegex.test(outbound.tag)) {
      if (!Array.isArray(outbound.outbounds)) {
        outbound.outbounds = []
      }
      const tags = getTags(proxies, tagRegex)
      log(`🕳 ${outbound.tag} 匹配 ${outboundRegex}, 插入 ${tags.length} 个 🏷 匹配 ${tagRegex} 的节点`)
      outbound.outbounds.push(...tags)
    }
  }
}

const compatible_outbound = {
  tag: 'COMPATIBLE',
  type: 'direct',
}
let compatible = false

log(`⑤ 空 outbounds 兜底检查`)
// 不局限于 outboundRules 命中过的 outbound, 而是扫描所有 outbound:
// 只要是 selector / urltest 这类必须要有至少一个成员的类型, 且 outbounds 为空数组,
// 就统一兜底插入 COMPATIBLE(direct), 防止因为 outbound 参数里的匹配规则
// 没能覆盖到某个 tag (例如大小写/拼写不一致) 而导致 sing-box 加载失败。
const NEEDS_NON_EMPTY_OUTBOUNDS = ['selector', 'urltest']
for (const outbound of config.outbounds) {
  if (
    NEEDS_NON_EMPTY_OUTBOUNDS.includes(outbound.type) &&
    Array.isArray(outbound.outbounds) &&
    outbound.outbounds.length === 0
  ) {
    if (!compatible) {
      config.outbounds.push(compatible_outbound)
      compatible = true
    }
    log(`⚠️ ${outbound.tag} (type: ${outbound.type}) 的 outbounds 为空, 自动插入 COMPATIBLE(direct) 兜底, 请检查 outbound 参数中的匹配规则是否覆盖了该 tag`)
    outbound.outbounds.push(compatible_outbound.tag)
  }
}

config.outbounds.push(...outbounds)
if (!Array.isArray(config.endpoints)) {
  config.endpoints = []
}
config.endpoints.push(...endpoints)

$content = JSON.stringify(config, null, 2)

function getTags(proxies, regex) {
  return (regex ? proxies.filter(p => regex.test(p.tag)) : proxies).map(p => p.tag)
}
function log(v) {
  console.log(`[📦 sing-box 模板脚本] ${v}`)
}
function createTagRegExp(tagPattern) {
  return new RegExp(tagPattern.replace('ℹ️', ''), tagPattern.includes('ℹ️') ? 'i' : undefined)
}
function createOutboundRegExp(outboundPattern) {
  return new RegExp(outboundPattern.replace('ℹ️', ''), outboundPattern.includes('ℹ️') ? 'i' : undefined)
}

log(`🔚 结束`)
