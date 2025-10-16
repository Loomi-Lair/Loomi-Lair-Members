# 🦊 Loomi Lair Members

> Loomi Lair 组织成员数据仓库

## 简介

此仓库存储 Loomi Lair 成员的结构化数据。每个成员对应 `/members` 目录下的一个 JSON 文件。

## 如何加入

1. Fork 此仓库
2. 在 `members/` 下创建 `<你的id>.json`（参考 `members/_example.json`）
3. 提交 Pull Request

### 文件格式示例

```json
{
  "id": "你的唯一标识",
  "name": "显示名称",
  "intro": "简短的自我介绍",
  "avatar": "https://头像URL",
  "tags": ["标签1", "标签2"],
  "links": {
    "github": "https://github.com/你的用户名",
    "homepage": "https://你的网站.com"
  }
}
```

**注意事项：**
- `id` 只能包含小写字母、数字、连字符或下划线
- 文件名必须与 `id` 一致（如 `alice.json` → `"id": "alice"`）
- `links.github` 是必需的，其他链接可选，也可以任意添加更多链接
- 所有 URL 必须以 `http://` 或 `https://` 开头
