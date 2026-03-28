export type VoteResultRow = {
  proposal_id: string;
  menu_name: string;
  vote_count: number;
};

export type FinalizeResponse = {
  session_id: string;
  status: string;
  decided_menu: string;
  is_tie_broken: boolean;
  tie_candidates?: string[];
  results: { menu_name: string; vote_count: number; rank: number }[];
};
