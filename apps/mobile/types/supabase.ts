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
      profiles: {
        Row: {
          id: string
          full_name: string | null
          cpf: string | null
          cnpj: string | null
          razao_social: string | null
          nome_fantasia: string | null
          atividade_cnae: string | null
          data_abertura_mei: string | null
          telefone: string | null
          email: string | null
          endereco: Json | null
          avatar_url: string | null
          limite_anual_mei: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          cpf?: string | null
          cnpj?: string | null
          razao_social?: string | null
          nome_fantasia?: string | null
          atividade_cnae?: string | null
          data_abertura_mei?: string | null
          telefone?: string | null
          email?: string | null
          endereco?: Json | null
          avatar_url?: string | null
          limite_anual_mei?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          cpf?: string | null
          cnpj?: string | null
          razao_social?: string | null
          nome_fantasia?: string | null
          atividade_cnae?: string | null
          data_abertura_mei?: string | null
          telefone?: string | null
          email?: string | null
          endereco?: Json | null
          avatar_url?: string | null
          limite_anual_mei?: number | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
  financial: {
    Tables: {
      transactions: {
        Row: {
          id: string
          user_id: string
          type: 'receita' | 'despesa'
          amount: number
          category: string | null
          description: string | null
          date: string | null
          payment_method: string | null
          client_id: string | null
          nfse_id: string | null
          bank_account_id: string | null
          ai_categorized: boolean | null
          receipt_url: string | null
          created_at: string
        }
      }
    }
  }
  fiscal: {
    Tables: {
      das_records: {
        Row: {
          id: string
          user_id: string
          reference_month: string
          due_date: string
          amount: number
          status: 'pendente' | 'pago' | 'vencido' | 'isento' | null
          barcode: string | null
          pix_code: string | null
          payment_date: string | null
          receipt_url: string | null
          auto_generated: boolean | null
          created_at: string
        }
      }
    }
  }
}
