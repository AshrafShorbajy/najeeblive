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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounting_records: {
        Row: {
          booking_id: string
          commission_rate: number
          created_at: string
          id: string
          lesson_id: string
          platform_share: number
          status: string
          student_id: string
          teacher_id: string
          teacher_share: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          booking_id: string
          commission_rate?: number
          created_at?: string
          id?: string
          lesson_id: string
          platform_share?: number
          status?: string
          student_id: string
          teacher_id: string
          teacher_share?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          booking_id?: string
          commission_rate?: number
          created_at?: string
          id?: string
          lesson_id?: string
          platform_share?: number
          status?: string
          student_id?: string
          teacher_id?: string
          teacher_share?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          title?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          amount: number
          created_at: string
          id: string
          is_installment: boolean
          lesson_id: string
          notes: string | null
          paid_sessions: number | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_receipt_url: string | null
          recording_url: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["booking_status"]
          student_id: string
          teacher_id: string
          total_installments: number | null
          updated_at: string
          zoom_join_url: string | null
          zoom_meeting_id: string | null
          zoom_start_url: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          is_installment?: boolean
          lesson_id: string
          notes?: string | null
          paid_sessions?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_receipt_url?: string | null
          recording_url?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          student_id: string
          teacher_id: string
          total_installments?: number | null
          updated_at?: string
          zoom_join_url?: string | null
          zoom_meeting_id?: string | null
          zoom_start_url?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          is_installment?: boolean
          lesson_id?: string
          notes?: string | null
          paid_sessions?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_receipt_url?: string | null
          recording_url?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          student_id?: string
          teacher_id?: string
          total_installments?: number | null
          updated_at?: string
          zoom_join_url?: string | null
          zoom_meeting_id?: string | null
          zoom_start_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          booking_id: string | null
          created_at: string
          id: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          id?: string
          student_id: string
          teacher_id: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          id?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      course_installments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          id: string
          installment_number: number
          paid_at: string | null
          sessions_unlocked: number
          status: string
        }
        Insert: {
          amount?: number
          booking_id: string
          created_at?: string
          id?: string
          installment_number: number
          paid_at?: string | null
          sessions_unlocked?: number
          status?: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          id?: string
          installment_number?: number
          paid_at?: string | null
          sessions_unlocked?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_installments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      curricula: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_levels: {
        Row: {
          created_at: string
          curriculum_id: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          curriculum_id?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          curriculum_id?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_levels_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curricula"
            referencedColumns: ["id"]
          },
        ]
      }
      group_session_schedules: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          recording_url: string | null
          scheduled_at: string | null
          session_number: number
          status: string
          title: string | null
          zoom_join_url: string | null
          zoom_meeting_id: string | null
          zoom_start_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          recording_url?: string | null
          scheduled_at?: string | null
          session_number: number
          status?: string
          title?: string | null
          zoom_join_url?: string | null
          zoom_meeting_id?: string | null
          zoom_start_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          recording_url?: string | null
          scheduled_at?: string | null
          session_number?: number
          status?: string
          title?: string | null
          zoom_join_url?: string | null
          zoom_meeting_id?: string | null
          zoom_start_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_session_schedules_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          admin_notes: string | null
          amount: number
          booking_id: string
          created_at: string
          id: string
          lesson_id: string
          payment_method: string | null
          payment_receipt_url: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          student_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          amount?: number
          booking_id: string
          created_at?: string
          id?: string
          lesson_id: string
          payment_method?: string | null
          payment_receipt_url?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          student_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          booking_id?: string
          created_at?: string
          id?: string
          lesson_id?: string
          payment_method?: string | null
          payment_receipt_url?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          student_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          course_start_date: string | null
          course_topic_type: string | null
          created_at: string
          curriculum_id: string | null
          description: string | null
          duration_minutes: number
          expected_students: number | null
          grade_level_id: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_online: boolean
          lesson_type: Database["public"]["Enums"]["lesson_type"]
          max_age: number | null
          min_age: number | null
          notes: string | null
          price: number
          skill_category_id: string | null
          subject_id: string | null
          teacher_id: string
          title: string
          total_sessions: number | null
          updated_at: string
        }
        Insert: {
          course_start_date?: string | null
          course_topic_type?: string | null
          created_at?: string
          curriculum_id?: string | null
          description?: string | null
          duration_minutes?: number
          expected_students?: number | null
          grade_level_id?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_online?: boolean
          lesson_type: Database["public"]["Enums"]["lesson_type"]
          max_age?: number | null
          min_age?: number | null
          notes?: string | null
          price?: number
          skill_category_id?: string | null
          subject_id?: string | null
          teacher_id: string
          title: string
          total_sessions?: number | null
          updated_at?: string
        }
        Update: {
          course_start_date?: string | null
          course_topic_type?: string | null
          created_at?: string
          curriculum_id?: string | null
          description?: string | null
          duration_minutes?: number
          expected_students?: number | null
          grade_level_id?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_online?: boolean
          lesson_type?: Database["public"]["Enums"]["lesson_type"]
          max_age?: number | null
          min_age?: number | null
          notes?: string | null
          price?: number
          skill_category_id?: string | null
          subject_id?: string | null
          teacher_id?: string
          title?: string
          total_sessions?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curricula"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_grade_level_id_fkey"
            columns: ["grade_level_id"]
            isOneToOne: false
            referencedRelation: "grade_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_skill_category_id_fkey"
            columns: ["skill_category_id"]
            isOneToOne: false
            referencedRelation: "skills_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          curriculum_id: string | null
          full_name: string
          grade_level_id: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          curriculum_id?: string | null
          full_name?: string
          grade_level_id?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          curriculum_id?: string | null
          full_name?: string
          grade_level_id?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curricula"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_grade_level_id_fkey"
            columns: ["grade_level_id"]
            isOneToOne: false
            referencedRelation: "grade_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string
          id: string
          lesson_id: string
          rating: number
          student_id: string
          teacher_id: string
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string
          id?: string
          lesson_id: string
          rating: number
          student_id: string
          teacher_id: string
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          lesson_id?: string
          rating?: number
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      skills_categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          created_at: string
          grade_level_id: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          grade_level_id?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          grade_level_id?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_grade_level_id_fkey"
            columns: ["grade_level_id"]
            isOneToOne: false
            referencedRelation: "grade_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          admin_notes: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          receipt_url: string | null
          status: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          receipt_url?: string | null
          status?: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          receipt_url?: string | null
          status?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "supervisor" | "teacher" | "student"
      booking_status:
        | "pending"
        | "accepted"
        | "scheduled"
        | "completed"
        | "cancelled"
      invoice_status: "pending" | "paid" | "rejected"
      lesson_type: "tutoring" | "bag_review" | "skills" | "group"
      payment_method: "paypal" | "bank_transfer"
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
      app_role: ["admin", "supervisor", "teacher", "student"],
      booking_status: [
        "pending",
        "accepted",
        "scheduled",
        "completed",
        "cancelled",
      ],
      invoice_status: ["pending", "paid", "rejected"],
      lesson_type: ["tutoring", "bag_review", "skills", "group"],
      payment_method: ["paypal", "bank_transfer"],
    },
  },
} as const
