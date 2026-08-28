import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const examRoot = resolve(process.argv[2] || "../sinbad-exam-intelligence");
const academyRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const { EXAM_TAXONOMY } = await import(pathToFileURL(join(examRoot, "src", "taxonomy.js")));
const validationRoot = join(examRoot, "data", "validation");
const files = (await readdir(validationRoot, { recursive: true, withFileTypes: true }))
  .filter(entry => entry.isFile() && entry.name.endsWith(".jsonl"))
  .map(entry => join(entry.parentPath, entry.name));
const unique = new Map();
for (const file of files) {
  for (const line of (await readFile(file, "utf8")).split(/\r?\n/u)) {
    if (!line.trim()) continue;
    let item; try { item = JSON.parse(line); } catch { continue; }
    if (!item.candidateId || !item.stem || !Array.isArray(item.options) || item.options.length < 3 || item.options.length > 5 || !item.subjectCode) continue;
    const labels = item.options.map(option => String(option?.label || "").toUpperCase());
    if (new Set(labels).size !== labels.length || labels.some(label => !/^[A-E]$/u.test(label))) continue;
    if (item.stem.length < 20 || item.stem.length > 600 || item.options.some(option => !String(option?.text || "").trim() || String(option.text).length > 500 || /\b\d{1,3}\s*[).]\s*[A-ZÇĞİÖŞÜ]/u.test(String(option.text)))) continue;
    if (!unique.has(item.candidateId)) unique.set(item.candidateId, {
      id: item.candidateId, subjectCode: item.subjectCode,
      qualificationCodes: Array.isArray(item.qualificationCodes) ? item.qualificationCodes : [],
      topicCode: item.suggestedTopicCode || "GENEL", stem: item.stem,
      options: item.options.map(option => ({ label: option.label, text: option.text })),
      answer: item.answerConflict ? null : item.distinctReportedAnswers?.length === 1 && /^[A-E]$/u.test(item.distinctReportedAnswers[0]) ? item.distinctReportedAnswers[0] : null,
      answerStatus: item.answerConflict ? "CONFLICT" : item.distinctReportedAnswers?.length === 1 ? "REPORTED" : "UNVERIFIED",
      reviewStatus: item.contentValidationStatus || item.reviewStatus || "PENDING_HUMAN_REVIEW",
      sourceClass: item.sourceClass || "UNKNOWN"
    });
  }
}
const qualifications = Object.entries(EXAM_TAXONOMY.qualifications).map(([code, value]) => ({
  code, name: value.name, branch: value.branch, responsibilityLevel: value.responsibilityLevel,
  subjects: Object.entries(value.subjectPassScores).map(([subjectCode, passScore]) => ({ code: subjectCode, name: EXAM_TAXONOMY.subjects[subjectCode], passScore }))
}));
const payload = { schemaVersion: "1.0.0", taxonomyVersion: EXAM_TAXONOMY.version, qualifications, questions: [...unique.values()] };
await writeFile(join(academyRoot, "academy-gasm-catalog.js"), `window.SINBAD_GASM_CATALOG=${JSON.stringify(payload)};\n`, "utf8");
console.log(`Academy GASM catalog: ${qualifications.length} qualifications, ${payload.questions.length} distinct questions.`);
