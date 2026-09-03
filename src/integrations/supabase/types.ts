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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_features: {
        Row: {
          category: string
          code: string
          created_at: string
          created_by: string | null
          description: string
          group_id: string | null
          id: string
          kind: string
          module_id: string | null
          name: string
          notes: string
          origin: string
          owner_id: string | null
          position: number
          project: string
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          code: string
          created_at?: string
          created_by?: string | null
          description?: string
          group_id?: string | null
          id?: string
          kind?: string
          module_id?: string | null
          name: string
          notes?: string
          origin?: string
          owner_id?: string | null
          position?: number
          project: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string
          group_id?: string | null
          id?: string
          kind?: string
          module_id?: string | null
          name?: string
          notes?: string
          origin?: string
          owner_id?: string | null
          position?: number
          project?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_features_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_features_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "app_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      app_modules: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          group_id: string | null
          id: string
          name: string
          position: number
          project: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          group_id?: string | null
          id?: string
          name: string
          position?: number
          project: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          group_id?: string | null
          id?: string
          name?: string
          position?: number
          project?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_modules_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          new_value: Json
          old_value: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          new_value?: Json
          old_value?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          new_value?: Json
          old_value?: Json
        }
        Relationships: []
      }
      builder_mission_assignments: {
        Row: {
          class_id: string
          created_at: string
          id: string
          mission_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          mission_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          mission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "builder_mission_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "builder_mission_assignments_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "builder_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      builder_mission_entries: {
        Row: {
          author_id: string
          created_at: string
          data: Json
          feature_id: string | null
          file_path: string | null
          group_id: string | null
          id: string
          kind: string
          link: string | null
          mission_id: string
          parent_id: string | null
          run_id: string
          section_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          created_at?: string
          data?: Json
          feature_id?: string | null
          file_path?: string | null
          group_id?: string | null
          id?: string
          kind: string
          link?: string | null
          mission_id: string
          parent_id?: string | null
          run_id: string
          section_id: string
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          data?: Json
          feature_id?: string | null
          file_path?: string | null
          group_id?: string | null
          id?: string
          kind?: string
          link?: string | null
          mission_id?: string
          parent_id?: string | null
          run_id?: string
          section_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "builder_mission_entries_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "app_features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "builder_mission_entries_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "builder_mission_entries_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "builder_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "builder_mission_entries_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "builder_mission_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "builder_mission_entries_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "builder_mission_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      builder_mission_runs: {
        Row: {
          answers: Json
          attempt: number
          checklist_state: Json
          created_at: string
          created_by: string
          eval_status: string
          evaluated_at: string | null
          evaluated_by: string | null
          feedback: string
          group_id: string | null
          id: string
          mission_id: string
          progress: number
          status: string
          student_id: string | null
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
          xp_awarded: number | null
        }
        Insert: {
          answers?: Json
          attempt?: number
          checklist_state?: Json
          created_at?: string
          created_by: string
          eval_status?: string
          evaluated_at?: string | null
          evaluated_by?: string | null
          feedback?: string
          group_id?: string | null
          id?: string
          mission_id: string
          progress?: number
          status?: string
          student_id?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          xp_awarded?: number | null
        }
        Update: {
          answers?: Json
          attempt?: number
          checklist_state?: Json
          created_at?: string
          created_by?: string
          eval_status?: string
          evaluated_at?: string | null
          evaluated_by?: string | null
          feedback?: string
          group_id?: string | null
          id?: string
          mission_id?: string
          progress?: number
          status?: string
          student_id?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          xp_awarded?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "builder_mission_runs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "builder_mission_runs_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "builder_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      builder_missions: {
        Row: {
          activity_kind: string
          badge_code: string | null
          base_xp: number
          code: string | null
          created_at: string
          created_by: string
          description: string
          due_at: string | null
          feature_ids: string[]
          id: string
          indicator_codes: string[]
          is_library_template: boolean
          lesson_number: number | null
          library_name: string | null
          modality: string
          objective: string
          opens_at: string | null
          position: number
          project: string
          sections: Json
          status: string
          subtitle: string
          template: string
          title: string
          updated_at: string
          workload: string
        }
        Insert: {
          activity_kind?: string
          badge_code?: string | null
          base_xp?: number
          code?: string | null
          created_at?: string
          created_by: string
          description?: string
          due_at?: string | null
          feature_ids?: string[]
          id?: string
          indicator_codes?: string[]
          is_library_template?: boolean
          lesson_number?: number | null
          library_name?: string | null
          modality?: string
          objective?: string
          opens_at?: string | null
          position?: number
          project?: string
          sections?: Json
          status?: string
          subtitle?: string
          template?: string
          title: string
          updated_at?: string
          workload?: string
        }
        Update: {
          activity_kind?: string
          badge_code?: string | null
          base_xp?: number
          code?: string | null
          created_at?: string
          created_by?: string
          description?: string
          due_at?: string | null
          feature_ids?: string[]
          id?: string
          indicator_codes?: string[]
          is_library_template?: boolean
          lesson_number?: number | null
          library_name?: string | null
          modality?: string
          objective?: string
          opens_at?: string | null
          position?: number
          project?: string
          sections?: Json
          status?: string
          subtitle?: string
          template?: string
          title?: string
          updated_at?: string
          workload?: string
        }
        Relationships: []
      }
      builder_run_evaluations: {
        Row: {
          block_results: Json
          created_at: string
          evaluator_id: string | null
          feedback: string
          group_snapshot: Json
          id: string
          indicator_finals: Json
          is_current: boolean
          mission_id: string
          run_id: string
          target_student_ids: string[]
          updated_at: string
          version: number
          xp: number | null
        }
        Insert: {
          block_results?: Json
          created_at?: string
          evaluator_id?: string | null
          feedback?: string
          group_snapshot?: Json
          id?: string
          indicator_finals?: Json
          is_current?: boolean
          mission_id: string
          run_id: string
          target_student_ids?: string[]
          updated_at?: string
          version?: number
          xp?: number | null
        }
        Update: {
          block_results?: Json
          created_at?: string
          evaluator_id?: string | null
          feedback?: string
          group_snapshot?: Json
          id?: string
          indicator_finals?: Json
          is_current?: boolean
          mission_id?: string
          run_id?: string
          target_student_ids?: string[]
          updated_at?: string
          version?: number
          xp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "builder_run_evaluations_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "builder_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "builder_run_evaluations_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "builder_mission_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      builder_run_events: {
        Row: {
          actor_id: string | null
          attempt: number
          created_at: string
          id: string
          kind: string
          mission_id: string
          note: string
          run_id: string
        }
        Insert: {
          actor_id?: string | null
          attempt?: number
          created_at?: string
          id?: string
          kind: string
          mission_id: string
          note?: string
          run_id: string
        }
        Update: {
          actor_id?: string | null
          attempt?: number
          created_at?: string
          id?: string
          kind?: string
          mission_id?: string
          note?: string
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "builder_run_events_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "builder_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "builder_run_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "builder_mission_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe_contributions: {
        Row: {
          builder_run_id: string | null
          created_at: string
          description: string
          group_id: string
          id: string
          kind: string
          link: string | null
          mission_id: string | null
          reflection: string
          run_id: string | null
          scope: string
          section_id: string | null
          student_id: string
          task_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          builder_run_id?: string | null
          created_at?: string
          description?: string
          group_id: string
          id?: string
          kind?: string
          link?: string | null
          mission_id?: string | null
          reflection?: string
          run_id?: string | null
          scope?: string
          section_id?: string | null
          student_id: string
          task_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          builder_run_id?: string | null
          created_at?: string
          description?: string
          group_id?: string
          id?: string
          kind?: string
          link?: string | null
          mission_id?: string | null
          reflection?: string
          run_id?: string | null
          scope?: string
          section_id?: string | null
          student_id?: string
          task_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cafe_contributions_builder_run_id_fkey"
            columns: ["builder_run_id"]
            isOneToOne: false
            referencedRelation: "builder_mission_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_contributions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_contributions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "builder_missions"
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
          builder_run_id: string | null
          created_at: string
          created_by: string
          description: string
          feature_id: string | null
          group_id: string
          id: string
          mission_id: string | null
          module_id: string | null
          position: number
          run_id: string | null
          section_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          area?: string
          assignee_id?: string | null
          builder_run_id?: string | null
          created_at?: string
          created_by: string
          description?: string
          feature_id?: string | null
          group_id: string
          id?: string
          mission_id?: string | null
          module_id?: string | null
          position?: number
          run_id?: string | null
          section_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          area?: string
          assignee_id?: string | null
          builder_run_id?: string | null
          created_at?: string
          created_by?: string
          description?: string
          feature_id?: string | null
          group_id?: string
          id?: string
          mission_id?: string | null
          module_id?: string | null
          position?: number
          run_id?: string | null
          section_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cafe_tasks_builder_run_id_fkey"
            columns: ["builder_run_id"]
            isOneToOne: false
            referencedRelation: "builder_mission_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_tasks_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "app_features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_tasks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_tasks_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "builder_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_tasks_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "app_modules"
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
          code: string | null
          course: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          instructor_id: string
          name: string
          notes: string
          period: string | null
          shift: string | null
          start_date: string | null
          status: string
          uc_code: string
          updated_at: string
          workload: string | null
        }
        Insert: {
          code?: string | null
          course?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          instructor_id: string
          name: string
          notes?: string
          period?: string | null
          shift?: string | null
          start_date?: string | null
          status?: string
          uc_code?: string
          updated_at?: string
          workload?: string | null
        }
        Update: {
          code?: string | null
          course?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          instructor_id?: string
          name?: string
          notes?: string
          period?: string | null
          shift?: string | null
          start_date?: string | null
          status?: string
          uc_code?: string
          updated_at?: string
          workload?: string | null
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          class_id: string
          created_at: string
          id: string
          notes: string
          status: string
          student_code: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          notes?: string
          status?: string
          student_code?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          notes?: string
          status?: string
          student_code?: string | null
          student_id?: string
          updated_at?: string
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
      eval_feedbacks: {
        Row: {
          author_id: string
          class_id: string
          created_at: string
          id: string
          indicator_id: string | null
          message: string
          student_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          class_id: string
          created_at?: string
          id?: string
          indicator_id?: string | null
          message: string
          student_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          class_id?: string
          created_at?: string
          id?: string
          indicator_id?: string | null
          message?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eval_feedbacks_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eval_feedbacks_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
        ]
      }
      eval_history: {
        Row: {
          class_id: string
          concept: Database["public"]["Enums"]["evaluation_concept"] | null
          created_at: string
          evaluated_by: string | null
          id: string
          indicator_id: string
          notes: string
          stage: string
          student_id: string
        }
        Insert: {
          class_id: string
          concept?: Database["public"]["Enums"]["evaluation_concept"] | null
          created_at?: string
          evaluated_by?: string | null
          id?: string
          indicator_id: string
          notes?: string
          stage?: string
          student_id: string
        }
        Update: {
          class_id?: string
          concept?: Database["public"]["Enums"]["evaluation_concept"] | null
          created_at?: string
          evaluated_by?: string | null
          id?: string
          indicator_id?: string
          notes?: string
          stage?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eval_history_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eval_history_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_suggestions: {
        Row: {
          author_id: string
          created_at: string
          description: string
          group_id: string | null
          id: string
          justification: string
          name: string
          project: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          author_id: string
          created_at?: string
          description?: string
          group_id?: string | null
          id?: string
          justification?: string
          name: string
          project: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          description?: string
          group_id?: string | null
          id?: string
          justification?: string
          name?: string
          project?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_suggestions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      gam_actions: {
        Row: {
          code: string
          context: string
          created_at: string
          description: string
          enabled: boolean
          kind: string
          label: string
          position: number
          requires_validation: boolean
          updated_at: string
          xp: number
        }
        Insert: {
          code: string
          context?: string
          created_at?: string
          description?: string
          enabled?: boolean
          kind?: string
          label: string
          position?: number
          requires_validation?: boolean
          updated_at?: string
          xp?: number
        }
        Update: {
          code?: string
          context?: string
          created_at?: string
          description?: string
          enabled?: boolean
          kind?: string
          label?: string
          position?: number
          requires_validation?: boolean
          updated_at?: string
          xp?: number
        }
        Relationships: []
      }
      gam_badges: {
        Row: {
          code: string
          created_at: string
          criteria: string
          description: string
          enabled: boolean
          icon: string
          name: string
          position: number
          rule_config: Json
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          criteria?: string
          description: string
          enabled?: boolean
          icon?: string
          name: string
          position?: number
          rule_config?: Json
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          criteria?: string
          description?: string
          enabled?: boolean
          icon?: string
          name?: string
          position?: number
          rule_config?: Json
          updated_at?: string
        }
        Relationships: []
      }
      gam_settings: {
        Row: {
          created_at: string
          id: boolean
          ranking_individual_enabled: boolean
          ranking_teams_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: boolean
          ranking_individual_enabled?: boolean
          ranking_teams_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: boolean
          ranking_individual_enabled?: boolean
          ranking_teams_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      gam_student_badges: {
        Row: {
          awarded_at: string
          badge_code: string
          created_at: string
          id: string
          student_id: string
        }
        Insert: {
          awarded_at?: string
          badge_code: string
          created_at?: string
          id?: string
          student_id: string
        }
        Update: {
          awarded_at?: string
          badge_code?: string
          created_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gam_student_badges_badge_code_fkey"
            columns: ["badge_code"]
            isOneToOne: false
            referencedRelation: "gam_badges"
            referencedColumns: ["code"]
          },
        ]
      }
      gam_xp_events: {
        Row: {
          action_code: string
          context: string
          created_at: string
          group_id: string | null
          id: string
          kind: string
          note: string
          ref_id: string | null
          ref_kind: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          student_id: string | null
          updated_at: string
          xp: number
        }
        Insert: {
          action_code: string
          context: string
          created_at?: string
          group_id?: string | null
          id?: string
          kind?: string
          note?: string
          ref_id?: string | null
          ref_kind?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id?: string | null
          updated_at?: string
          xp?: number
        }
        Update: {
          action_code?: string
          context?: string
          created_at?: string
          group_id?: string | null
          id?: string
          kind?: string
          note?: string
          ref_id?: string | null
          ref_kind?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id?: string | null
          updated_at?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "gam_xp_events_action_code_fkey"
            columns: ["action_code"]
            isOneToOne: false
            referencedRelation: "gam_actions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "gam_xp_events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
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
          description: string
          id: string
          name: string
          qa_lead_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          description?: string
          id?: string
          name: string
          qa_lead_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          qa_lead_id?: string | null
          status?: string
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
          source_evaluation_id: string | null
          source_mission_id: string | null
          source_run_id: string | null
          stage: string
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
          source_evaluation_id?: string | null
          source_mission_id?: string | null
          source_run_id?: string | null
          stage?: string
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
          source_evaluation_id?: string | null
          source_mission_id?: string | null
          source_run_id?: string | null
          stage?: string
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
          feature_id: string | null
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
          feature_id?: string | null
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
          feature_id?: string | null
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
            foreignKeyName: "qa_bugs_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "app_features"
            referencedColumns: ["id"]
          },
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
          feature_id: string | null
          group_id: string | null
          id: string
          input_data: string
          mission_id: string | null
          obtained_result: string
          precondition: string
          project: string
          status: string
          steps: string
          test_type: string
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
          feature_id?: string | null
          group_id?: string | null
          id?: string
          input_data?: string
          mission_id?: string | null
          obtained_result?: string
          precondition?: string
          project?: string
          status?: string
          steps?: string
          test_type?: string
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
          feature_id?: string | null
          group_id?: string | null
          id?: string
          input_data?: string
          mission_id?: string | null
          obtained_result?: string
          precondition?: string
          project?: string
          status?: string
          steps?: string
          test_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_test_cases_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "app_features"
            referencedColumns: ["id"]
          },
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
      recovery_plans: {
        Row: {
          class_id: string
          created_at: string
          created_by: string
          description: string
          id: string
          indicator_ids: string[]
          status: string
          student_id: string
          title: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by: string
          description?: string
          id?: string
          indicator_ids?: string[]
          status?: string
          student_id: string
          title: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          indicator_ids?: string[]
          status?: string
          student_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recovery_plans_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
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
      uc_results: {
        Row: {
          class_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          final_result: Database["public"]["Enums"]["final_result"] | null
          id: string
          notes: string
          student_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          final_result?: Database["public"]["Enums"]["final_result"] | null
          id?: string
          notes?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          final_result?: Database["public"]["Enums"]["final_result"] | null
          id?: string
          notes?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "uc_results_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
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
      builder_mission_open: { Args: { _mission_id: string }; Returns: boolean }
      builder_mission_visible: {
        Args: { _mission_id: string; _user_id: string }
        Returns: boolean
      }
      builder_run_can_edit: {
        Args: { _run_id: string; _user_id: string }
        Returns: boolean
      }
      builder_run_can_view: {
        Args: { _run_id: string; _user_id: string }
        Returns: boolean
      }
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
      feature_suggestion_can_review: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      gam_ranking_individual: {
        Args: never
        Returns: {
          full_name: string
          student_id: string
          xp: number
        }[]
      }
      gam_ranking_teams: {
        Args: never
        Returns: {
          group_id: string
          group_name: string
          xp: number
        }[]
      }
      gam_sync_my_badges: {
        Args: never
        Returns: {
          awarded_at: string
          badge_code: string
        }[]
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
