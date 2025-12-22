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
      beacons: {
        Row: {
          beacon_number: number
          description: string | null
          easting: number | null
          id: string
          latitude: number
          longitude: number
          northing: number | null
          plot_id: string
        }
        Insert: {
          beacon_number: number
          description?: string | null
          easting?: number | null
          id?: string
          latitude: number
          longitude: number
          northing?: number | null
          plot_id: string
        }
        Update: {
          beacon_number?: number
          description?: string | null
          easting?: number | null
          id?: string
          latitude?: number
          longitude?: number
          northing?: number | null
          plot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beacons_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "plots"
            referencedColumns: ["id"]
          },
        ]
      }
      exports: {
        Row: {
          created_at: string
          export_type: string
          file_name: string
          file_url: string | null
          id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          export_type: string
          file_name: string
          file_url?: string | null
          id?: string
          project_id: string
        }
        Update: {
          created_at?: string
          export_type?: string
          file_name?: string
          file_url?: string | null
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      parcels: {
        Row: {
          area_sqm: number | null
          centroid: Json | null
          coordinates: Json
          created_at: string
          crs: string | null
          id: string
          name: string
          perimeter_m: number | null
          project_id: string
        }
        Insert: {
          area_sqm?: number | null
          centroid?: Json | null
          coordinates: Json
          created_at?: string
          crs?: string | null
          id?: string
          name?: string
          perimeter_m?: number | null
          project_id: string
        }
        Update: {
          area_sqm?: number | null
          centroid?: Json | null
          coordinates?: Json
          created_at?: string
          crs?: string | null
          id?: string
          name?: string
          perimeter_m?: number | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parcels_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      plots: {
        Row: {
          area_sqm: number
          coordinates: Json
          created_at: string
          depth_m: number | null
          id: string
          is_partial: boolean | null
          plot_number: number
          subdivision_id: string
          width_m: number | null
        }
        Insert: {
          area_sqm: number
          coordinates: Json
          created_at?: string
          depth_m?: number | null
          id?: string
          is_partial?: boolean | null
          plot_number: number
          subdivision_id: string
          width_m?: number | null
        }
        Update: {
          area_sqm?: number
          coordinates?: Json
          created_at?: string
          depth_m?: number | null
          id?: string
          is_partial?: boolean | null
          plot_number?: number
          subdivision_id?: string
          width_m?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plots_subdivision_id_fkey"
            columns: ["subdivision_id"]
            isOneToOne: false
            referencedRelation: "subdivisions"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_email: string | null
          client_name: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subdivisions: {
        Row: {
          ai_suggestions: Json | null
          created_at: string
          id: string
          notes: string | null
          orientation_degrees: number | null
          parcel_id: string
          plot_depth: number
          plot_width: number
          road_setback_m: number | null
          side_setback_m: number | null
          strategy: Database["public"]["Enums"]["subdivision_strategy"]
          target_plot_count: number | null
          updated_at: string
        }
        Insert: {
          ai_suggestions?: Json | null
          created_at?: string
          id?: string
          notes?: string | null
          orientation_degrees?: number | null
          parcel_id: string
          plot_depth: number
          plot_width: number
          road_setback_m?: number | null
          side_setback_m?: number | null
          strategy?: Database["public"]["Enums"]["subdivision_strategy"]
          target_plot_count?: number | null
          updated_at?: string
        }
        Update: {
          ai_suggestions?: Json | null
          created_at?: string
          id?: string
          notes?: string | null
          orientation_degrees?: number | null
          parcel_id?: string
          plot_depth?: number
          plot_width?: number
          road_setback_m?: number | null
          side_setback_m?: number | null
          strategy?: Database["public"]["Enums"]["subdivision_strategy"]
          target_plot_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subdivisions_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "parcels"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      project_status: "draft" | "in_progress" | "completed" | "archived"
      subdivision_strategy:
        | "auto_fit"
        | "fixed_count"
        | "equal_resize"
        | "extract_full"
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
      project_status: ["draft", "in_progress", "completed", "archived"],
      subdivision_strategy: [
        "auto_fit",
        "fixed_count",
        "equal_resize",
        "extract_full",
      ],
    },
  },
} as const
