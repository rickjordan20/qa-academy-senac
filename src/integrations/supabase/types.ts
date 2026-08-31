export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      cafe_contributions: {
        Row: {
          created_at: string
          description: string
          group_id: string
          id: string
          kind: string
          link: string | null
          run_id: string
          student_id: string
          task_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          group_id: string
          id?: string
          kind?: string
          link?: string | null
          run_id: string
          student_id: string
          task_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          group_id?: string
          id?: string
          kind?: string
          link?: string | null
          run_id?: string
          student_id?: string
          task_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cafe_contributions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_contributions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "cafe_group_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_contributions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "cafe_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe_evidence_requests: {
        Row: {
          created_at: string
          fulfilled_contribution_id: string | null
          group_id: string
          id: string
          message: string
          requested_by: string
          requested_from: string
          run_id: string
          status: string
          task_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          fulfilled_contribution_id?: string | null
          group_id: string
          id?: string
          message?: string
          requested_by: string
          requested_from: string
          run_id: string
          status?: string
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          fulfilled_contribution_id?: string | null
          group_id?: string
          id?: string
          message?: string
          requested_by?: string
          requested_from?: string
          run_id?: string
          status?: string
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cafe_evidence_requests_fulfilled_contribution_id_fkey"
            columns: ["fulfilled_contribution_id"]
            isOneToOne: false
            referencedRelation: "cafe_contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_evidence_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_evidence_requests_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "cafe_group_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_evidence_requests_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "cafe_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe_group_runs: {
        Row: {
          created_at: string
          created_by: string
          deliverable: string
          group_id: string
          id: string
          mission_id: string
          status: string
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deliverable?: string
          group_id: string
          id?: string
          mission_id: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deliverable?: string
          group_id?: string
          id?: string
          mission_id?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cafe_group_runs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_group_runs_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "techeduca_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe_task_collaborators: {
        Row: {
          added_by: string
          created_at: string
          group_id: string
          id: string
          student_id: string
          task_id: string
        }
        Insert: {
          added_by: string
          created_at?: string
          group_id: string
          id?: string
          student_id: string
          task_id: string
        }
        Update: {
          added_by?: string
          created_at?: string
          group_id?: string
          id?: string
          student_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cafe_task_collaborators_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_task_collaborators_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "cafe_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe_tasks: {
        Row: {
          area: string
          assignee_id: string | null
          created_at: string
          created_by: string
          description: string
          group_id: string
          id: string
          position: number
          run_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          area?: string
          assignee_id?: string | null
          created_at?: string
          created_by: string
          description?: string
          group_id: string
          id?: string
          position?: number
          run_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          area?: string
          assignee_id?: string | null
          created_at?: string
          created_by?: string
          description?: string
          group_id?: string
          id?: string
          position?: number
          run_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cafe_tasks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_tasks_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "cafe_group_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          instructor_id: string
          name: string
          period: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          instructor_id: string
          name: string
          period?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          instructor_id?: string
          name?: string
          period?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          class_id: string
          created_at: string
          id: string
          student_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          student_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          member_function: string
          student_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          member_function?: string
          student_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          member_function?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          class_id: string
          created_at: string
          id: string
          name: string
          qa_lead_id: string | null
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          name: string
          qa_lead_id?: string | null
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          name?: string
          qa_lead_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_evaluations: {
        Row: {
          class_id: string
          concept: Database["public"]["Enums"]["evaluation_concept"] | null
          created_at: string
          evaluated_at: string | null
          evaluated_by: string | null
          final_result: Database["public"]["Enums"]["final_result"] | null
          id: string
          indicator_id: string
          notes: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          concept?: Database["public"]["Enums"]["evaluation_concept"] | null
          created_at?: string
          evaluated_at?: string | null
          evaluated_by?: string | null
          final_result?: Database["public"]["Enums"]["final_result"] | null
          id?: string
          indicator_id: string
          notes?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          concept?: Database["public"]["Enums"]["evaluation_concept"] | null
          created_at?: string
          evaluated_at?: string | null
          evaluated_by?: string | null
          final_result?: Database["public"]["Enums"]["final_result"] | null
          id?: string
          indicator_id?: string
          notes?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicator_evaluations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicator_evaluations_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
        ]
      }
      indicators: {
        Row: {
          code: string
          created_at: string
          description: string
          id: string
          position: number
          uc_code: string
          uc_title: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          id?: string
          position: number
          uc_code: string
          uc_title: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          id?: string
          position?: number
          uc_code?: string
          uc_title?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      qa_bugs: {
        Row: {
          assignee_id: string | null
          author_id: string
          context: string
          created_at: string
          description: string
          environment: string
          expected_result: string
          group_id: string | null
          id: string
          mission_id: string | null
          obtained_result: string
          priority: string
          project: string
          severity: string
          status: string
          steps: string
          test_case_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          author_id: string
          context?: string
          created_at?: string
          description?: string
          environment?: string
          expected_result?: string
          group_id?: string | null
          id?: string
          mission_id?: string | null
          obtained_result?: string
          priority?: string
          project?: string
          severity?: string
          status?: string
          steps?: string
          test_case_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          author_id?: string
          context?: string
          created_at?: string
          description?: string
          environment?: string
          expected_result?: string
          group_id?: string | null
          id?: string
          mission_id?: string | null
          obtained_result?: string
          priority?: string
          project?: string
          severity?: string
          status?: string
          steps?: string
          test_case_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_bugs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_bugs_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "techeduca_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_bugs_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "qa_test_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_evidences: {
        Row: {
          author_id: string
          bug_id: string | null
          content: string | null
          context: string
          created_at: string
          description: string
          file_path: string | null
          group_id: string | null
          id: string
          kind: string
          link: string | null
          mission_id: string | null
          project: string
          retest_id: string | null
          test_case_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          bug_id?: string | null
          content?: string | null
          context?: string
          created_at?: string
          description?: string
          file_path?: string | null
          group_id?: string | null
          id?: string
          kind?: string
          link?: string | null
          mission_id?: string | null
          project?: string
          retest_id?: string | null
          test_case_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          bug_id?: string | null
          content?: string | null
          context?: string
          created_at?: string
          description?: string
          file_path?: string | null
          group_id?: string | null
          id?: string
          kind?: string
          link?: string | null
          mission_id?: string | null
          project?: string
          retest_id?: string | null
          test_case_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_evidences_bug_id_fkey"
            columns: ["bug_id"]
            isOneToOne: false
            referencedRelation: "qa_bugs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_evidences_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_evidences_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "techeduca_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_evidences_retest_id_fkey"
            columns: ["retest_id"]
            isOneToOne: false
            referencedRelation: "qa_retests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_evidences_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "qa_test_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_retests: {
        Row: {
          bug_id: string
          created_at: string
          id: string
          notes: string
          result: string
          tested_at: string
          tester_id: string
        }
        Insert: {
          bug_id: string
          created_at?: string
          id?: string
          notes?: string
          result: string
          tested_at?: string
          tester_id: string
        }
        Update: {
          bug_id?: string
          created_at?: string
          id?: string
          notes?: string
          result?: string
          tested_at?: string
          tester_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_retests_bug_id_fkey"
            columns: ["bug_id"]
            isOneToOne: false
            referencedRelation: "qa_bugs"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_test_cases: {
        Row: {
          assignee_id: string | null
          author_id: string
          context: string
          created_at: string
          executed_at: string | null
          executed_by: string | null
          expected_result: string
          feature: string
          group_id: string | null
          id: string
          input_data: string
          mission_id: string | null
          obtained_result: string
          precondition: string
          project: string
          status: string
          steps: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          author_id: string
          context?: string
          created_at?: string
          executed_at?: string | null
          executed_by?: string | null
          expected_result?: string
          feature?: string
          group_id?: string | null
          id?: string
          input_data?: string
          mission_id?: string | null
          obtained_result?: string
          precondition?: string
          project?: string
          status?: string
          steps?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          author_id?: string
          context?: string
          created_at?: string
          executed_at?: string | null
          executed_by?: string | null
          expected_result?: string
          feature?: string
          group_id?: string | null
          id?: string
          input_data?: string
          mission_id?: string | null
          obtained_result?: string
          precondition?: string
          project?: string
          status?: string
          steps?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_test_cases_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_test_cases_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "techeduca_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      techeduca_bug_reports: {
        Row: {
          classification: string
          created_at: string
          expected_result: string
          feature: string
          id: string
          mission_id: string | null
          note: string | null
          obtained_result: string
          problem: string
          run_id: string | null
          steps: string
          student_id: string
          updated_at: string
        }
        Insert: {
          classification?: string
          created_at?: string
          expected_result?: string
          feature: string
          id?: string
          mission_id?: string | null
          note?: string | null
          obtained_result?: string
          problem: string
          run_id?: string | null
          steps?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          classification?: string
          created_at?: string
          expected_result?: string
          feature?: string
          id?: string
          mission_id?: string | null
          note?: string | null
          obtained_result?: string
          problem?: string
          run_id?: string | null
          steps?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "techeduca_bug_reports_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "techeduca_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "techeduca_bug_reports_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "techeduca_mission_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      techeduca_evidences: {
        Row: {
          bug_report_id: string | null
          created_at: string
          description: string | null
          file_path: string | null
          id: string
          link: string | null
          run_id: string | null
          student_id: string
          title: string
          updated_at: string
        }
        Insert: {
          bug_report_id?: string | null
          created_at?: string
          description?: string | null
          file_path?: string | null
          id?: string
          link?: string | null
          run_id?: string | null
          student_id: string
          title: string
          updated_at?: string
        }
        Update: {
          bug_report_id?: string | null
          created_at?: string
          description?: string | null
          file_path?: string | null
          id?: string
          link?: string | null
          run_id?: string | null
          student_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "techeduca_evidences_bug_report_id_fkey"
            columns: ["bug_report_id"]
            isOneToOne: false
            referencedRelation: "techeduca_bug_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "techeduca_evidences_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "techeduca_mission_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      techeduca_mission_runs: {
        Row: {
          checklist_state: Json
          checkpoint_answers: Json
          completed_at: string | null
          created_at: string
          id: string
          mission_id: string
          reflection: string | null
          started_at: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          checklist_state?: Json
          checkpoint_answers?: Json
          completed_at?: string | null
          created_at?: string
          id?: string
          mission_id: string
          reflection?: string | null
          started_at?: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          checklist_state?: Json
          checkpoint_answers?: Json
          completed_at?: string | null
          created_at?: string
          id?: string
          mission_id?: string
          reflection?: string | null
          started_at?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "techeduca_mission_runs_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "techeduca_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      techeduca_missions: {
        Row: {
          checklist: Json
          checkpoint: Json
          code: string
          created_at: string
          id: string
          indicator_codes: string[]
          kind: string
          objective: string
          position: number
          practice: Json
          published: boolean
          summary: Json
          title: string
          track: string
          updated_at: string
        }
        Insert: {
          checklist?: Json
          checkpoint?: Json
          code: string
          created_at?: string
          id?: string
          indicator_codes?: string[]
          kind?: string
          objective: string
          position?: number
          practice?: Json
          published?: boolean
          summary?: Json
          title: string
          track?: string
          updated_at?: string
        }
        Update: {
          checklist?: Json
          checkpoint?: Json
          code?: string
          created_at?: string
          id?: string
          indicator_codes?: string[]
          kind?: string
          objective?: string
          position?: number
          practice?: Json
          published?: boolean
          summary?: Json
          title?: string
          track?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_group: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_group: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      enroll_student_by_email: {
        Args: { _class_id: string; _email: string }
        Returns: string
      }
      group_class_id: { Args: { _group_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_class_instructor: {
        Args: { _class_id: string; _user_id: string }
        Returns: boolean
      }
      is_class_member: {
        Args: { _class_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_qa_lead: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      qa_can_edit: {
        Args: { _author: string; _group_id: string; _viewer: string }
        Returns: boolean
      }
      qa_can_view: {
        Args: { _author: string; _group_id: string; _viewer: string }
        Returns: boolean
      }
      qa_is_instructor_of: {
        Args: { _student: string; _viewer: string }
        Returns: boolean
      }
      shares_class: {
        Args: { _target: string; _viewer: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "instructor" | "student"
      evaluation_concept: "A" | "PA" | "NA"
      final_result: "D" | "ND"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["instructor", "student"],
      evaluation_concept: ["A", "PA", "NA"],
      final_result: ["D", "ND"],
    },
  },
} as const
