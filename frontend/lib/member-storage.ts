const TEAM_META_KEY = "menu_app_team_meta";
const MEMBER_KEY = "menu_app_member";

/** 팀 표시용 메타만 저장합니다. 참가 비밀번호는 XSS 시 유출되므로 저장하지 않습니다. */
export type TeamMeta = {
  teamId: string;
  name: string;
};

export type StoredMember = {
  teamId: string;
  memberId: string;
};

export function setTeamMeta(meta: TeamMeta) {
  try {
    const payload: TeamMeta = { teamId: meta.teamId, name: meta.name };
    sessionStorage.setItem(TEAM_META_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

type LegacyTeamMetaJson = TeamMeta & { join_password?: string };

export function getTeamMeta(): TeamMeta | null {
  try {
    const raw = sessionStorage.getItem(TEAM_META_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as LegacyTeamMetaJson;
    if (!o?.teamId || !o?.name) return null;
    const meta: TeamMeta = { teamId: o.teamId, name: o.name };
    if (o.join_password != null && o.join_password !== "") {
      setTeamMeta(meta);
    }
    return meta;
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

/** 투표 종료 등으로 팀이 사라진 뒤 로컬 참가 정보 제거 */
export function clearMemberStorageForTeam(teamId: string) {
  try {
    const raw = sessionStorage.getItem(MEMBER_KEY);
    if (raw) {
      const o = JSON.parse(raw) as StoredMember;
      if (o?.teamId === teamId) {
        sessionStorage.removeItem(MEMBER_KEY);
      }
    }
    const metaRaw = sessionStorage.getItem(TEAM_META_KEY);
    if (metaRaw) {
      const meta = JSON.parse(metaRaw) as LegacyTeamMetaJson;
      if (meta?.teamId === teamId) {
        sessionStorage.removeItem(TEAM_META_KEY);
      }
    }
  } catch {
    /* ignore */
  }
}
