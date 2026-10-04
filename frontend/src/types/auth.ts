export interface User {
  id: number
  email: string
  created_at: string
  updated_at: string
}

export interface Credentials {
  email: string
  password: string
}

export interface Registration extends Credentials {
  password_confirmation: string
}
