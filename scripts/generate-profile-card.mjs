import { mkdir, writeFile } from "node:fs/promises";

const username = process.env.GITHUB_REPOSITORY_OWNER || process.env.GITHUB_USERNAME || "Mephistosz";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const output = process.env.PROFILE_CARD_OUTPUT || "assets/profile-card.svg";

const fallback = {
  totalContributions: 462,
  weeks: buildFallbackWeeks(),
};

function escapeHtml(value) {
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

function renderHeatmapCells(weeks) {
  const normalizedWeeks = weeks.slice(-53);

  return normalizedWeeks.map((week) => {
    const days = week.contributionDays || [];
    const cells = days.map((day) => {
      const color = levelToColor(day);
      return `<div style="width:10px;height:10px;border-radius:2px;background:${color};"></div>`;
    }).join("");
    return `<div style="display:flex;flex-direction:column;gap:2px;">${cells}</div>`;
  }).join("");
}

function renderCard(calendar) {
  const contributions = Number(calendar.totalContributions || fallback.totalContributions).toLocaleString("en-US");
  const heatmapCells = renderHeatmapCells(calendar.weeks || fallback.weeks);
  const generatedAt = new Date().toISOString().slice(0, 10);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="980" height="420" viewBox="0 0 980 420" role="img" aria-labelledby="title desc">
  <title id="title">${escapeHtml(username)} backend profile card</title>
  <desc id="desc">A dark terminal-style GitHub profile card with contribution calendar data.</desc>
  <foreignObject width="980" height="420">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:980px;height:420px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:linear-gradient(135deg,#080914,#111427,#241430);border-radius:28px;border:1px solid #2f344d;overflow:hidden;position:relative;">
      <div style="position:absolute;top:0;right:0;width:340px;height:340px;background:radial-gradient(circle,rgba(187,154,247,0.15) 0%,rgba(122,162,247,0) 70%);pointer-events:none;"></div>
      <div style="position:relative;z-index:1;padding:0;">
        <div style="background:#14172a;border-bottom:1px solid #252a42;padding:12px 28px;display:flex;align-items:center;gap:8px;border-radius:28px 28px 0 0;">
          <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#f7768e;"></span>
          <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#e0af68;"></span>
          <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#9ece6a;"></span>
          <span style="margin-left:12px;font-family:Consolas,Monaco,'Courier New',monospace;font-size:13px;color:#79809a;">mephistosz@github:~/profile</span>
        </div>
        <div style="padding:28px 40px 24px 40px;">
          <div style="display:flex;gap:48px;align-items:flex-start;">
            <div style="flex:1;min-width:0;">
              <div style="font-family:Consolas,Monaco,'Courier New',monospace;font-size:16px;color:#9ece6a;margin-bottom:14px;">$ build --backend-profile</div>
              <div style="font-size:34px;font-weight:700;color:#c0caf5;line-height:1.2;margin-bottom:8px;">Felipe Gomes</div>
              <div style="font-size:17px;font-weight:600;color:#7dcfff;margin-bottom:14px;">Backend Developer | Java &amp; Spring Boot</div>
              <div style="font-size:14px;color:#79809a;line-height:1.5;margin-bottom:24px;">Clean APIs, service layers, database-backed systems, and maintainable backend code.</div>
              <div style="display:flex;gap:12px;align-items:center;margin-bottom:6px;">
                <span style="font-size:38px;font-weight:800;color:#c0caf5;line-height:1;">${contributions}</span>
                <span style="font-size:14px;color:#79809a;">contributions in the last year</span>
              </div>
              <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">
                <span style="display:inline-block;padding:6px 16px;border-radius:14px;background:#151a2e;border:1px solid #303852;font-size:12px;font-weight:700;color:#e0af68;">Java</span>
                <span style="display:inline-block;padding:6px 16px;border-radius:14px;background:#151a2e;border:1px solid #303852;font-size:12px;font-weight:700;color:#9ece6a;">Spring Boot</span>
                <span style="display:inline-block;padding:6px 16px;border-radius:14px;background:#151a2e;border:1px solid #303852;font-size:12px;font-weight:700;color:#7dcfff;">REST APIs</span>
                <span style="display:inline-block;padding:6px 16px;border-radius:14px;background:#151a2e;border:1px solid #303852;font-size:12px;font-weight:700;color:#bb9af7;">Databases</span>
              </div>
            </div>
            <div style="flex-shrink:0;">
              <div style="font-family:Consolas,Monaco,'Courier New',monospace;font-size:15px;color:#bb9af7;margin-bottom:6px;">contributionCalendar</div>
              <div style="font-family:Consolas,Monaco,'Courier New',monospace;font-size:11px;color:#79809a;margin-bottom:12px;">GitHub GraphQL data &bull; ${generatedAt}</div>
              <div style="display:flex;gap:2px;align-items:flex-end;">
                ${heatmapCells}
              </div>
            </div>
          </div>
        </div>
        <div style="background:linear-gradient(90deg,#7aa2f7,#bb9af7,#f7768e);height:3px;"></div>
        <div style="padding:8px 40px;background:rgba(13,15,26,0.5);border-radius:0 0 28px 28px;">
          <span style="font-family:Consolas,Monaco,'Courier New',monospace;font-size:11px;color:#79809a;">Java &bull; Spring Boot &bull; REST APIs &bull; MongoDB &bull; Oracle &bull; Git</span>
        </div>
      </div>
    </div>
  </foreignObject>
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
