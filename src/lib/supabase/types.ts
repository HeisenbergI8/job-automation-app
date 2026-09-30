
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "application_documents": {
                  Row: {
                    "ats_score_after": number | null,"ats_score_before": number | null,"content_type": string | null,"created_at": string,"file_name": string,"id": string,"intro_adaptation_id": string | null,"job_id": string,"kind": Database["public"]['Enums']["document_kind"],"storage_path": string
                  }
                  Insert: {
                    "ats_score_after"?: number | null,"ats_score_before"?: number | null,"content_type"?: string | null,"created_at"?: string,"file_name": string,"id"?: string,"intro_adaptation_id"?: string | null,"job_id": string,"kind": Database["public"]['Enums']["document_kind"],"storage_path": string
                  }
                  Update: {
                    "ats_score_after"?: number | null,"ats_score_before"?: number | null,"content_type"?: string | null,"created_at"?: string,"file_name"?: string,"id"?: string,"intro_adaptation_id"?: string | null,"job_id"?: string,"kind"?: Database["public"]['Enums']["document_kind"],"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "application_documents_intro_adaptation_id_fkey"
      columns: ["intro_adaptation_id"]
isOneToOne: false
      referencedRelation: "intro_adaptations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "application_documents_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "follow_up_jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "application_documents_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    }
                  ]
                },"career_boards": {
                  Row: {
                    "ats": Database["public"]['Enums']["ats"],"company": string | null,"created_at": string,"id": string,"last_checked_at": string | null,"last_error": string | null,"slug": string
                  }
                  Insert: {
                    "ats": Database["public"]['Enums']["ats"],"company"?: string | null,"created_at"?: string,"id"?: string,"last_checked_at"?: string | null,"last_error"?: string | null,"slug": string
                  }
                  Update: {
                    "ats"?: Database["public"]['Enums']["ats"],"company"?: string | null,"created_at"?: string,"id"?: string,"last_checked_at"?: string | null,"last_error"?: string | null,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"finder_requests": {
                  Row: {
                    "id": string,"picked_up_at": string | null,"requested_at": string,"run_id": string | null
                  }
                  Insert: {
                    "id"?: string,"picked_up_at"?: string | null,"requested_at"?: string,"run_id"?: string | null
                  }
                  Update: {
                    "id"?: string,"picked_up_at"?: string | null,"requested_at"?: string,"run_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "finder_requests_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "worker_runs"
      referencedColumns: ["id"]
    }
                  ]
                },"intro_adaptations": {
                  Row: {
                    "adapted_text": string,"created_at": string,"decided_at": string | null,"id": string,"job_id": string,"requirements": string,"status": Database["public"]['Enums']["intro_status"]
                  }
                  Insert: {
                    "adapted_text": string,"created_at"?: string,"decided_at"?: string | null,"id"?: string,"job_id": string,"requirements": string,"status"?: Database["public"]['Enums']["intro_status"]
                  }
                  Update: {
                    "adapted_text"?: string,"created_at"?: string,"decided_at"?: string | null,"id"?: string,"job_id"?: string,"requirements"?: string,"status"?: Database["public"]['Enums']["intro_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "intro_adaptations_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "follow_up_jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "intro_adaptations_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    }
                  ]
                },"job_status_events": {
                  Row: {
                    "changed_at": string,"from_status": Database["public"]['Enums']["job_status"] | null,"id": string,"job_id": string,"note": string | null,"to_status": Database["public"]['Enums']["job_status"]
                  }
                  Insert: {
                    "changed_at"?: string,"from_status"?: Database["public"]['Enums']["job_status"] | null,"id"?: string,"job_id": string,"note"?: string | null,"to_status": Database["public"]['Enums']["job_status"]
                  }
                  Update: {
                    "changed_at"?: string,"from_status"?: Database["public"]['Enums']["job_status"] | null,"id"?: string,"job_id"?: string,"note"?: string | null,"to_status"?: Database["public"]['Enums']["job_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_status_events_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "follow_up_jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_status_events_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    }
                  ]
                },"job_status_transitions": {
                  Row: {
                    "from_status": Database["public"]['Enums']["job_status"],"to_status": Database["public"]['Enums']["job_status"]
                  }
                  Insert: {
                    "from_status": Database["public"]['Enums']["job_status"],"to_status": Database["public"]['Enums']["job_status"]
                  }
                  Update: {
                    "from_status"?: Database["public"]['Enums']["job_status"],"to_status"?: Database["public"]['Enums']["job_status"]
                  }
                  Relationships: [
                    
                  ]
                },"jobs": {
                  Row: {
                    "apply_method": Database["public"]['Enums']["apply_method"] | null,"ats_keywords": (string)[] | null,"company": string,"created_at": string,"date_applied": string | null,"date_found": string,"description": string | null,"fit_reasons": (string)[] | null,"fit_score": number | null,"id": string,"location": string | null,"role": string,"salary_currency": string | null,"salary_max": number | null,"salary_min": number | null,"salary_raw": string | null,"site": string,"status": Database["public"]['Enums']["job_status"],"url": string
                  }
                  Insert: {
                    "apply_method"?: Database["public"]['Enums']["apply_method"] | null,"ats_keywords"?: (string)[] | null,"company": string,"created_at"?: string,"date_applied"?: string | null,"date_found"?: string,"description"?: string | null,"fit_reasons"?: (string)[] | null,"fit_score"?: number | null,"id"?: string,"location"?: string | null,"role": string,"salary_currency"?: string | null,"salary_max"?: number | null,"salary_min"?: number | null,"salary_raw"?: string | null,"site": string,"status"?: Database["public"]['Enums']["job_status"],"url": string
                  }
                  Update: {
                    "apply_method"?: Database["public"]['Enums']["apply_method"] | null,"ats_keywords"?: (string)[] | null,"company"?: string,"created_at"?: string,"date_applied"?: string | null,"date_found"?: string,"description"?: string | null,"fit_reasons"?: (string)[] | null,"fit_score"?: number | null,"id"?: string,"location"?: string | null,"role"?: string,"salary_currency"?: string | null,"salary_max"?: number | null,"salary_min"?: number | null,"salary_raw"?: string | null,"site"?: string,"status"?: Database["public"]['Enums']["job_status"],"url"?: string
                  }
                  Relationships: [
                    
                  ]
                },"processed_emails": {
                  Row: {
                    "jobs_found": number,"message_id": string,"processed_at": string,"site": string
                  }
                  Insert: {
                    "jobs_found"?: number,"message_id": string,"processed_at"?: string,"site": string
                  }
                  Update: {
                    "jobs_found"?: number,"message_id"?: string,"processed_at"?: string,"site"?: string
                  }
                  Relationships: [
                    
                  ]
                },"seen_postings": {
                  Row: {
                    "company": string,"first_seen_at": string,"location": string | null,"role": string,"score": number | null,"url": string
                  }
                  Insert: {
                    "company": string,"first_seen_at"?: string,"location"?: string | null,"role": string,"score"?: number | null,"url": string
                  }
                  Update: {
                    "company"?: string,"first_seen_at"?: string,"location"?: string | null,"role"?: string,"score"?: number | null,"url"?: string
                  }
                  Relationships: [
                    
                  ]
                },"settings": {
                  Row: {
                    "excluded_keywords": (string)[],"follow_up_after_days": number,"ghost_after_days": number,"id": boolean,"locations": (string)[],"master_cv": Json | null,"must_have_keywords": (string)[],"remote_preference": Database["public"]['Enums']["remote_preference"],"salary_currency": string | null,"salary_floor": number | null,"self_intro": string | null,"target_roles": (string)[],"updated_at": string
                  }
                  Insert: {
                    "excluded_keywords"?: (string)[],"follow_up_after_days"?: number,"ghost_after_days"?: number,"id"?: boolean,"locations"?: (string)[],"master_cv"?: Json | null,"must_have_keywords"?: (string)[],"remote_preference"?: Database["public"]['Enums']["remote_preference"],"salary_currency"?: string | null,"salary_floor"?: number | null,"self_intro"?: string | null,"target_roles"?: (string)[],"updated_at"?: string
                  }
                  Update: {
                    "excluded_keywords"?: (string)[],"follow_up_after_days"?: number,"ghost_after_days"?: number,"id"?: boolean,"locations"?: (string)[],"master_cv"?: Json | null,"must_have_keywords"?: (string)[],"remote_preference"?: Database["public"]['Enums']["remote_preference"],"salary_currency"?: string | null,"salary_floor"?: number | null,"self_intro"?: string | null,"target_roles"?: (string)[],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"worker_runs": {
                  Row: {
                    "dry_run": boolean,"errors": (string)[],"fetched": number,"finished_at": string | null,"id": string,"jsearch_lookups": number,"jsearch_searches": number,"new_postings": number,"notified": boolean,"ok": boolean | null,"saved": number,"scored": number,"scorer": string | null,"stage": string | null,"started_at": string
                  }
                  Insert: {
                    "dry_run"?: boolean,"errors"?: (string)[],"fetched"?: number,"finished_at"?: string | null,"id"?: string,"jsearch_lookups"?: number,"jsearch_searches"?: number,"new_postings"?: number,"notified"?: boolean,"ok"?: boolean | null,"saved"?: number,"scored"?: number,"scorer"?: string | null,"stage"?: string | null,"started_at"?: string
                  }
                  Update: {
                    "dry_run"?: boolean,"errors"?: (string)[],"fetched"?: number,"finished_at"?: string | null,"id"?: string,"jsearch_lookups"?: number,"jsearch_searches"?: number,"new_postings"?: number,"notified"?: boolean,"ok"?: boolean | null,"saved"?: number,"scored"?: number,"scorer"?: string | null,"stage"?: string | null,"started_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "follow_up_jobs": {
                  Row: {
                    "company": string | null,"date_applied": string | null,"id": string | null,"role": string | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "mark_ghosted_jobs":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"set_job_status":
{ Args: { "p_apply_method"?: Database["public"]['Enums']["apply_method"],"p_job_id": string,"p_note"?: string,"p_to": Database["public"]['Enums']["job_status"] }; Returns: {
              "changed_at": string,
"from_status": Database["public"]['Enums']["job_status"] | null,
"id": string,
"job_id": string,
"note": string | null,
"to_status": Database["public"]['Enums']["job_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "job_status_events"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "apply_method": "auto"|"manual","ats": "greenhouse"|"lever"|"ashby","document_kind": "cv"|"cover_letter"|"intro","intro_status": "pending"|"approved"|"rejected","job_status": "found"|"applied"|"needs_manual"|"screening"|"interview"|"offer"|"rejected"|"ghosted","remote_preference": "remote"|"hybrid"|"onsite"|"any"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "apply_method": ["auto", "manual"],"ats": ["greenhouse", "lever", "ashby"],"document_kind": ["cv", "cover_letter", "intro"],"intro_status": ["pending", "approved", "rejected"],"job_status": ["found", "applied", "needs_manual", "screening", "interview", "offer", "rejected", "ghosted"],"remote_preference": ["remote", "hybrid", "onsite", "any"]
          }
        }
} as const

