
const API_URL = "https://alfa-leetcode-api.onrender.com/problems?limit=5";

async function main() {
  // 1. Request five problems from the API
  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  // 2. Convert the response into a JavaScript object
  const data = await response.json();

  // 3. Get the array of LeetCode problems
  const questions = data.problemsetQuestionList;

  if (!Array.isArray(questions)) {
    throw new Error("Unexpected API response format");
  }

  // 4. Convert LeetCode fields into our Supabase format
  const problems = questions.map((question) => ({
    problem_number: Number(question.questionFrontendId),
    problem_link: `https://leetcode.com/problems/${question.titleSlug}/`,
    problem_title: question.title,
    problem_difficulty: question.difficulty,
    problem_tags: question.topicTags.map((tag) => tag.name),
  }));

  // 5. Print the converted data (no database writes)
  console.log(JSON.stringify(problems, null, 2));
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
