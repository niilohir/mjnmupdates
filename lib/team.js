// The people who can post, and their avatar colors.
// Edit this list to add or rename someone; the website picks it up automatically.
export const TEAM = [
  { name: "Anders", color: "#1d9bf0" }, // blue
  { name: "Arttu", color: "#00a36c" },  // green
  { name: "Emppu", color: "#e0287d" },  // pink
  { name: "Niilo", color: "#7856ff" },  // purple
  { name: "Ingman", color: "#e8590c" }, // orange
];

export const isTeamMember = (name) => TEAM.some((m) => m.name === name);
