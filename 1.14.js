const { name, type = "0", rules: rules_file } = $arguments;

// 1. 读取模板
const config = JSON.parse($files[0]);

// 确保必要结构存在
config.route ??= {};
config.route.rules ??= [];
config.outbounds ??= [];

// 2. 追加自定义规则
if (rules_file) {
  try {
    const customRulesRaw = await produceArtifact({
      type: "file",
      name: rules_file,
    });

    if (customRulesRaw) {
      let customRules = JSON.parse(customRulesRaw);

      if (!Array.isArray(customRules)) {
        customRules = [];
      }

      // 查找 Clash Global 规则
      const idx = config.route.rules.findIndex(
        r =>
          typeof r.clash_mode === "string" &&
          r.clash_mode.toLowerCase() === "global"
      );

      // 已有规则去重
      const existingRules = new Set(
        config.route.rules.map(r => JSON.stringify(r))
      );

      customRules = customRules.filter(
        r => !existingRules.has(JSON.stringify(r))
      );

      // 插入到 Global 规则之后
      if (idx !== -1) {
        config.route.rules.splice(idx + 1, 0, ...customRules);
      } else {
        config.route.rules.push(...customRules);
      }
    }
  } catch (e) {
    console.log(
      `Failed to load custom rules: ${rules_file}`,
      e
    );
  }
}

// 3. 拉取订阅或合集节点
let proxies = await produceArtifact({
  name,
  type: /^1$|col/i.test(type)
    ? "collection"
    : "subscription",
  platform: "sing-box",
  produceType: "internal",
});

// 防止订阅返回异常
if (!Array.isArray(proxies)) {
  proxies = [];
}

// 4. 去重已有节点 tag
const existingTags = new Set(
  config.outbounds
    .map(o => o.tag)
    .filter(Boolean)
);

proxies = proxies.filter(
  p =>
    p &&
    p.tag &&
    !existingTags.has(p.tag)
);

// 5. 添加新节点
config.outbounds.push(...proxies);

// 6. 节点列表
const allTags = proxies
  .map(p => p.tag)
  .filter(Boolean);

// Relay 只加入没有 detour 的终端节点
const terminalTags = proxies
  .filter(p => !p.detour && p.tag)
  .map(p => p.tag);

// 7. 将节点加入分组
config.outbounds.forEach(group => {
  if (!Array.isArray(group.outbounds)) {
    return;
  }

  // Direct-Out 不加入节点
  if (group.tag === "Direct-Out") {
    return;
  }

  // Relay 只加入终端节点
  if (group.tag === "Relay") {
    group.outbounds.push(...terminalTags);
  } else {
    group.outbounds.push(...allTags);
  }
});

// 8. 分组去重
config.outbounds.forEach(group => {
  if (Array.isArray(group.outbounds)) {
    group.outbounds = [...new Set(group.outbounds)];
  }
});

// 9. 输出最终配置
$content = JSON.stringify(config, null, 2);
