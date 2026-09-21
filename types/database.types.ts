export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type DietaryPattern = "Vegetarian" | "Non-veg" | "Vegan";
export type AnemiaHistory = "No" | "Yes" | "Not sure";
export type PregnancyStatus = "Not applicable" | "Pregnant" | "Not pregnant";
export type BiologicalGender = "Female" | "Male" | "Other" | "Prefer not to say";

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string; // auth.users UUID primary key
          age: number | null;
          gender: BiologicalGender | string | null;
          height_cm: number | null;
          weight_kg: number | null;
          dietary_pattern: DietaryPattern | string | null;
          anemia_history: AnemiaHistory | string | null;
          chronic_conditions: string | null;
          symptoms: string[] | null;
          pregnancy_status: PregnancyStatus | string | null;
          location: string | null;
          doctor_name: string | null;
          doctor_phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string; // must match auth.users(id)
          age?: number | null;
          gender?: BiologicalGender | string | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          dietary_pattern?: DietaryPattern | string | null;
          anemia_history?: AnemiaHistory | string | null;
          chronic_conditions?: string | null;
          symptoms?: string[] | null;
          pregnancy_status?: PregnancyStatus | string | null;
          location?: string | null;
          doctor_name?: string | null;
          doctor_phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          age?: number | null;
          gender?: BiologicalGender | string | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          dietary_pattern?: DietaryPattern | string | null;
          anemia_history?: AnemiaHistory | string | null;
          chronic_conditions?: string | null;
          symptoms?: string[] | null;
          pregnancy_status?: PregnancyStatus | string | null;
          location?: string | null;
          doctor_name?: string | null;
          doctor_phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

export type HealthProfile = Database["public"]["Tables"]["user_profiles"]["Row"];
export type HealthProfileInsert = Database["public"]["Tables"]["user_profiles"]["Insert"];
export type HealthProfileUpdate = Database["public"]["Tables"]["user_profiles"]["Update"];
