// Shared TS types. Mirror pydantic schemas in backend/app/schemas/.

export type Role = "uploader" | "evaluator" | "approver" | "auditor";

export interface LoginResponse {
  access_token: string;
  token_type: "bearer";
  role: Role;
  email: string;
}

export type Verdict =
  | "pending"
  | "eligible"
  | "not_eligible"
  | "needs_review"
  | "approved";

export interface Tender {
  id: number;
  title: string;
  status: string;
  created_at: string;
}

export interface ConfidenceBreakdown {
  q_ocr: number;
  q_ext: number;
  q_match: number;
  q_doc: number;
  total: number;
}

export interface CriterionEvidence {
  criterion_id: string;
  description: string;
  mandatory: boolean;
  verdict: Verdict;
  extracted_value?: string;
  threshold?: string;
  reason?: string;
  confidence: ConfidenceBreakdown;
  source_page?: number;
  source_text?: string;
}

export interface Bidder {
  id: number;
  tender_id: number;
  name: string;
  n_files: number;
  created_at: string;
}

export interface Criterion {
  tender_id: number;
  criterion_id: string;
  type: string;
  mandatory: boolean;
  description: string;
  evidence_required?: string[];
  comparison?: string;
  threshold?: string | number | null;
  unit?: string | null;
  source_page?: number;
  source_text?: string;
}

export interface EvidenceRow {
  bidder_id: number;
  criterion_id: string;
  found: boolean;
  extracted_value?: string;
  meets_criterion?: boolean;
  reason?: string;
  source_page?: number;
  q_ocr: number;
  q_ext: number;
  q_match: number;
  q_doc: number;
  total: number;
  verdict: Verdict;
  chain_of_thought?: string;
}

export interface EvaluationDetail {
  id: number;
  tender_id: number;
  bidder_id: number;
  verdict: Verdict;
  overall_confidence: number;
  status: string;
  signed_pdf_path: string | null;
  evidence: EvidenceRow[];
  created_at: string;
  updated_at: string;
}

export interface EvaluationSummary {
  id: number;
  tender_id: number;
  bidder_id: number;
  verdict: Verdict;
  overall_confidence: number;
  status: string;
  created_at: string;
}

export interface ReviewQueueRow {
  id: number;
  tender_id: number;
  bidder_id: number;
  overall_confidence: number;
  updated_at: string;
}

export interface AuditEvent {
  id: number;
  ts: string;
  actor_id: number | null;
  event_type: string;
  payload: Record<string, unknown>;
  prev_hash: string | null;
  this_hash: string;
}

export interface AuditVerify {
  ok: boolean;
  error: string | null;
}
