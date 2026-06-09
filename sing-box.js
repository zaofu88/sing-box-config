const { type, name } = $arguments

const compatible_outbound = {
  tag: 'COMPATIBLE',
  type: 'direct',
}

// 表驱动地区匹配，新增地区只需在此添加
const regionMap = [
  { tags: ['hk', 'hk-auto'], regex: /港|hk|hongkong|hong\s?kong|🇭🇰/i },
  { tags: ['tw', 'tw-auto'], regex: /台|tw|taiwan|🇹🇼/i },
  { tags: ['jp', 'jp-auto'], regex: /日本|jp|japan|🇯🇵/i },
  { tags: ['sg', 'sg-auto'], regex: /新加坡|singapore|🇸🇬|\bsg\b/i },
  { tags: ['us', 'us-auto'], regex: /美|unitedstates|united\s?states|🇺🇸|\bus\b/i },
]

let config = JSON.parse($files[0])

let proxies = await produceArtifact({
  name,
  type: /^1$|col/i.test(type) ? 'collection' : 'subscription',
  platform: 'sing-box',
  produceType: 'internal',
})

config.outbounds.push(...proxies)

config.outbounds.forEach(i => {
  if (['all', 'all-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies))
    return
  }
  const region = regionMap.find(r => r.tags.includes(i.tag))
  if (region) {
    i.outbounds.push(...getTags(proxies, region.regex))
  }
})

// 兜底：仅在存在空 outbounds 时才插入 COMPATIBLE
const emptyOutbounds = config.outbounds.filter(
  o => Array.isArray(o.outbounds) && o.outbounds.length === 0
)
if (emptyOutbounds.length > 0) {
  config.outbounds.push(compatible_outbound)
  emptyOutbounds.forEach(o => o.outbounds.push(compatible_outbound.tag))
}

$content = JSON.stringify(config, null, 2)

function getTags(proxies, regex) {
  return (regex ? proxies.filter(p => regex.test(p.tag)) : proxies).map(p => p.tag)
}
