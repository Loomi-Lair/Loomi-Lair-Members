import fs from "fs";
import path from "path";
import { execSync } from "child_process";
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

// 从环境变量获取 PR 作者和基础分支
const prAuthor = process.env.PR_AUTHOR || "";
const baseBranch = process.env.BASE_BRANCH || "origin/main";

console.log("🔍 开始 PR 变更检测...\n");
console.log(`📝 PR 作者: ${prAuthor}`);
console.log(`🌲 基础分支: ${baseBranch}\n`);

// 获取变更的文件列表
let changedFiles = [];
try {
    const output = execSync(`git diff --name-only ${baseBranch}...HEAD`, {
        encoding: "utf-8",
    });
    changedFiles = output
        .split("\n")
        .filter(f => f.trim().length > 0)
        .map(f => f.trim());
} catch (e) {
    console.error("❌ 无法获取变更文件列表");
    console.error(e.message);
    process.exit(1);
}

console.log(`📂 检测到 ${changedFiles.length} 个文件变更:\n`);
changedFiles.forEach(f => console.log(`   - ${f}`));
console.log();

// 过滤出 members 目录下的 JSON 文件
const memberFiles = changedFiles.filter(f => {
    return f.startsWith("members/") &&
           f.endsWith(".json") &&
           !f.includes("/_");
});

// 规则 1: 必须且只能修改一个 members/*.json 文件
if (memberFiles.length === 0) {
    console.error("❌ 错误: 未检测到 members/ 目录下的成员文件变更");
    console.error("   提示: 你需要在 members/ 目录下添加或修改你的个人信息文件\n");
    process.exit(1);
}

if (memberFiles.length > 1) {
    console.error("❌ 错误: 检测到多个成员文件变更");
    console.error("   规则: 每个 PR 只能添加或修改一个成员文件（你自己的）\n");
    console.error("   变更的成员文件:");
    memberFiles.forEach(f => console.error(`   - ${f}`));
    console.error();
    process.exit(1);
}

const memberFile = memberFiles[0];
const fileName = path.basename(memberFile, ".json");

console.log(`✅ 规则检查通过: 只修改了一个成员文件\n`);
console.log(`📄 目标文件: ${memberFile}`);
console.log(`🆔 文件 ID: ${fileName}\n`);

// 规则 2: 不允许修改其他非成员文件（除了允许的配置文件）
const allowedFiles = [
    "package.json",
    "package-lock.json",
    "readme.md",
    "README.md",
    ".gitignore"
];

const otherFiles = changedFiles.filter(f => !f.startsWith("members/"));
const disallowedFiles = otherFiles.filter(f => !allowedFiles.includes(f));

if (disallowedFiles.length > 0) {
    console.error("❌ 错误: 检测到不允许修改的文件");
    console.error("   规则: PR 中只能修改 members/ 目录下的文件\n");
    console.error("   不允许修改的文件:");
    disallowedFiles.forEach(f => console.error(`   - ${f}`));
    console.error();
    process.exit(1);
}

// 读取并验证成员文件
console.log(`🔍 验证文件内容...\n`);

let memberData;
const fullPath = path.resolve(memberFile);

// 检查文件是否存在
if (!fs.existsSync(fullPath)) {
    console.error(`❌ 错误: 文件不存在: ${memberFile}`);
    process.exit(1);
}

// 解析 JSON
try {
    const content = fs.readFileSync(fullPath, "utf-8");
    memberData = JSON.parse(content);
} catch (e) {
    console.error(`❌ 错误: JSON 格式错误`);
    console.error(`   ${e.message}\n`);
    process.exit(1);
}

// Schema 验证
const valid = validate(memberData);
if (!valid) {
    console.error(`❌ 错误: 数据结构验证失败\n`);
    validate.errors.forEach(err => {
        console.error(`   - ${err.instancePath || "根对象"} ${err.message}`);
    });
    console.error();
    process.exit(1);
}

// 规则 3: 文件名必须与 id 字段一致
if (memberData.id !== fileName) {
    console.error(`❌ 错误: 文件名与 ID 不匹配`);
    console.error(`   文件名: ${fileName}`);
    console.error(`   JSON 中的 id: ${memberData.id}`);
    console.error(`   提示: 文件名应为 ${memberData.id}.json\n`);
    process.exit(1);
}

// 规则 4: 文件名应该与 PR 作者相关（可选检查，警告而非错误）
if (prAuthor && fileName.toLowerCase() !== prAuthor.toLowerCase()) {
    console.warn(`⚠️  警告: 文件名 (${fileName}) 与 PR 作者 (${prAuthor}) 不匹配`);
    console.warn(`   建议: 通常情况下，你应该只添加或修改自己的信息文件\n`);
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
            console.error(`❌ 错误: ID 重复`);
            console.error(`   你的 ID "${memberData.id}" 已被 ${file} 使用`);
            console.error(`   请选择一个唯一的 ID\n`);
            process.exit(1);
        }
    } catch (e) {
        // 忽略无法解析的文件
    }
}

// 所有验证通过！
console.log(`✅ 所有验证通过！\n`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`🎉 欢迎信息`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`👤 姓名: ${memberData.name}`);
console.log(`🆔 ID: ${memberData.id}`);
console.log(`📝 简介: ${memberData.intro}`);
if (memberData.tags && memberData.tags.length > 0) {
    console.log(`🏷️  标签: ${memberData.tags.join(", ")}`);
}
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

// 输出到 GitHub Actions
if (process.env.GITHUB_OUTPUT) {
    const output = [
        `member_name=${memberData.name}`,
        `member_id=${memberData.id}`,
        `member_intro=${memberData.intro}`,
        `member_avatar=${memberData.avatar}`,
        `member_github=${memberData.links.github}`,
        `is_new_member=true`
    ].join("\n");

    fs.appendFileSync(process.env.GITHUB_OUTPUT, output + "\n");
    console.log("📤 已输出成员信息到 GitHub Actions\n");
}

console.log("✅ PR 验证完成！");
