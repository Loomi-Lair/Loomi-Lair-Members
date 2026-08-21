import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import Ajv from "ajv";
import addFormats from "ajv-formats";

/**
 * PR 专用验证脚本
 * 用于验证 PR 中的文件变更是否符合规则
 */

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const schema = JSON.parse(fs.readFileSync("schema.json", "utf-8"));
const validate = ajv.compile(schema);
const baseCommit = process.env.BASE_COMMIT || "origin/main";

console.log("🔍 开始 PR 变更检测...\n");
console.log(`🌲 基础提交: ${baseCommit}\n`);

// 获取变更文件及状态。使用 execFileSync 传递参数，避免把引用拼入 shell 命令。
let changedFiles = [];
try {
    const output = execFileSync(
        "git",
        ["diff", "--name-status", "--find-renames", `${baseCommit}...HEAD`],
        { encoding: "utf-8" }
    );

    changedFiles = output
        .split("\n")
        .filter(line => line.trim().length > 0)
        .map(line => {
            const [status, ...files] = line.split("\t");
            return { status, files };
        });
} catch (e) {
    console.error("❌ 无法获取变更文件列表");
    console.error(e.message);
    process.exit(1);
}

console.log(`📂 检测到 ${changedFiles.length} 个文件变更:\n`);
changedFiles.forEach(({ status, files }) => {
    console.log(`   - ${status}: ${files.join(" → ")}`);
});
console.log();

// 必须且只能修改一个普通成员文件；删除、复制和重命名均不允许。
if (changedFiles.length !== 1) {
    console.error("❌ 错误: PR 必须且只能修改一个成员文件");
    console.error("   规则: 每个 PR 只能添加或修改一个 members/<id>.json 文件\n");
    process.exit(1);
}

const [{ status, files }] = changedFiles;
if (!/^[AM]$/.test(status) || files.length !== 1) {
    console.error("❌ 错误: 只允许添加或修改一个成员文件");
    console.error("   规则: 不允许删除、复制或重命名成员文件\n");
    process.exit(1);
}

const [memberFile] = files;
if (!/^members\/(?!_)[a-z0-9_-]+\.json$/.test(memberFile)) {
    console.error("❌ 错误: 变更文件必须是 members/<id>.json");
    console.error("   提示: 文件名只能包含小写字母、数字、连字符或下划线\n");
    process.exit(1);
}

const fileName = path.basename(memberFile, ".json");

console.log("✅ 规则检查通过: 只修改了一个成员文件\n");
console.log(`📄 目标文件: ${memberFile}`);
console.log(`🆔 文件 ID: ${fileName}\n`);

// 读取并验证成员文件
console.log("🔍 验证文件内容...\n");

let memberData;
const fullPath = path.resolve(memberFile);

if (!fs.existsSync(fullPath)) {
    console.error(`❌ 错误: 文件不存在: ${memberFile}`);
    process.exit(1);
}

try {
    const content = fs.readFileSync(fullPath, "utf-8");
    memberData = JSON.parse(content);
} catch (e) {
    console.error("❌ 错误: JSON 格式错误");
    console.error(`   ${e.message}\n`);
    process.exit(1);
}

const valid = validate(memberData);
if (!valid) {
    console.error("❌ 错误: 数据结构验证失败\n");
    validate.errors.forEach(err => {
        console.error(`   - ${err.instancePath || "根对象"} ${err.message}`);
    });
    console.error();
    process.exit(1);
}

// 文件名必须与 id 字段一致
if (memberData.id !== fileName) {
    console.error("❌ 错误: 文件名与 ID 不匹配");
    console.error(`   文件名: ${fileName}`);
    console.error(`   JSON 中的 id: ${memberData.id}`);
    console.error(`   提示: 文件名应为 ${memberData.id}.json\n`);
    process.exit(1);
}

// 检查 ID 是否与其他成员重复
const membersDir = path.resolve("members");
const allFiles = fs
    .readdirSync(membersDir)
    .filter(f => f.endsWith(".json") && !f.startsWith("_") && f !== path.basename(memberFile));

for (const file of allFiles) {
    try {
        const data = JSON.parse(fs.readFileSync(path.join(membersDir, file), "utf-8"));
        if (data.id === memberData.id) {
            console.error("❌ 错误: ID 重复");
            console.error(`   你的 ID "${memberData.id}" 已被 ${file} 使用`);
            console.error("   请选择一个唯一的 ID\n");
            process.exit(1);
        }
    } catch (e) {
        // 完整验证步骤会报告已有文件的解析错误。
    }
}

console.log("✅ 所有验证通过！\n");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🎉 欢迎信息");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`👤 姓名: ${memberData.name}`);
console.log(`🆔 ID: ${memberData.id}`);
console.log(`📝 简介: ${memberData.intro}`);
if (memberData.tags && memberData.tags.length > 0) {
    console.log(`🏷️  标签: ${memberData.tags.join(", ")}`);
}
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
console.log("✅ PR 验证完成！");
