
import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync("data/leetcode.json", "utf8"));
const questions = data.data.problemsetQuestionList.questions;
const key = process.env.ADMIN_API_KEY;
const amount = process.argv[2] === "all"
  ? questions.length
  : Number(process.argv[2] || 100);

if (!key) throw new Error("Set ADMIN_API_KEY first");
if (!Number.isInteger(amount) || amount < 1 || amount > questions.length) {
  throw new Error("Invalid number of problems");
}

let added = 0;
let existing = 0;
let skipped = 0;

for (let i = 0; i < amount; i++) {
  const q = questions[i];
  const number = Number(q.frontendQuestionId);

  // Skip records that do not match our database format.
  if (
    !Number.isInteger(number) ||
    number < 1 ||
    number > 2147483647 ||
    typeof q.title !== "string" ||
    !q.title.trim() ||
    q.title.length > 255 ||
    typeof q.titleSlug !== "string" ||
    !/^[a-z0-9-]+$/.test(q.titleSlug) ||
    !["Easy", "Medium", "Hard"].includes(q.difficulty) ||
    !Array.isArray(q.topicTags) ||
    q.topicTags.some(t => typeof t.name !== "string" || !t.name.trim())
  ) {
    skipped++;
    continue;
  }

  const problem = {
    problem_number: number,
    problem_title: q.title,
    problem_link: `https://leetcode.com/problems/${q.titleSlug}/`,
    problem_difficulty: q.difficulty,
    problem_tags: [...new Set(q.topicTags.map(t => t.name.trim()))],
  };

  const response = await fetch("http://127.0.0.1:3001/problems", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": key,
    },
    body: JSON.stringify(problem),
  });

  if (response.status === 409) {
    existing++;
  } else if (!response.ok) {
    throw new Error(
      `Problem ${number} failed: ${response.status} ${await response.text()}`
    );
  } else {
    added++;
  }

  if ((i + 1) % 100 === 0) {
    console.log(`${i + 1}/${amount}: ${added} added, ${existing} existing`);
  }
}

console.log(`Done! ${added} added, ${existing} existing, ${skipped} skipped.`);
