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

  if (count === 0 || level === "NONE" || level === "LEVEL_0") return "#161b22";
  if (level === "FIRST_QUARTILE" || level === "LEVEL_1") return "#0e4429";
  if (level === "SECOND_QUARTILE" || level === "LEVEL_2") return "#006d32";
  if (level === "THIRD_QUARTILE" || level === "LEVEL_3") return "#26a641";
  return "#39d353";
}

function renderHeatmap(weeks, startX, startY) {
  const cell = 7;
  const gap = 2;
  const normalizedWeeks = weeks.slice(-53);
  const rects = [];

  normalizedWeeks.forEach((week, weekIndex) => {
    const days = week.contributionDays || [];
    days.forEach((day, dayIndex) => {
      const x = startX + weekIndex * (cell + gap);
      const y = startY + dayIndex * (cell + gap);
      rects.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="1.5" fill="${levelToColor(day)}"/>`);
    });
  });

  return rects.join("\n      ");
}

function renderCard(calendar) {
  const contributions = Number(calendar.totalContributions || fallback.totalContributions).toLocaleString("en-US");
  const generatedAt = new Date().toISOString().slice(0, 10);

  const mono = "Consolas, Monaco, 'Courier New', monospace";
  const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
  const heatmapX = 470;
  const heatmapY = 170;
  const heatmap = renderHeatmap(calendar.weeks || fallback.weeks, heatmapX, heatmapY);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="980" height="430" viewBox="0 0 980 430" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(username)} backend profile card</title>
  <desc id="desc">A dark terminal-style GitHub profile card with contribution calendar data.</desc>

  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#080914"/>
      <stop offset="50%" stop-color="#111427"/>
      <stop offset="100%" stop-color="#241430"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#7aa2f7"/>
      <stop offset="50%" stop-color="#bb9af7"/>
      <stop offset="100%" stop-color="#f7768e"/>
    </linearGradient>
  </defs>

  <rect width="980" height="430" rx="28" fill="url(#bgGrad)"/>
  <rect x="0.5" y="0.5" width="979" height="429" rx="27.5" fill="none" stroke="#2f344d"/>

  <rect x="34" y="28" width="912" height="304" rx="20" fill="#0d0f1a" opacity="0.94" stroke="#252a42"/>
  <rect x="34" y="28" width="912" height="44" rx="20" fill="#14172a"/>
  <line x1="34" y1="56" x2="946" y2="56" stroke="#252a42" stroke-width="1"/>

  <circle cx="62" cy="51" r="6" fill="#f7768e"/>
  <circle cx="84" cy="51" r="6" fill="#e0af68"/>
  <circle cx="106" cy="51" r="6" fill="#9ece6a"/>
  <text x="132" y="56" font-family="${mono}" font-size="13" fill="#79809a">mephistosz@github:~/profile</text>

  <text x="62" y="112" font-family="${mono}" font-size="16" fill="#9ece6a">$ build --backend-profile</text>
  <text x="62" y="152" font-family="${sans}" font-size="34" font-weight="700" fill="#c0caf5">Felipe Gomes</text>
  <text x="62" y="182" font-family="${sans}" font-size="17" font-weight="600" fill="#7dcfff">Backend Developer | Java &amp; Spring Boot</text>
  <text x="62" y="216" font-family="${sans}" font-size="14" fill="#79809a">Clean APIs, service layers, database-backed systems, and maintainable backend code.</text>

  <text x="62" y="272" font-family="${sans}" font-size="38" font-weight="800" fill="#c0caf5">${contributions}</text>
  <text x="260" y="272" font-family="${sans}" font-size="14" fill="#79809a">contributions in the last year</text>

  <rect x="62" y="292" width="90" height="28" rx="14" fill="#151a2e" stroke="#303852"/>
  <text x="82" y="311" font-family="${sans}" font-size="12" font-weight="700" fill="#e0af68">Java</text>
  <rect x="162" y="292" width="116" height="28" rx="14" fill="#151a2e" stroke="#303852"/>
  <text x="186" y="311" font-family="${sans}" font-size="12" font-weight="700" fill="#9ece6a">Spring Boot</text>
  <rect x="288" y="292" width="104" height="28" rx="14" fill="#151a2e" stroke="#303852"/>
  <text x="310" y="311" font-family="${sans}" font-size="12" font-weight="700" fill="#7dcfff">REST APIs</text>
  <rect x="402" y="292" width="106" height="28" rx="14" fill="#151a2e" stroke="#303852"/>
  <text x="424" y="311" font-family="${sans}" font-size="12" font-weight="700" fill="#bb9af7">Databases</text>

  <text x="${heatmapX}" y="129" font-family="${mono}" font-size="15" fill="#bb9af7">contributionCalendar</text>
  <text x="${heatmapX}" y="153" font-family="${mono}" font-size="11" fill="#79809a">GitHub GraphQL data &#x2022; ${generatedAt}</text>
  ${heatmap}

  <rect x="34" y="396" width="912" height="3" fill="url(#accentGrad)"/>
  <text x="62" y="420" font-family="${mono}" font-size="11" fill="#79809a">Java &#x2022; Spring Boot &#x2022; REST APIs &#x2022; MongoDB &#x2022; Oracle &#x2022; Git</text>
</svg>`;
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
