export interface Team {
  id: string;
  name: string;
  /** 팀 참가용 비밀번호 (서버 DB `invite_code`와 동일 값) */
  join_password: string;
  created_at: string;
}

export interface Member {
  id: string;
  team_id: string;
  nickname: string;
  user_id?: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  team_id: string;
  date: string;
  status: "proposing" | "voting" | "completed";
  vote_started_at: string | null;
  decided_menu: string | null;
  created_at: string;
}

export interface Proposal {
  id: string;
  session_id: string;
  member_id: string;
  menu_name: string;
  nickname?: string;
  vote_count?: number;
  created_at: string;
}

export interface Vote {
  id: string;
  session_id: string;
  member_id: string;
  proposal_id: string;
  created_at: string;
}

export interface HistoryEntry {
  session_id: string;
  date: string;
  decided_menu: string;
  vote_count: number;
  total_members: number;
}
