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
      // 兼容 Global / global
      const globalIndex = config.route.rules.findIndex(
        (r) =>
          typeof r.clash_mode === "string" &&
          r.clash_mode.toLowerCase() === "global"
      );

      // 对自定义规则去重
      const existingRules = new Set(
        config.route.rules.map((r) => JSON.stringify(r))
      );

      customRules = customRules.filter(
        (r) => !existingRules.has(JSON.stringify(r))
      );

      // 插入到 Clash Global 规则之后
      if (globalIndex !== -1) {
        config.route.rules.splice(
          globalIndex + 1,
          0,
          ...customRules
        );
      } else {
        config.route.rules.push(...customRules);
      }
    }
  } catch (e) {
    // 自定义规则读取失败，不影响主配置生成
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

// 4. 过滤无效节点，并避免与模板已有节点 tag 冲突
const existingTags = new Set(
  config.outbounds
    .map((o) => o.tag)
    .filter(Boolean)
);

proxies = proxies.filter(
  (p) =>
    p &&
    p.tag &&
    !existingTags.has(p.tag)
);

// 5. 添加订阅节点
config.outbounds.push(...proxies);

// 6. 获取节点 tag
const allTags = proxies
  .map((p) => p.tag)
  .filter(Boolean);

// Relay 只加入没有 detour 的终端节点
const terminalTags = proxies
  .filter((p) => !p.detour && p.tag)
  .map((p) => p.tag);

// 7. 自动把订阅节点加入各个节点组
config.outbounds.forEach((group) => {
  if (!Array.isArray(group.outbounds)) {
    return;
  }

  // Direct-Out 永远不加入订阅节点
  if (group.tag === "Direct-Out") {
    return;
  }

  // Relay 只加入终端节点
  if (group.tag === "Relay") {
    group.outbounds.push(...terminalTags);
    return;
  }

  // 其他 selector / urltest 自动加入全部节点
  group.outbounds.push(...allTags);
});

// 8. 对各节点组去重
config.outbounds.forEach((group) => {
  if (Array.isArray(group.outbounds)) {
    group.outbounds = [...new Set(group.outbounds)];
  }
});

// 9. 输出最终配置
$content = JSON.stringify(config, null, 2);
