const TEAM_META_KEY = "menu_app_team_meta";
const MEMBER_KEY = "menu_app_member";

export type TeamMeta = {
  teamId: string;
  name: string;
  join_password: string;
};

export type StoredMember = {
  teamId: string;
  memberId: string;
};

export function setTeamMeta(meta: TeamMeta) {
  try {
    sessionStorage.setItem(TEAM_META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

export function getTeamMeta(): TeamMeta | null {
  try {
    const raw = sessionStorage.getItem(TEAM_META_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as TeamMeta;
    if (o?.teamId && o?.name && o?.join_password) return o;
    return null;
  } catch {
    return null;
  }
}

export function setStoredMember(teamId: string, memberId: string) {
  try {
    const data: StoredMember = { teamId, memberId };
    sessionStorage.setItem(MEMBER_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function getStoredMember(teamId: string): string | null {
  try {
    const raw = sessionStorage.getItem(MEMBER_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as StoredMember;
    if (o?.teamId === teamId && o?.memberId) return o.memberId;
    return null;
  } catch {
    return null;
  }
}
