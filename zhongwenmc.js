const { type, name } = $arguments

// 表驱动地区匹配：tag 必须与模板里的 urltest 分组 tag 完全一致
// 新增地区：先在模板里加分组，再在这里加一行
const regionMap = [
  { tag: '香港节点', regex: /港|hongkong|hong\s?kong|🇭🇰|\bhk\b/i },
  { tag: '新加坡节点', regex: /新加坡|狮城|singapore|🇸🇬|\bsg\b/i },
  { tag: '美国节点', regex: /美|unitedstates|united\s?states|\busa?\b|🇺🇸/i },
  { tag: '德国节点', regex: /德|germany|🇩🇪|\bde\b/i },
]

// 包含全部节点的 selector（可手动选单个节点，也兜住未匹配地区的节点）
const allTag = '全部节点'

// 订阅里的流量/到期等信息伪节点，直接过滤
const junkRegex = /剩余|流量|到期|过期|套餐|官网|订阅|重置|expire|traffic|reset/i

let config = JSON.parse($files[0])

let proxies = await produceArtifact({
  name,
  type: /^1$|col/i.test(type) ? 'collection' : 'subscription',
  platform: 'sing-box',
  produceType: 'internal',
})

proxies = proxies.filter(p => !junkRegex.test(p.tag))
if (proxies.length === 0) {
  throw new Error('未获取到任何可用节点，已中止生成配置')
}

// 节点 tag 与模板已有 tag 冲突时自动加后缀
const usedTags = new Set(config.outbounds.map(o => o.tag))
proxies.forEach(p => {
  if (usedTags.has(p.tag)) {
    let i = 2
    while (usedTags.has(`${p.tag}_${i}`)) i++
    p.tag = `${p.tag}_${i}`
  }
  usedTags.add(p.tag)
})

config.outbounds.push(...proxies)

// 填充「全部节点」和各地区分组
config.outbounds.forEach(o => {
  if (!Array.isArray(o.outbounds)) return
  if (o.tag === allTag) {
    o.outbounds.push(...getTags(proxies))
    return
  }
  const region = regionMap.find(r => r.tag === o.tag)
  if (region) {
    o.outbounds.push(...getTags(proxies, region.regex))
  }
})

// 删除没有节点的地区分组，并清理其他组对它们的引用
// （不再用 direct 兜底，避免走代理的流量悄悄直连）
const emptyTags = new Set(
  config.outbounds
    .filter(o => o.type === 'urltest' && Array.isArray(o.outbounds) && o.outbounds.length === 0)
    .map(o => o.tag)
)
if (emptyTags.size > 0) {
  config.outbounds = config.outbounds.filter(o => !emptyTags.has(o.tag))
  config.outbounds.forEach(o => {
    if (Array.isArray(o.outbounds)) {
      o.outbounds = o.outbounds.filter(t => !emptyTags.has(t))
    }
  })
}

// 清理后若仍有空分组，说明模板引用关系有问题，直接报错
const broken = config.outbounds.filter(
  o => Array.isArray(o.outbounds) && o.outbounds.length === 0
)
if (broken.length > 0) {
  throw new Error('以下分组没有可用出站：' + broken.map(o => o.tag).join('、'))
}

$content = JSON.stringify(config, null, 2)

function getTags(proxies, regex) {
  return (regex ? proxies.filter(p => regex.test(p.tag)) : proxies).map(p => p.tag)
}
