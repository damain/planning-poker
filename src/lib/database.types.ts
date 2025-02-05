export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      rooms: {
        Row: {
          id: number
          created_at: string
          code: string
          name: string
          active: boolean
          current_story: string | null
          show_votes: boolean
        }
        Insert: {
          id?: number
          created_at?: string
          code: string
          name: string
          active?: boolean
          current_story?: string | null
          show_votes?: boolean
        }
        Update: {
          id?: number
          created_at?: string
          code?: string
          name?: string
          active?: boolean
          current_story?: string | null
          show_votes?: boolean
        }
      }
      room_users: {
        Row: {
          id: number
          created_at: string
          room_code: string
          user_name: string
          last_seen: string
        }
        Insert: {
          id?: number
          created_at?: string
          room_code: string
          user_name: string
          last_seen: string
        }
        Update: {
          id?: number
          created_at?: string
          room_code?: string
          user_name?: string
          last_seen?: string
        }
      }
      votes: {
        Row: {
          id: number
          created_at: string
          room_code: string
          story_id: string
          user_name: string
          vote_value: number | null
        }
        Insert: {
          id?: number
          created_at?: string
          room_code: string
          story_id: string
          user_name: string
          vote_value?: number | null
        }
        Update: {
          id?: number
          created_at?: string
          room_code?: string
          story_id?: string
          user_name?: string
          vote_value?: number | null
        }
      }
      stories: {
        Row: {
          id: number
          created_at: string
          room_code: string
          title: string
          description: string | null
          final_estimate: number | null
        }
        Insert: {
          id?: number
          created_at?: string
          room_code: string
          title: string
          description?: string | null
          final_estimate?: number | null
        }
        Update: {
          id?: number
          created_at?: string
          room_code?: string
          title?: string
          description?: string | null
          final_estimate?: number | null
        }
      }
    }
  }
}
