import fs from "fs";
import path from "path";
import yaml from "js-yaml";

const membersDir = path.resolve("members");
const distDir = path.resolve("dist");

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);

const files = fs
    .readdirSync(membersDir)
    .filter(f => f.endsWith(".json") && !f.startsWith("_"));
const members = files.map(f =>
    JSON.parse(fs.readFileSync(path.join(membersDir, f), "utf-8"))
);

// 写入 JSON
fs.writeFileSync(
    path.join(distDir, "members.json"),
    JSON.stringify(members, null, 2)
);

// 写入 YAML
const yamlData = yaml.dump(members, { noRefs: true, indent: 2 });
fs.writeFileSync(path.join(distDir, "members.yaml"), yamlData);

console.log(`✅ Generated ${members.length} members to dist/members.json & dist/members.yaml`);
