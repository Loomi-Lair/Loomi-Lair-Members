import fs from "fs";
import path from "path";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const schema = JSON.parse(fs.readFileSync("schema.json", "utf-8"));
const validate = ajv.compile(schema);

const membersDir = "members";
const files = fs
    .readdirSync(membersDir)
    .filter(f => f.endsWith(".json") && !f.startsWith("_"));

let hasError = false;
const ids = new Set();

console.log(`📋 Found ${files.length} member file(s) to validate\n`);

for (const file of files) {
    const fullPath = path.join(membersDir, file);
    let data;

  process.stdout.write(`🔍 Validating ${file}... `);

    try {
        data = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
    } catch (e) {
      console.log("❌");
      console.error(`   Error: Invalid JSON - ${e.message}`);
        hasError = true;
        continue;
    }

    const valid = validate(data);
    if (!valid) {
      console.log("❌");
      console.error(`   Schema validation failed:`);
      validate.errors.forEach(err => {
        console.error(`   - ${err.instancePath} ${err.message}`);
      });
        hasError = true;
      continue;
    }

    // 校验文件名与 id 一致
    const expectedBase = path.basename(file, ".json");
    if (data && typeof data.id === "string" && data.id !== expectedBase) {
      console.log("❌");
      console.error(`   Error: ID mismatch - id="${data.id}" but filename expects "${expectedBase}"`);
        hasError = true;
      continue;
    }

    // 校验 id 唯一性
    if (data && typeof data.id === "string") {
        if (ids.has(data.id)) {
          console.log("❌");
          console.error(`   Error: Duplicate ID "${data.id}"`);
            hasError = true;
          continue;
        } else {
            ids.add(data.id);
        }
    }

  console.log("✅");
}

console.log();
if (hasError) {
    console.error("❌ Validation failed.");
    process.exit(1);
} else {
  console.log(`✅ All ${files.length} member file(s) validated successfully!`);
}
