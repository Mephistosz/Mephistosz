import { mkdir, writeFile } from "node:fs/promises";

const username = process.env.GITHUB_REPOSITORY_OWNER || process.env.GITHUB_USERNAME || "Mephistosz";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const output = process.env.PROFILE_CARD_OUTPUT || "assets/profile-card.svg";

const fallback = {
  totalContributions: 462,
  weeks: buildFallbackWeeks(),
};

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildFallbackWeeks() {
  const levels = [0, 1, 0, 2, 3, 0, 1, 0, 2, 4, 1, 0, 3, 2, 0, 1, 4, 2, 0, 1, 3, 0, 2, 1, 0, 4, 2, 1, 0, 3, 2, 0, 1, 4, 3, 0, 2, 1, 0, 3, 4, 1, 0, 2, 3, 0, 1, 4, 2, 0, 3, 1, 0];
  return Array.from({ length: 53 }, (_, weekIndex) => ({
    contributionDays: Array.from({ length: 7 }, (_, dayIndex) => ({
      contributionCount: levels[(weekIndex + dayIndex) % levels.length],
      contributionLevel: `LEVEL_${levels[(weekIndex + dayIndex) % levels.length]}`,
    })),
  }));
}

async function fetchContributionCalendar() {
  if (!token) {
    return fallback;
  }

  const query = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                contributionCount
                contributionLevel
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "mephistosz-profile-card",
    },
    body: JSON.stringify({ query, variables: { login: username } }),
  });

  if (!response.ok) {
    throw new Error(`GitHub GraphQL request failed with ${response.status}`);
  }

  const payload = await response.json();
  const calendar = payload.data?.user?.contributionsCollection?.contributionCalendar;

  if (!calendar) {
    throw new Error("GitHub GraphQL response did not include a contribution calendar");
  }

  return calendar;
}

function levelToColor(day) {
  const count = day.contributionCount || 0;
  const level = day.contributionLevel || "NONE";

  if (count === 0 || level === "NONE" || level === "LEVEL_0") return "#1a1b2c";
  if (level === "FIRST_QUARTILE" || level === "LEVEL_1") return "#7aa2f7";
  if (level === "SECOND_QUARTILE" || level === "LEVEL_2") return "#9ece6a";
  if (level === "THIRD_QUARTILE" || level === "LEVEL_3") return "#bb9af7";
  return "#f7768e";
}

function renderHeatmap(weeks) {
  const cell = 8;
  const gap = 3;
  const startX = 462;
  const startY = 169;
  const normalizedWeeks = weeks.slice(-53);

  return normalizedWeeks.flatMap((week, weekIndex) => {
    const days = week.contributionDays || [];
    return days.map((day, dayIndex) => {
      const x = startX + weekIndex * (cell + gap);
      const y = startY + dayIndex * (cell + gap);
      return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${levelToColor(day)}" />`;
    });
  }).join("\n    ");
}

function renderCard(calendar) {
  const contributions = Number(calendar.totalContributions || fallback.totalContributions).toLocaleString("en-US");
  const heatmap = renderHeatmap(calendar.weeks || fallback.weeks);
  const generatedAt = new Date().toISOString().slice(0, 10);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="980" height="360" viewBox="0 0 980 360" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(username)} backend profile card</title>
  <desc id="desc">A dark terminal-style GitHub profile card with contribution calendar data.</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#080914" />
      <stop offset="50%" stop-color="#111427" />
      <stop offset="100%" stop-color="#241430" />
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#7aa2f7" />
      <stop offset="50%" stop-color="#bb9af7" />
      <stop offset="100%" stop-color="#f7768e" />
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#bb9af7" stop-opacity="0.65" />
      <stop offset="100%" stop-color="#7aa2f7" stop-opacity="0" />
    </radialGradient>
    <style>
      .mono { font-family: Consolas, Monaco, 'Courier New', monospace; }
      .sans { font-family: Inter, Segoe UI, Arial, sans-serif; }
      .muted { fill: #79809a; }
      .text { fill: #c0caf5; }
      .blue { fill: #7dcfff; }
      .green { fill: #9ece6a; }
      .yellow { fill: #e0af68; }
      .pink { fill: #f7768e; }
      .purple { fill: #bb9af7; }
    </style>
  </defs>

  <rect width="980" height="360" rx="28" fill="url(#bg)" />
  <rect x="1" y="1" width="978" height="358" rx="27" fill="none" stroke="#2f344d" />
  <circle cx="832" cy="78" r="170" fill="url(#glow)" />

  <rect x="34" y="28" width="912" height="304" rx="20" fill="#0d0f1a" opacity="0.94" stroke="#252a42" />
  <rect x="34" y="28" width="912" height="44" rx="20" fill="#14172a" />
  <path d="M34 56 H946" stroke="#252a42" />
  <circle cx="62" cy="51" r="6" fill="#f7768e" />
  <circle cx="84" cy="51" r="6" fill="#e0af68" />
  <circle cx="106" cy="51" r="6" fill="#9ece6a" />
  <text x="132" y="56" class="mono muted" font-size="14">mephistosz@github:~/profile</text>

  <text x="62" y="112" class="mono green" font-size="18">$ build --backend-profile</text>
  <text x="62" y="151" class="sans text" font-size="34" font-weight="700">Felipe Gomes</text>
  <text x="62" y="181" class="sans blue" font-size="18" font-weight="600">Backend Developer | Java &amp; Spring Boot</text>
  <text x="62" y="216" class="sans muted" font-size="15">Clean APIs, service layers, persistence, and maintainable backend systems.</text>

  <text x="62" y="267" class="sans text" font-size="38" font-weight="800">${contributions}</text>
  <text x="62" y="293" class="sans muted" font-size="15">contributions in the last year</text>

  <rect x="292" y="247" width="112" height="31" rx="15.5" fill="#151a2e" stroke="#303852" />
  <text x="319" y="267" class="sans yellow" font-size="12" font-weight="700">Java</text>
  <rect x="292" y="286" width="112" height="31" rx="15.5" fill="#151a2e" stroke="#303852" />
  <text x="312" y="306" class="sans green" font-size="12" font-weight="700">Spring</text>

  <text x="462" y="129" class="mono purple" font-size="18">contributionCalendar</text>
  <text x="462" y="153" class="mono muted" font-size="13">official GitHub GraphQL data • updated ${generatedAt}</text>
  ${heatmap}

  <text x="62" y="329" class="mono muted" font-size="12">Java • Spring Boot • REST APIs • MongoDB • Oracle • Git</text>
  <rect x="34" y="328" width="912" height="4" rx="2" fill="url(#accent)" />
</svg>
`;
}

async function main() {
  let calendar;

  try {
    calendar = await fetchContributionCalendar();
  } catch (error) {
    console.warn(`Using fallback profile data: ${error.message}`);
    calendar = fallback;
  }

  await mkdir(output.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  await writeFile(output, renderCard(calendar), "utf8");
  console.log(`Generated ${output}`);
}

await main();
